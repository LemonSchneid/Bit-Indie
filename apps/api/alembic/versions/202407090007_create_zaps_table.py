"""Create zaps table to store Lightning zap receipts."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202407090007"
down_revision = "202407090006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the zaps table for recording Lightning receipts."""

    zap_target_enum = sa.Enum(
        "REVIEW",
        "GAME",
        "COMMENT",
        "PLATFORM",
        name="zap_target_type",
        native_enum=False,
    )

    op.create_table(
        "zaps",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("target_type", zap_target_enum, nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.Column("from_pubkey", sa.String(length=128), nullable=False),
        sa.Column("to_pubkey", sa.String(length=128), nullable=False),
        sa.Column("amount_msats", sa.BigInteger(), nullable=False),
        sa.Column("event_id", sa.String(length=128), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount_msats > 0", name="ck_zaps_amount_positive"),
        sa.UniqueConstraint("event_id", name="uq_zaps_event_id"),
    )
    op.create_index(
        "ix_zaps_target_type_target_id",
        "zaps",
        ["target_type", "target_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the zaps table and associated enum."""

    op.drop_index("ix_zaps_target_type_target_id", table_name="zaps")
    op.drop_table("zaps")
    zap_target_enum = sa.Enum(name="zap_target_type", native_enum=False)
    zap_target_enum.drop(op.get_bind(), checkfirst=False)
