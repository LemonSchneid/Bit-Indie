"""Helpers for merging first-party comments with Nostr release note replies."""

from __future__ import annotations

import enum
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Mapping, Sequence

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload

from proof_of_play_api.db.models import (
    Comment,
    Game,
    InvoiceStatus,
    Purchase,
    ReleaseNoteReply,
    User,
)

_BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
_CACHE_DEFAULT_TTL_SECONDS = 30.0
_CACHE_DEFAULT_MAX_SIZE = 256
_AUTHOR_ALIAS_TAG_NAMES = {"alias", "npub"}


class CommentSource(str, enum.Enum):
    """Enumerates the possible origins for a surfaced comment."""

    FIRST_PARTY = "FIRST_PARTY"
    NOSTR = "NOSTR"


@dataclass(frozen=True)
class CommentAuthorDTO:
    """Represents public-facing metadata about the author of a comment."""

    user_id: str | None
    pubkey_hex: str | None
    npub: str | None
    display_name: str | None


@dataclass(frozen=True)
class CommentDTO:
    """Unified representation for storefront comments regardless of source."""

    id: str
    game_id: str
    body_md: str
    created_at: datetime
    source: CommentSource
    author: CommentAuthorDTO
    is_verified_purchase: bool


@dataclass(frozen=True)
class _ReleaseNoteReplySnapshot:
    """Serializable snapshot of a release note reply used for caching."""

    comment_id: str
    game_id: str
    pubkey_hex: str | None
    body_md: str
    created_at: datetime
    alias_pubkeys: tuple[str, ...]


@dataclass
class _CacheEntry:
    """In-memory cache entry storing release note reply snapshots."""

    expires_at: float
    value: list[_ReleaseNoteReplySnapshot]


class ReleaseNoteReplyCache:
    """Time-bound cache for release note replies keyed by game identifier."""

    def __init__(
        self,
        *,
        ttl_seconds: float = _CACHE_DEFAULT_TTL_SECONDS,
        max_size: int = _CACHE_DEFAULT_MAX_SIZE,
    ) -> None:
        if ttl_seconds <= 0:
            msg = "ttl_seconds must be positive"
            raise ValueError(msg)
        if max_size <= 0:
            msg = "max_size must be positive"
            raise ValueError(msg)
        self._ttl_seconds = float(ttl_seconds)
        self._max_size = int(max_size)
        self._entries: dict[str, _CacheEntry] = {}

    def get(self, key: str) -> list[_ReleaseNoteReplySnapshot] | None:
        """Return cached snapshots for the supplied game when they are fresh."""

        entry = self._entries.get(key)
        if entry is None:
            return None
        now = time.monotonic()
        if entry.expires_at <= now:
            self._entries.pop(key, None)
            return None
        return list(entry.value)

    def set(self, key: str, value: Iterable[_ReleaseNoteReplySnapshot]) -> None:
        """Store snapshots for the supplied key and evict stale entries if needed."""

        now = time.monotonic()
        expires_at = now + self._ttl_seconds
        snapshots = list(value)
        self._entries[key] = _CacheEntry(expires_at=expires_at, value=snapshots)
        if len(self._entries) > self._max_size:
            oldest_key = min(
                self._entries,
                key=lambda item: self._entries[item].expires_at,
            )
            if oldest_key != key:
                self._entries.pop(oldest_key, None)

    def clear(self) -> None:
        """Remove all cached entries. Intended for use in tests."""

        self._entries.clear()


class CommentThreadService:
    """Compose a merged comment timeline sourced from database records."""

    def __init__(
        self,
        *,
        reply_cache: ReleaseNoteReplyCache | None = None,
    ) -> None:
        self._reply_cache = reply_cache or ReleaseNoteReplyCache()

    def list_for_game(self, *, session: Session, game: Game) -> list[CommentDTO]:
        """Return chronologically sorted comments for the provided game."""

        first_party = self._load_first_party_comments(session=session, game=game)
        nostr = self._load_release_note_replies(session=session, game=game)
        merged = [*first_party, *nostr]
        merged.sort(key=lambda item: (item.created_at, item.id))
        return merged

    def serialize_comment(self, *, session: Session, comment: Comment) -> CommentDTO:
        """Return a DTO representation for a freshly created comment."""

        user = comment.user or session.get(User, comment.user_id)
        if user is None:
            msg = "Comment must reference a persisted user before serialization."
            raise ValueError(msg)

        verified = self._has_verified_purchase(
            session=session,
            game_id=comment.game_id,
            user_id=user.id,
        )
        return self._build_first_party_comment(comment=comment, user=user, verified=verified)

    def clear_cache(self) -> None:
        """Reset cached release note replies. Intended for tests."""

        self._reply_cache.clear()

    def _load_first_party_comments(
        self, *, session: Session, game: Game
    ) -> list[CommentDTO]:
        stmt: Select[Comment] = (
            select(Comment)
            .options(joinedload(Comment.user))
            .where(Comment.game_id == game.id)
            .where(Comment.is_hidden.is_(False))
            .order_by(Comment.created_at.asc(), Comment.id.asc())
        )
        comments = session.scalars(stmt).all()
        user_ids = {comment.user_id for comment in comments if comment.user_id}
        verified_users = self._load_verified_user_ids(
            session=session, game_id=game.id, user_ids=user_ids
        )
        dtos: list[CommentDTO] = []
        for comment in comments:
            user = comment.user
            if user is None:
                continue
            dto = self._build_first_party_comment(
                comment=comment,
                user=user,
                verified=comment.user_id in verified_users,
            )
            dtos.append(dto)
        return dtos

    def _load_release_note_replies(
        self, *, session: Session, game: Game
    ) -> list[CommentDTO]:
        cached = self._reply_cache.get(game.id)
        if cached is None:
            stmt = (
                select(ReleaseNoteReply)
                .where(ReleaseNoteReply.game_id == game.id)
                .order_by(
                    ReleaseNoteReply.event_created_at.asc(),
                    ReleaseNoteReply.id.asc(),
                )
            )
            replies = session.scalars(stmt).all()
            cached = [self._snapshot_reply(reply=reply) for reply in replies]
            self._reply_cache.set(game.id, cached)

        alias_pubkeys = {alias for snapshot in cached for alias in snapshot.alias_pubkeys}
        users_by_pubkey = self._load_users_by_pubkey(
            session=session, pubkeys=alias_pubkeys
        )
        verified_user_ids = self._load_verified_user_ids(
            session=session,
            game_id=game.id,
            user_ids={user.id for user in users_by_pubkey.values()},
        )

        dtos: list[CommentDTO] = []
        for snapshot in cached:
            matched_user = self._resolve_snapshot_user(
                snapshot=snapshot, users_by_pubkey=users_by_pubkey
            )
            verified = (
                matched_user is not None
                and matched_user.id in verified_user_ids
            )
            author = CommentAuthorDTO(
                user_id=matched_user.id if matched_user else None,
                pubkey_hex=snapshot.pubkey_hex,
                npub=encode_npub(snapshot.pubkey_hex) if snapshot.pubkey_hex else None,
                display_name=matched_user.display_name if matched_user else None,
            )
            dto = CommentDTO(
                id=snapshot.comment_id,
                game_id=snapshot.game_id,
                body_md=snapshot.body_md,
                created_at=snapshot.created_at,
                source=CommentSource.NOSTR,
                author=author,
                is_verified_purchase=verified,
            )
            dtos.append(dto)
        return dtos

    def _build_first_party_comment(
        self,
        *,
        comment: Comment,
        user: User,
        verified: bool,
    ) -> CommentDTO:
        author = CommentAuthorDTO(
            user_id=user.id,
            pubkey_hex=user.pubkey_hex,
            npub=encode_npub(user.pubkey_hex),
            display_name=user.display_name,
        )
        created_at = comment.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return CommentDTO(
            id=comment.id,
            game_id=comment.game_id,
            body_md=comment.body_md,
            created_at=created_at,
            source=CommentSource.FIRST_PARTY,
            author=author,
            is_verified_purchase=verified,
        )

    def _has_verified_purchase(
        self, *, session: Session, game_id: str, user_id: str
    ) -> bool:
        stmt = (
            select(Purchase.id)
            .where(Purchase.game_id == game_id)
            .where(Purchase.user_id == user_id)
            .where(Purchase.invoice_status == InvoiceStatus.PAID)
            .limit(1)
        )
        return session.scalar(stmt) is not None

    def _load_verified_user_ids(
        self, *, session: Session, game_id: str, user_ids: Iterable[str]
    ) -> set[str]:
        ids = {user_id for user_id in user_ids if user_id}
        if not ids:
            return set()
        stmt = (
            select(Purchase.user_id)
            .where(Purchase.game_id == game_id)
            .where(Purchase.invoice_status == InvoiceStatus.PAID)
            .where(Purchase.user_id.in_(ids))
        )
        return set(session.scalars(stmt))

    def _load_users_by_pubkey(
        self, *, session: Session, pubkeys: Iterable[str]
    ) -> dict[str, User]:
        normalized = {key.lower() for key in pubkeys if key}
        if not normalized:
            return {}
        stmt = select(User).where(User.pubkey_hex.in_(normalized))
        return {user.pubkey_hex.lower(): user for user in session.scalars(stmt)}

    def _resolve_snapshot_user(
        self,
        *,
        snapshot: _ReleaseNoteReplySnapshot,
        users_by_pubkey: Mapping[str, User],
    ) -> User | None:
        if snapshot.pubkey_hex:
            direct = users_by_pubkey.get(snapshot.pubkey_hex.lower())
            if direct is not None:
                return direct
        normalized_primary = snapshot.pubkey_hex.lower() if snapshot.pubkey_hex else None
        for alias in snapshot.alias_pubkeys:
            alias_lower = alias.lower()
            if normalized_primary is not None and alias_lower != normalized_primary:
                continue
            resolved = users_by_pubkey.get(alias_lower)
            if resolved is not None:
                return resolved
        return None

    def _snapshot_reply(self, *, reply: ReleaseNoteReply) -> _ReleaseNoteReplySnapshot:
        pubkey_hex = _normalize_hex_key(reply.pubkey)
        aliases = _extract_alias_pubkeys(reply.tags_json, pubkey_hex)
        created_at = reply.event_created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return _ReleaseNoteReplySnapshot(
            comment_id=f"nostr:{reply.event_id}",
            game_id=reply.game_id,
            pubkey_hex=pubkey_hex,
            body_md=reply.content or "",
            created_at=created_at,
            alias_pubkeys=aliases,
        )


def _extract_alias_pubkeys(
    tags_json: str | None, primary_pubkey: str | None
) -> tuple[str, ...]:
    """Return normalized pubkeys referenced by the reply tags."""

    aliases: set[str] = set()
    normalized_primary = primary_pubkey.lower() if primary_pubkey else None
    if normalized_primary is None:
        return tuple()
    aliases.add(normalized_primary)
    if not tags_json:
        return tuple(sorted(aliases))
    try:
        tags = json.loads(tags_json)
    except (TypeError, json.JSONDecodeError):
        return tuple(sorted(aliases))
    candidate_aliases: set[str] = set()
    for tag in tags:
        if not isinstance(tag, Sequence) or len(tag) < 2:
            continue
        name = tag[0]
        if not isinstance(name, str) or name.lower() not in _AUTHOR_ALIAS_TAG_NAMES:
            continue
        for value in tag[1:]:
            normalized = _normalize_pubkey_value(value)
            if normalized:
                candidate_aliases.add(normalized)
    aliases.update(alias for alias in candidate_aliases if alias == normalized_primary)
    return tuple(sorted(aliases))


def _normalize_pubkey_value(value: object) -> str | None:
    """Return a normalized hex pubkey when the value represents a pubkey."""

    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    trimmed = trimmed.removeprefix("nostr:")
    normalized = _normalize_hex_key(trimmed)
    if normalized:
        return normalized
    lowered = trimmed.lower()
    if lowered.startswith("npub"):
        try:
            decoded = decode_npub(trimmed)
        except ValueError:
            return None
        return decoded.hex()
    return None


def _normalize_hex_key(value: str | None) -> str | None:
    """Return a lowercase hex string when the input resembles a pubkey."""

    if value is None:
        return None
    candidate = value.strip()
    if len(candidate) != 64:
        return None
    try:
        bytes.fromhex(candidate)
    except ValueError:
        return None
    return candidate.lower()


def decode_npub(value: str) -> bytes:
    """Decode an npub bech32 string into raw public key bytes."""

    hrp, words = _bech32_decode(value)
    if hrp != "npub":
        raise ValueError("Unexpected bech32 prefix")
    data = _convertbits(words, 5, 8, False)
    return bytes(data)


def encode_npub(pubkey_hex: str | None) -> str | None:
    """Encode a hex public key into its bech32 npub representation."""

    if not pubkey_hex:
        return None
    try:
        raw = bytes.fromhex(pubkey_hex)
    except ValueError:
        return None
    words = _convertbits(raw, 8, 5, True)
    return _bech32_encode("npub", words)


def _bech32_hrp_expand(hrp: str) -> list[int]:
    return [ord(char) >> 5 for char in hrp] + [0] + [ord(char) & 31 for char in hrp]


def _bech32_polymod(values: Iterable[int]) -> int:
    generator = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for value in values:
        if value < 0 or value > 31:
            raise ValueError("bech32 values must be 5-bit integers")
        top = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ value
        for index, polymod in enumerate(generator):
            if (top >> index) & 1:
                chk ^= polymod
    return chk


def _bech32_verify_checksum(hrp: str, values: Sequence[int]) -> bool:
    return _bech32_polymod(_bech32_hrp_expand(hrp) + list(values)) == 1


def _bech32_create_checksum(hrp: str, values: Sequence[int]) -> list[int]:
    payload = _bech32_hrp_expand(hrp) + list(values) + [0, 0, 0, 0, 0, 0]
    polymod = _bech32_polymod(payload) ^ 1
    return [(polymod >> 5 * (5 - index)) & 31 for index in range(6)]


def _bech32_encode(hrp: str, data: Sequence[int]) -> str:
    combined = list(data) + _bech32_create_checksum(hrp, data)
    return hrp + "1" + "".join(_BECH32_ALPHABET[digit] for digit in combined)


def _bech32_decode(value: str) -> tuple[str, list[int]]:
    if any(ord(char) < 33 or ord(char) > 126 for char in value):
        raise ValueError("Invalid bech32 characters")
    if value.lower() != value and value.upper() != value:
        raise ValueError("Mixed case bech32 strings are invalid")
    lower = value.lower()
    separator = lower.rfind("1")
    if separator == -1 or separator < 1 or separator + 7 > len(lower):
        raise ValueError("Invalid bech32 format")
    hrp = lower[:separator]
    data_part = lower[separator + 1 :]
    data: list[int] = []
    for char in data_part:
        try:
            data.append(_BECH32_ALPHABET.index(char))
        except ValueError as exc:
            raise ValueError("Invalid bech32 character") from exc
    if not _bech32_verify_checksum(hrp, data):
        raise ValueError("Invalid bech32 checksum")
    return hrp, data[:-6]


def _convertbits(
    data: Iterable[int] | bytes, from_bits: int, to_bits: int, pad: bool
) -> list[int]:
    """General power-of-two base conversion supporting bech32 encoding."""

    acc = 0
    bits = 0
    ret: list[int] = []
    maxv = (1 << to_bits) - 1
    max_acc = (1 << (from_bits + to_bits - 1)) - 1
    for value in data:
        if isinstance(value, bytes):
            raise TypeError("Nested byte iterables are not supported")
        if value < 0 or value >> from_bits:
            raise ValueError("Input value out of range")
        acc = ((acc << from_bits) | value) & max_acc
        bits += from_bits
        while bits >= to_bits:
            bits -= to_bits
            ret.append((acc >> bits) & maxv)
    if pad and bits:
        ret.append((acc << (to_bits - bits)) & maxv)
    elif not pad and (bits >= from_bits or ((acc << (to_bits - bits)) & maxv)):
        raise ValueError("Invalid padding")
    return ret


__all__ = [
    "CommentAuthorDTO",
    "CommentDTO",
    "CommentSource",
    "CommentThreadService",
    "ReleaseNoteReplyCache",
    "decode_npub",
    "encode_npub",
]
