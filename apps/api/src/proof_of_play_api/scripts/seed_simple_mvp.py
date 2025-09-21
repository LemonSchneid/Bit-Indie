"""Seed the database with demo data for the Simple MVP sandbox.

Usage::

    python -m proof_of_play_api.scripts.seed_simple_mvp

The script honours the usual DATABASE_URL / PG_* environment variables.
"""

from __future__ import annotations

from datetime import datetime, timezone

from proof_of_play_api.db import session_scope
from proof_of_play_api.db.models import (
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
                pubkey_hex="seeddeveloperpubkey000000000000000000000000000000000000000000000000000000000000",
                display_name="Orbit Foundry",
                lightning_address="orbit@lightning.local",
                is_admin=True,
            )
            session.add(developer_user)
        else:
            developer_user.display_name = "Orbit Foundry"
            developer_user.lightning_address = "orbit@lightning.local"
            developer_user.is_admin = True

        player_user = session.get(User, "user-seed-player")
        if player_user is None:
            player_user = User(
                id="user-seed-player",
                pubkey_hex="seedplayerpubkey0000000000000000000000000000000000000000000000000000000000000",
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
                profile_url="https://proof-of-play.dev/orbit",
                contact_email="orbit@example.com",
            )
            session.add(developer)
        else:
            developer.user = developer_user
            developer.verified_dev = True
            developer.profile_url = "https://proof-of-play.dev/orbit"
            developer.contact_email = "orbit@example.com"

        game = session.get(Game, "game-seed-001")
        if game is None:
            game = Game(
                id="game-seed-001",
                developer_id=developer.id,
                developer=developer,
                status=GameStatus.DISCOVER,
                title="Starpath Siege",
                slug="starpath-siege",
                summary="Fast-paced roguelite combat among floating ruins.",
                description_md=(
                    "## Welcome to Starpath Siege\n\n"
                    "Fight across procedurally generated sky temples, craft lightning weapons, and rescue stranded NPCs "
                    "before the storm front crashes in."
                ),
                price_msats=150_000,
                cover_url="https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80",
                category=GameCategory.EARLY_ACCESS,
                build_object_key="games/starpath-siege/v0.3.2.zip",
                build_size_bytes=734_003_200,
                checksum_sha256="d34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33f",
                active=True,
            )
            session.add(game)
        else:
            game.developer = developer
            game.status = GameStatus.DISCOVER
            game.title = "Starpath Siege"
            game.slug = "starpath-siege"
            game.summary = "Fast-paced roguelite combat among floating ruins."
            game.description_md = (
                "## Welcome to Starpath Siege\n\n"
                "Fight across procedurally generated sky temples, craft lightning weapons, and rescue stranded NPCs "
                "before the storm front crashes in."
            )
            game.price_msats = 150_000
            game.cover_url = "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1200&q=80"
            game.category = GameCategory.EARLY_ACCESS
            game.build_object_key = "games/starpath-siege/v0.3.2.zip"
            game.build_size_bytes = 734_003_200
            game.checksum_sha256 = "d34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33fd34db33f"
            game.active = True

        comment = session.get(Comment, "comment-seed-001")
        if comment is None:
            comment = Comment(
                id="comment-seed-001",
                game_id=game.id,
                game=game,
                user_id=player_user.id,
                user=player_user,
                body_md="Landed the first boss on my second attempt. Controller support feels great!",
                created_at=now,
            )
            session.add(comment)
        else:
            comment.user = player_user
            comment.game = game
            comment.body_md = "Landed the first boss on my second attempt. Controller support feels great!"
            comment.is_hidden = False

        review = session.get(Review, "review-seed-001")
        if review is None:
            review = Review(
                id="review-seed-001",
                game_id=game.id,
                game=game,
                user_id=player_user.id,
                user=player_user,
                title="Brutal but fair",
                body_md="The aerial arena design keeps every run tense. Each update has improved performance on my Steam Deck.",
                rating=5,
                helpful_score=4.6,
                total_zap_msats=0,
                is_verified_purchase=True,
                created_at=now,
            )
            session.add(review)
        else:
            review.user = player_user
            review.game = game
            review.title = "Brutal but fair"
            review.body_md = (
                "The aerial arena design keeps every run tense. Each update has improved performance on my Steam Deck."
            )
            review.rating = 5
            review.helpful_score = 4.6
            review.total_zap_msats = 0
            review.is_verified_purchase = True
            review.is_hidden = False

        paid_purchase = session.get(Purchase, "purchase-seed-paid")
        if paid_purchase is None:
            paid_purchase = Purchase(
                id="purchase-seed-paid",
                user_id=player_user.id,
                user=player_user,
                game_id=game.id,
                game=game,
                invoice_id="ln-invoice-seed-paid",
                invoice_status=InvoiceStatus.PAID,
                amount_msats=game.price_msats or 150_000,
                download_granted=True,
                refund_requested=False,
                refund_status=RefundStatus.NONE,
                paid_at=now,
            )
            session.add(paid_purchase)
        else:
            paid_purchase.user = player_user
            paid_purchase.game = game
            paid_purchase.invoice_status = InvoiceStatus.PAID
            paid_purchase.amount_msats = game.price_msats or 150_000
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
                game_id=game.id,
                game=game,
                invoice_id="ln-invoice-seed-pending",
                invoice_status=InvoiceStatus.PENDING,
                amount_msats=game.price_msats or 150_000,
                download_granted=False,
                refund_requested=False,
                refund_status=RefundStatus.NONE,
                paid_at=None,
            )
            session.add(pending_purchase)
        else:
            pending_purchase.user = player_user
            pending_purchase.game = game
            pending_purchase.invoice_status = InvoiceStatus.PENDING
            pending_purchase.amount_msats = game.price_msats or 150_000
            pending_purchase.download_granted = False
            pending_purchase.refund_requested = False
            pending_purchase.refund_status = RefundStatus.NONE
            pending_purchase.paid_at = None

        session.flush()

    print("Seed data applied. Game slug: starpath-siege")


if __name__ == "__main__":
    seed()
