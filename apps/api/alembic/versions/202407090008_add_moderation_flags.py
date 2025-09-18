"""Add moderation flags table and hidden content toggles"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202407090008"
down_revision = "202407090007"
branch_labels = None
depends_on = None


moderation_target_enum = sa.Enum(
    "GAME",
    "COMMENT",
    "REVIEW",
    name="moderation_target_type",
    native_enum=False,
)

moderation_reason_enum = sa.Enum(
    "SPAM",
    "TOS",
    "DMCA",
    "MALWARE",
    name="moderation_flag_reason",
    native_enum=False,
)

moderation_status_enum = sa.Enum(
    "OPEN",
    "DISMISSED",
    "ACTIONED",
    name="moderation_flag_status",
    native_enum=False,
)


def upgrade() -> None:
    """Create moderation tables and hide controls for user generated content."""

    op.add_column(
        "comments",
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "reviews",
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "moderation_flags",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("target_type", moderation_target_enum, nullable=False),
        sa.Column("target_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", moderation_reason_enum, nullable=False),
        sa.Column("status", moderation_status_enum, nullable=False, server_default="OPEN"),
    )
    op.create_index(
        "ix_moderation_flags_status",
        "moderation_flags",
        ["status"],
    )


def downgrade() -> None:
    """Drop moderation infrastructure for comments and reviews."""

    op.drop_index("ix_moderation_flags_status", table_name="moderation_flags")
    op.drop_table("moderation_flags")

    op.drop_column("reviews", "is_hidden")
    op.drop_column("comments", "is_hidden")

    bind = op.get_bind()
    moderation_status_enum.drop(bind, checkfirst=False)
    moderation_reason_enum.drop(bind, checkfirst=False)
    moderation_target_enum.drop(bind, checkfirst=False)
