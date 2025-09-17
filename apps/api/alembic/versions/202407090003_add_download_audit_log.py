"""Add audit log table for generated download links."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202407090003"
down_revision = "202407090002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create table tracking download link issuance events."""

    op.create_table(
        "download_audit_logs",
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
        sa.Column(
            "purchase_id",
            sa.String(length=36),
            sa.ForeignKey("purchases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "game_id",
            sa.String(length=36),
            sa.ForeignKey("games.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_download_audit_logs_purchase_id",
        "download_audit_logs",
        ["purchase_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the download audit log table."""

    op.drop_index("ix_download_audit_logs_purchase_id", table_name="download_audit_logs")
    op.drop_table("download_audit_logs")
