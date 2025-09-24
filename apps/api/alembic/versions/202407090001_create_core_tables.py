"""Create core marketplace tables"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from bit_indie_api.db.models import GameCategory, GameStatus, InvoiceStatus, RefundStatus

# revision identifiers, used by Alembic.
revision = "202407090001"
down_revision = None
branch_labels = None
depends_on = None


def _enum(values: list[str], name: str) -> sa.Enum:
    """Create a portable SQLAlchemy Enum definition."""

    return sa.Enum(*values, name=name, native_enum=False)


def upgrade() -> None:
    """Create the initial set of marketplace tables."""

    game_status_enum = _enum([status.value for status in GameStatus], "game_status")
    game_category_enum = _enum([category.value for category in GameCategory], "game_category")
    invoice_status_enum = _enum([status.value for status in InvoiceStatus], "invoice_status")
    refund_status_enum = _enum([status.value for status in RefundStatus], "refund_status")

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("pubkey_hex", sa.String(length=128), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=120)),
        sa.Column("nip05", sa.String(length=255)),
        sa.Column("reputation_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "developers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("verified_dev", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("profile_url", sa.String(length=255)),
        sa.Column("contact_email", sa.String(length=255)),
    )

    op.create_table(
        "games",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("developer_id", sa.String(length=36), sa.ForeignKey("developers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", game_status_enum, nullable=False, server_default=GameStatus.UNLISTED.value),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=200), nullable=False, unique=True),
        sa.Column("summary", sa.String(length=280)),
        sa.Column("description_md", sa.Text()),
        sa.Column("price_msats", sa.BigInteger()),
        sa.Column("cover_url", sa.String(length=500)),
        sa.Column("trailer_url", sa.String(length=500)),
        sa.Column("category", game_category_enum, nullable=False, server_default=GameCategory.PROTOTYPE.value),
        sa.Column("build_object_key", sa.String(length=500)),
        sa.Column("build_size_bytes", sa.BigInteger()),
        sa.Column("checksum_sha256", sa.String(length=64)),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_games_slug", "games", ["slug"], unique=False)

    op.create_table(
        "purchases",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("game_id", sa.String(length=36), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", sa.String(length=120), nullable=False),
        sa.Column("invoice_status", invoice_status_enum, nullable=False, server_default=InvoiceStatus.PENDING.value),
        sa.Column("amount_msats", sa.BigInteger()),
        sa.Column("paid_at", sa.DateTime(timezone=True)),
        sa.Column("download_granted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("refund_requested", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("refund_status", refund_status_enum, nullable=False, server_default=RefundStatus.NONE.value),
        sa.Column("playtime_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint("amount_msats >= 0", name="ck_purchases_amount_msats_positive"),
    )


def downgrade() -> None:
    """Drop the initial marketplace tables."""

    op.drop_table("purchases")
    op.drop_index("ix_games_slug", table_name="games")
    op.drop_table("games")
    op.drop_table("developers")
    op.drop_table("users")
