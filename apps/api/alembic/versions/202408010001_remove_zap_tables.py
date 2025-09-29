"""Remove zap tables and review zap columns."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202408010001"
down_revision = "202407310001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Drop zap ingestion tables and review zap metadata."""

    # Drop zap ledger aggregation tables and supporting indexes.
    op.drop_index("ix_zap_ledger_totals_target", table_name="zap_ledger_totals")
    op.drop_table("zap_ledger_totals")
    op.drop_table("zap_ledger_events")

    # Drop zap receipt storage table and index.
    op.drop_index("ix_zaps_target_type_target_id", table_name="zaps")
    op.drop_table("zaps")

    # Remove zap-related columns from reviews.
    op.drop_column("reviews", "suspicious_zap_pattern")
    op.drop_column("reviews", "total_zap_msats")

    # Clean up enum types introduced for zap features.
    zap_source_enum = sa.Enum(name="zap_source", native_enum=False)
    zap_source_enum.drop(op.get_bind(), checkfirst=True)
    zap_target_enum = sa.Enum(name="zap_target_type", native_enum=False)
    zap_target_enum.drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    """Recreate zap tables and review zap metadata."""

    # Restore enum types required by zap tables.
    zap_target_enum = sa.Enum(
        "REVIEW",
        "GAME",
        "COMMENT",
        "PLATFORM",
        name="zap_target_type",
        native_enum=False,
    )
    zap_target_enum.create(op.get_bind(), checkfirst=True)

    zap_source_enum = sa.Enum(
        "DIRECT",
        "FORWARDED",
        name="zap_source",
        native_enum=False,
    )
    zap_source_enum.create(op.get_bind(), checkfirst=True)

    # Recreate zap receipt table.
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

    # Recreate zap ledger tables.
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

    # Restore review zap columns.
    op.add_column(
        "reviews",
        sa.Column(
            "total_zap_msats",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "reviews",
        sa.Column(
            "suspicious_zap_pattern",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
