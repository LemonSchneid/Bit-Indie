from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from proof_of_play_api.db import Base, get_engine, reset_database_state, session_scope
from proof_of_play_api.db.models import (
    Comment,
    Developer,
    Game,
    GameStatus,
    InvoiceStatus,
    Purchase,
    ReleaseNoteReply,
    User,
    Zap,
    ZapTargetType,
)
from proof_of_play_api.services.comment_thread import (
    CommentDTO,
    CommentDTOBuilder,
    CommentSource,
    CommentThreadService,
    CommentZapAggregator,
    NormalizedReleaseNoteReply,
    ReleaseNoteReplyCache,
    ReleaseNoteReplyLoader,
    ReleaseNoteReplySnapshot,
    ReleaseNoteReplyNormalizer,
)


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create the ORM schema for the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _create_developer(session) -> tuple[User, Developer]:
    """Persist and return a developer and their linked user."""

    user = User(pubkey_hex=f"developer-{uuid.uuid4().hex}")
    session.add(user)
    session.flush()

    developer = Developer(user_id=user.id)
    session.add(developer)
    session.flush()

    return user, developer


def _create_game(session, developer: Developer, *, active: bool = True) -> Game:
    """Persist and return a game owned by the provided developer."""

    game = Game(
        developer_id=developer.id,
        title="Nebula Drift",
        slug=f"nebula-drift-{uuid.uuid4().hex[:8]}",
        status=GameStatus.UNLISTED,
        active=active,
    )
    session.add(game)
    session.flush()
    return game


def _create_comment(
    session,
    *,
    game_id: str,
    user_id: str,
    body_md: str,
    created_at: datetime,
) -> Comment:
    """Persist a storefront comment and return the ORM entity."""

    comment = Comment(
        game_id=game_id,
        user_id=user_id,
        body_md=body_md,
        created_at=created_at,
    )
    session.add(comment)
    session.flush()
    return comment


def _create_release_note_reply(
    session,
    *,
    game_id: str,
    event_id: str,
    pubkey_hex: str,
    created_at: datetime,
    content: str,
    tags: list[list[str]],
    hidden: bool = False,
) -> ReleaseNoteReply:
    """Persist a release note reply associated with the provided game."""

    reply = ReleaseNoteReply(
        game_id=game_id,
        release_note_event_id=f"release-{uuid.uuid4().hex}",
        relay_url="wss://relay.example.com",
        event_id=event_id,
        pubkey=pubkey_hex,
        kind=1,
        event_created_at=created_at,
        content=content,
        tags_json=json.dumps(tags),
        is_hidden=hidden,
    )
    session.add(reply)
    session.flush()
    return reply


def _create_purchase(
    session,
    *,
    game_id: str,
    user_id: str,
    invoice_suffix: str,
    paid_at: datetime,
) -> None:
    """Persist a paid purchase for the supplied user and game."""

    purchase = Purchase(
        user_id=user_id,
        game_id=game_id,
        invoice_id=f"invoice-{invoice_suffix}",
        invoice_status=InvoiceStatus.PAID,
        amount_msats=5_000,
        paid_at=paid_at,
    )
    session.add(purchase)


def test_release_note_reply_loader_caches_snapshots() -> None:
    """Snapshot loader should reuse cached entries until the cache is cleared."""

    _create_schema()
    loader = ReleaseNoteReplyLoader(
        cache=ReleaseNoteReplyCache(ttl_seconds=60.0, max_size=16)
    )
    pubkey = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
    created_at = datetime(2024, 1, 1, 12, 30, tzinfo=timezone.utc)

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = _create_game(session, developer)
        reply = _create_release_note_reply(
            session,
            game_id=game.id,
            event_id="event-1",
            pubkey_hex=pubkey.upper(),
            created_at=created_at,
            content="Looking forward to this build!",
            tags=[["alias", pubkey.lower()], ["npub", pubkey.lower()]],
        )
        reply_id = reply.id
        game_id = game.id

    with session_scope() as session:
        snapshots_first = loader.load_snapshots(session=session, game_id=game_id)

    assert len(snapshots_first) == 1
    snapshot = snapshots_first[0]
    assert snapshot.comment_id == "nostr:event-1"
    assert snapshot.pubkey_hex == pubkey.lower()
    assert snapshot.alias_pubkeys == (pubkey.lower(),)

    with session_scope() as session:
        stored = session.get(ReleaseNoteReply, reply_id)
        assert stored is not None
        session.delete(stored)
        session.flush()

    with session_scope() as session:
        cached = loader.load_snapshots(session=session, game_id=game_id)

    assert len(cached) == 1
    loader.clear_cache()

    with session_scope() as session:
        cleared = loader.load_snapshots(session=session, game_id=game_id)

    assert cleared == []


def test_release_note_reply_cache_thread_safe_updates() -> None:
    """Cache should handle concurrent access without data loss or exceptions."""

    cache = ReleaseNoteReplyCache(ttl_seconds=60.0, max_size=32)
    game_id = "game-threaded"
    iterations = 25
    base_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
    exceptions: list[BaseException] = []
    exception_lock = threading.Lock()

    def record_exception(exc: BaseException) -> None:
        with exception_lock:
            exceptions.append(exc)

    def make_snapshot(index: int) -> ReleaseNoteReplySnapshot:
        return ReleaseNoteReplySnapshot(
            comment_id=f"nostr:event-{index}",
            game_id=game_id,
            pubkey_hex="a" * 64,
            body_md=f"body-{index}",
            created_at=base_time + timedelta(minutes=index),
            alias_pubkeys=("alias",),
        )

    def writer() -> None:
        try:
            for i in range(iterations):
                cache.set(game_id, [make_snapshot(i)])
        except BaseException as exc:  # pragma: no cover - defensive capture
            record_exception(exc)

    def reader() -> None:
        try:
            for _ in range(iterations):
                cache.get(game_id)
        except BaseException as exc:  # pragma: no cover - defensive capture
            record_exception(exc)

    threads = [threading.Thread(target=writer) for _ in range(3)] + [
        threading.Thread(target=reader) for _ in range(3)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert not exceptions
    latest = cache.get(game_id)
    assert latest is not None
    assert len(latest) == 1
    assert latest[0].comment_id == f"nostr:event-{iterations - 1}"
    assert latest[0].body_md == f"body-{iterations - 1}"


def test_release_note_reply_normalizer_resolves_users_and_verification() -> None:
    """Normalizer should attach user context and purchase verification."""

    _create_schema()
    loader = ReleaseNoteReplyLoader(
        cache=ReleaseNoteReplyCache(ttl_seconds=60.0, max_size=16)
    )
    normalizer = ReleaseNoteReplyNormalizer()
    matching_pubkey = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"
    unmatched_pubkey = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"

    with session_scope() as session:
        purchaser_user, developer = _create_developer(session)
        game = _create_game(session, developer)
        purchaser_user.pubkey_hex = matching_pubkey
        session.flush()
        observer = User(pubkey_hex=unmatched_pubkey)
        session.add(observer)
        session.flush()
        _create_purchase(
            session,
            game_id=game.id,
            user_id=purchaser_user.id,
            invoice_suffix="paid",
            paid_at=datetime.now(timezone.utc),
        )
        _create_release_note_reply(
            session,
            game_id=game.id,
            event_id="event-match",
            pubkey_hex=matching_pubkey.upper(),
            created_at=datetime(2024, 2, 1, 9, 0, tzinfo=timezone.utc),
            content="Purchased and played all night!",
            tags=[["alias", matching_pubkey]],
        )
        _create_release_note_reply(
            session,
            game_id=game.id,
            event_id="event-miss",
            pubkey_hex=unmatched_pubkey,
            created_at=datetime(2024, 2, 1, 10, 0, tzinfo=timezone.utc),
            content="Following the updates closely.",
            tags=[["alias", unmatched_pubkey]],
        )
        game_id = game.id
        purchaser_id = purchaser_user.id
        observer_id = observer.id

    with session_scope() as session:
        snapshots = loader.load_snapshots(session=session, game_id=game_id)
        normalized = normalizer.normalize(
            session=session, game_id=game_id, snapshots=snapshots
        )
        assert {item.snapshot.comment_id for item in normalized} == {
            "nostr:event-match",
            "nostr:event-miss",
        }
        matched = next(
            item for item in normalized if item.snapshot.comment_id == "nostr:event-match"
        )
        assert matched.matched_user is not None
        assert matched.matched_user.id == purchaser_id
        assert matched.is_verified_purchase is True
        unmatched = next(
            item for item in normalized if item.snapshot.comment_id == "nostr:event-miss"
        )
        assert unmatched.matched_user is not None
        assert unmatched.matched_user.id == observer_id
        assert unmatched.is_verified_purchase is False


def test_comment_dto_builder_handles_sources() -> None:
    """DTO builder should normalize timestamps and author details."""

    builder = CommentDTOBuilder()
    created_at = datetime(2024, 3, 5, 15, 45)
    user = User(id="user-1", pubkey_hex="a" * 64, display_name="NebulaDev")
    comment = Comment(
        id="comment-1",
        game_id="game-1",
        user_id="user-1",
        body_md="Launch build incoming!",
        created_at=created_at,
    )

    first_party = builder.build_first_party_comment(
        comment=comment,
        user=user,
        is_verified_purchase=True,
    )
    assert first_party.source is CommentSource.FIRST_PARTY
    assert first_party.created_at.tzinfo is timezone.utc
    assert first_party.author.user_id == "user-1"
    assert first_party.is_verified_purchase is True

    snapshot = ReleaseNoteReplyLoader()._snapshot_reply(  # type: ignore[protected-access]
        reply=ReleaseNoteReply(
            game_id="game-1",
            release_note_event_id="release-1",
            relay_url="wss://relay.example.com",
            event_id="event-123",
            pubkey="b" * 64,
            kind=1,
            event_created_at=datetime(2024, 3, 6, 12, 0, tzinfo=timezone.utc),
            content="Loving the update!",
            tags_json=json.dumps([["alias", "b" * 64]]),
        )
    )
    normalized = NormalizedReleaseNoteReply(
        snapshot=snapshot,
        matched_user=None,
        is_verified_purchase=False,
    )
    reply_dto = builder.build_release_note_reply(normalized_reply=normalized)
    assert reply_dto.source is CommentSource.NOSTR
    assert reply_dto.author.pubkey_hex == "b" * 64
    assert reply_dto.author.user_id is None
    assert reply_dto.is_verified_purchase is False


def test_comment_zap_aggregator_applies_totals() -> None:
    """Zap aggregator should attach Lightning totals to comment DTOs."""

    _create_schema()
    aggregator = CommentZapAggregator()
    now = datetime.now(timezone.utc)

    with session_scope() as session:
        _, developer = _create_developer(session)
        game = _create_game(session, developer)
        commenter = User(pubkey_hex=f"commenter-{uuid.uuid4().hex}")
        session.add(commenter)
        session.flush()
        comment = _create_comment(
            session,
            game_id=game.id,
            user_id=commenter.id,
            body_md="Zap me!",
            created_at=now,
        )
        zap = Zap(
            target_type=ZapTargetType.COMMENT,
            target_id=comment.id,
            from_pubkey="c" * 64,
            to_pubkey="d" * 64,
            amount_msats=1234,
            event_id="zap-event",
            received_at=now,
        )
        session.add(zap)
        session.flush()

        dto = CommentDTO(
            id=comment.id,
            game_id=game.id,
            body_md=comment.body_md,
            created_at=comment.created_at,
            source=CommentSource.FIRST_PARTY,
            author=CommentDTOBuilder().build_first_party_comment(
                comment=comment,
                user=commenter,
                is_verified_purchase=False,
            ).author,
            is_verified_purchase=False,
            total_zap_msats=0,
        )
        enriched = aggregator.attach_totals(session=session, comments=[dto])

    assert enriched[0].total_zap_msats == 1234


def test_comment_thread_service_merges_sources() -> None:
    """Integration test ensuring the service composes collaborators correctly."""

    _create_schema()
    service = CommentThreadService()
    now = datetime(2024, 4, 1, 9, 0, tzinfo=timezone.utc)
    nostr_time = now + timedelta(minutes=30)
    pubkey = f"{uuid.uuid4().hex}{uuid.uuid4().hex}"

    with session_scope() as session:
        developer_user, developer = _create_developer(session)
        game = _create_game(session, developer)
        commenter = User(pubkey_hex=f"commenter-{uuid.uuid4().hex}", display_name="Pilot")
        session.add(commenter)
        session.flush()
        comment = _create_comment(
            session,
            game_id=game.id,
            user_id=commenter.id,
            body_md="Excited for launch",
            created_at=now,
        )
        _create_release_note_reply(
            session,
            game_id=game.id,
            event_id="nostr-1",
            pubkey_hex=pubkey,
            created_at=nostr_time,
            content="Thanks for the update!",
            tags=[["alias", pubkey]],
        )
        _create_purchase(
            session,
            game_id=game.id,
            user_id=developer_user.id,
            invoice_suffix="dev",
            paid_at=now - timedelta(days=1),
        )
        developer_user.lightning_address = "pilot@ln.example.com"
        session.flush()
        zap = Zap(
            target_type=ZapTargetType.COMMENT,
            target_id=comment.id,
            from_pubkey="f" * 64,
            to_pubkey="g" * 64,
            amount_msats=2000,
            event_id="zap-1",
            received_at=nostr_time,
        )
        session.add(zap)
        session.flush()
        game_id = game.id
        comment_id = comment.id
        commenter_id = commenter.id

    with session_scope() as session:
        game_db = session.get(Game, game_id)
        assert game_db is not None
        results = service.list_for_game(session=session, game=game_db)

    assert [dto.source for dto in results] == [CommentSource.FIRST_PARTY, CommentSource.NOSTR]
    assert results[0].total_zap_msats == 2000
    assert results[1].author.npub is not None
    assert results[1].is_verified_purchase is False

    with session_scope() as session:
        comment_db = session.get(Comment, comment_id)
        assert comment_db is not None
        serialized = service.serialize_comment(session=session, comment=comment_db)

    assert serialized.author.user_id == commenter_id
    assert serialized.total_zap_msats == 0
