from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202407250001"
down_revision = "202407200002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create tables for recording aggregated zap ledger totals."""

    zap_source_enum = sa.Enum(
        "DIRECT",
        "FORWARDED",
        name="zap_source",
        native_enum=False,
    )
    zap_source_enum.create(op.get_bind(), checkfirst=True)

    zap_target_enum = sa.Enum(name="zap_target_type", native_enum=False)

    op.create_table(
        "zap_ledger_events",
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
        sa.Column("event_id", sa.String(length=128), nullable=False),
        sa.Column("sender_pubkey", sa.String(length=128), nullable=False),
        sa.Column("total_msats", sa.BigInteger(), nullable=False),
        sa.Column(
            "part_count",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        sa.Column("event_created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("total_msats > 0", name="ck_zap_ledger_events_total_positive"),
        sa.CheckConstraint("part_count > 0", name="ck_zap_ledger_events_part_count_positive"),
        sa.UniqueConstraint("event_id", name="ux_zap_ledger_events_event_id"),
    )

    op.create_table(
        "zap_ledger_totals",
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
        sa.Column("zap_source", zap_source_enum, nullable=False),
        sa.Column(
            "total_msats",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "zap_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_event_id", sa.String(length=128), nullable=True),
        sa.CheckConstraint(
            "total_msats >= 0", name="ck_zap_ledger_totals_amount_non_negative"
        ),
        sa.CheckConstraint("zap_count >= 0", name="ck_zap_ledger_totals_count_non_negative"),
        sa.UniqueConstraint(
            "target_type",
            "target_id",
            "zap_source",
            name="ux_zap_ledger_target_source",
        ),
    )

    op.create_index(
        "ix_zap_ledger_totals_target",
        "zap_ledger_totals",
        ["target_type", "target_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop zap ledger tables and associated enum types."""

    op.drop_index("ix_zap_ledger_totals_target", table_name="zap_ledger_totals")
    op.drop_table("zap_ledger_totals")
    op.drop_table("zap_ledger_events")

    zap_source_enum = sa.Enum(name="zap_source", native_enum=False)
    zap_source_enum.drop(op.get_bind(), checkfirst=False)
