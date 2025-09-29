"""Seed the database with demo data for the Simple MVP sandbox.

Usage::

    python -m bit_indie_api.scripts.seed_simple_mvp

The script honours the usual DATABASE_URL / PG_* environment variables.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from bit_indie_api.db import session_scope
from bit_indie_api.db.models import (
    BuildScanStatus,
    Comment,
    Developer,
    Game,
    GameCategory,
    GameStatus,
    InvoiceStatus,
    Purchase,
    RefundStatus,
    Review,
    User,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def seed() -> None:
    now = _utc_now()

    with session_scope() as session:
        developer_user = session.get(User, "user-seed-developer")
        if developer_user is None:
            developer_user = User(
                id="user-seed-developer",
                account_identifier="seeddeveloper-account",
                display_name="Orbit Foundry",
                lightning_address="piteousfrench82@walletofsatoshi.com",
                is_admin=True,
            )
            session.add(developer_user)
        else:
            developer_user.display_name = "Orbit Foundry"
            developer_user.lightning_address = "piteousfrench82@walletofsatoshi.com"
            developer_user.is_admin = True

        player_user = session.get(User, "user-seed-player")
        if player_user is None:
            player_user = User(
                id="user-seed-player",
                account_identifier="seedplayer-account",
                display_name="Nova Runner",
                lightning_address="novarunner@example.com",
            )
            session.add(player_user)
        else:
            player_user.display_name = "Nova Runner"
            player_user.lightning_address = "novarunner@example.com"

        developer = session.get(Developer, "dev-seed-001")
        if developer is None:
            developer = Developer(
                id="dev-seed-001",
                user_id=developer_user.id,
                user=developer_user,
                verified_dev=True,
                profile_url="https://bit-indie.dev/orbit",
                contact_email="orbit@example.com",
            )
            session.add(developer)
        else:
            developer.user = developer_user
            developer.verified_dev = True
            developer.profile_url = "https://bit-indie.dev/orbit"
            developer.contact_email = "orbit@example.com"

        catalog_games_data = [
            {
                "id": "game-seed-001",
                "title": "Starpath Siege",
                "slug": "starpath-siege",
                "summary": "Fast-paced roguelite combat among floating ruins.",
                "description_md": (
                    "## Welcome to Starpath Siege\n\n"
                    "Fight across procedurally generated sky temples, craft lightning weapons, and rescue stranded NPCs "
                    "before the storm front crashes in."
                ),
                "price_msats": 150_000,
                "cover_url": "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
                "category": GameCategory.EARLY_ACCESS,
                "status": GameStatus.FEATURED,
                "build_object_key": "games/starpath-siege/v0.3.2.zip",
                "build_size_bytes": 734_003_200,
                "checksum_sha256": "d34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33f",
                "active": True,
                "updated_at": now - timedelta(hours=2),
            },
            {
                "id": "game-seed-002",
                "title": "Chronorift Tactics",
                "slug": "chronorift-tactics",
                "summary": "Command a squad of time-shifted pilots through phase-bending skirmishes.",
                "description_md": (
                    "## Tactical combat that bends time\n\n"
                    "Pause the battlefield to queue abilities, then resume to watch them resolve in cascading bullet-time waves.\n\n"
                    "Weekly challenge seeds remix enemy loadouts and terrain for tournament runs."
                ),
                "price_msats": 120_000,
                "cover_url": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
                "category": GameCategory.EARLY_ACCESS,
                "status": GameStatus.DISCOVER,
                "build_object_key": "games/chronorift-tactics/v0.5.0.zip",
                "build_size_bytes": 612_200_000,
                "checksum_sha256": "111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000",
                "active": True,
                "updated_at": now - timedelta(days=1),
            },
            {
                "id": "game-seed-003",
                "title": "Lumen Forge",
                "slug": "lumen-forge",
                "summary": "Cooperative factory building with photon reactors beneath a crystal moon.",
                "description_md": (
                    "## Build with light\n\n"
                    "Co-op automation meets puzzle routing as you redirect beams to power massive forges.\n\n"
                    "Supports drop-in multiplayer with synced blueprint sharing."
                ),
                "price_msats": 190_000,
                "cover_url": "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=1200&q=80",
                "category": GameCategory.FINISHED,
                "status": GameStatus.FEATURED,
                "build_object_key": "games/lumen-forge/v1.2.1.zip",
                "build_size_bytes": 889_512_448,
                "checksum_sha256": "22223333444455556666777788889999aaaabbbbccccddddeeeeffff00001111",
                "active": True,
                "updated_at": now - timedelta(days=2),
            },
            {
                "id": "game-seed-004",
                "title": "Echoes of the Deep",
                "slug": "echoes-of-the-deep",
                "summary": "Narrative diving adventure charting ruins with reactive sonar storytelling.",
                "description_md": (
                    "## Explore the midnight trench\n\n"
                    "Descend alone or with a crew to map bioluminescent caverns and recover lost technology.\n\n"
                    "Dialogue choices echo through future dives, revealing hidden factions."
                ),
                "price_msats": 95_000,
                "cover_url": "https://images.unsplash.com/photo-1526403228363-5fda5f4c1cde?auto=format&fit=crop&w=1200&q=80",
                "category": GameCategory.EARLY_ACCESS,
                "status": GameStatus.DISCOVER,
                "build_object_key": "games/echoes-of-the-deep/v0.9.4.zip",
                "build_size_bytes": 452_338_176,
                "checksum_sha256": "3333444455556666777788889999aaaabbbbccccddddeeeeffff000011112222",
                "active": True,
                "updated_at": now - timedelta(days=3),
            },
            {
                "id": "game-seed-005",
                "title": "Quantum Drift Rally",
                "slug": "quantum-drift-rally",
                "summary": "Arcade hover-racing across collapsing nebula circuits with asynchronous ghosts.",
                "description_md": (
                    "## Chase your best timeline\n\n"
                    "Chain boost pads to outrun the phase collapse and challenge friends' ghost data.\n\n"
                    "Weekly tournaments rotate track modifiers and leaderboard rewards."
                ),
                "price_msats": 70_000,
                "cover_url": "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
                "category": GameCategory.PROTOTYPE,
                "status": GameStatus.DISCOVER,
                "build_object_key": "games/quantum-drift-rally/v0.2.7.zip",
                "build_size_bytes": 388_120_576,
                "checksum_sha256": "444455556666777788889999aaaabbbbccccddddeeeeffff0000111122223333",
                "active": True,
                "updated_at": now - timedelta(days=4),
            },
        ]

        games_by_slug: dict[str, Game] = {}
        catalog_slugs: list[str] = []

        for entry in catalog_games_data:
            game = session.get(Game, entry["id"])
            if game is None:
                game = Game(id=entry["id"], developer=developer)
                session.add(game)

            game.developer = developer
            game.developer_id = developer.id
            game.status = entry["status"]
            game.title = entry["title"]
            game.slug = entry["slug"]
            game.summary = entry.get("summary")
            game.description_md = entry.get("description_md")
            game.price_msats = entry.get("price_msats")
            game.cover_url = entry.get("cover_url")
            game.trailer_url = entry.get("trailer_url")
            game.category = entry["category"]
            game.build_object_key = entry.get("build_object_key")
            game.build_size_bytes = entry.get("build_size_bytes")
            game.checksum_sha256 = entry.get("checksum_sha256")
            game.build_scan_status = BuildScanStatus.CLEAN
            game.build_scan_message = "Seed data: build vetted for demo purposes."
            game.build_scanned_at = now - timedelta(hours=1)
            game.active = entry.get("active", True)

            updated_at_override = entry.get("updated_at")
            if updated_at_override is not None:
                game.updated_at = updated_at_override

            games_by_slug[entry["slug"]] = game
            catalog_slugs.append(entry["slug"])

        starpath_game = games_by_slug["starpath-siege"]

        comment = session.get(Comment, "comment-seed-001")
        if comment is None:
            comment = Comment(
                id="comment-seed-001",
                game_id=starpath_game.id,
                game=starpath_game,
                user_id=player_user.id,
                user=player_user,
                body_md="Landed the first boss on my second attempt. Controller support feels great!",
                created_at=now,
            )
            session.add(comment)
        else:
            comment.user = player_user
            comment.game = starpath_game
            comment.body_md = "Landed the first boss on my second attempt. Controller support feels great!"
            comment.is_hidden = False

        review = session.get(Review, "review-seed-001")
        if review is None:
            review = Review(
                id="review-seed-001",
                game_id=starpath_game.id,
                game=starpath_game,
                user_id=player_user.id,
                user=player_user,
                title="Brutal but fair",
                body_md="The aerial arena design keeps every run tense. Each update has improved performance on my Steam Deck.",
                rating=5,
                helpful_score=4.6,
                is_verified_purchase=True,
                created_at=now,
            )
            session.add(review)
        else:
            review.user = player_user
            review.game = starpath_game
            review.title = "Brutal but fair"
            review.body_md = (
                "The aerial arena design keeps every run tense. Each update has improved performance on my Steam Deck."
            )
            review.rating = 5
            review.helpful_score = 4.6
            review.is_verified_purchase = True
            review.is_hidden = False

        lumen_game = games_by_slug["lumen-forge"]
        lumen_review = session.get(Review, "review-seed-002")
        if lumen_review is None:
            lumen_review = Review(
                id="review-seed-002",
                game_id=lumen_game.id,
                game=lumen_game,
                user_id=player_user.id,
                user=player_user,
                title="Factories that glow",
                body_md=(
                    "Shared blueprints make the co-op loop surprisingly welcoming for new players.\n\n"
                    "Our trio hit late-game reactors without ever needing voice chat."
                ),
                rating=4,
                helpful_score=3.8,
                is_verified_purchase=True,
                created_at=now,
            )
            session.add(lumen_review)
        else:
            lumen_review.user = player_user
            lumen_review.game = lumen_game
            lumen_review.title = "Factories that glow"
            lumen_review.body_md = (
                "Shared blueprints make the co-op loop surprisingly welcoming for new players.\n\n"
                "Our trio hit late-game reactors without ever needing voice chat."
            )
            lumen_review.rating = 4
            lumen_review.helpful_score = 3.8
            lumen_review.is_verified_purchase = True
            lumen_review.is_hidden = False

        chronorift_game = games_by_slug["chronorift-tactics"]
        chronorift_comment = session.get(Comment, "comment-seed-002")
        if chronorift_comment is None:
            chronorift_comment = Comment(
                id="comment-seed-002",
                game_id=chronorift_game.id,
                game=chronorift_game,
                user_id=player_user.id,
                user=player_user,
                body_md="Phase-link combos feel incredible in co-op once the timers click.",
                created_at=now,
            )
            session.add(chronorift_comment)
        else:
            chronorift_comment.user = player_user
            chronorift_comment.game = chronorift_game
            chronorift_comment.body_md = "Phase-link combos feel incredible in co-op once the timers click."
            chronorift_comment.is_hidden = False

        paid_purchase = session.get(Purchase, "purchase-seed-paid")
        if paid_purchase is None:
            paid_purchase = Purchase(
                id="purchase-seed-paid",
                user_id=player_user.id,
                user=player_user,
                game_id=starpath_game.id,
                game=starpath_game,
                invoice_id="ln-invoice-seed-paid",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=starpath_game.price_msats or 150_000,
                download_granted=True,
                refund_requested=False,
                refund_status=RefundStatus.NONE,
                paid_at=now,
            )
            session.add(paid_purchase)
        else:
            paid_purchase.user = player_user
            paid_purchase.game = starpath_game
            paid_purchase.invoice_status = InvoiceStatus.PAID
            paid_purchase.amount_msats = starpath_game.price_msats or 150_000
            paid_purchase.download_granted = True
            paid_purchase.refund_requested = False
            paid_purchase.refund_status = RefundStatus.NONE
            paid_purchase.paid_at = now

        pending_purchase = session.get(Purchase, "purchase-seed-pending")
        if pending_purchase is None:
            pending_purchase = Purchase(
                id="purchase-seed-pending",
                user_id=player_user.id,
                user=player_user,
                game_id=starpath_game.id,
                game=starpath_game,
                invoice_id="ln-invoice-seed-pending",
                invoice_status=InvoiceStatus.PENDING,
                amount_msats=starpath_game.price_msats or 150_000,
                download_granted=False,
                refund_requested=False,
                refund_status=RefundStatus.NONE,
                paid_at=None,
            )
            session.add(pending_purchase)
        else:
            pending_purchase.user = player_user
            pending_purchase.game = starpath_game
            pending_purchase.invoice_status = InvoiceStatus.PENDING
            pending_purchase.amount_msats = starpath_game.price_msats or 150_000
            pending_purchase.download_granted = False
            pending_purchase.refund_requested = False
            pending_purchase.refund_status = RefundStatus.NONE
            pending_purchase.paid_at = None

        session.flush()

    if catalog_slugs:
        print(f"Seed data applied. Game slugs: {', '.join(catalog_slugs)}")
    else:
        print("Seed data applied.")


if __name__ == "__main__":
    seed()
