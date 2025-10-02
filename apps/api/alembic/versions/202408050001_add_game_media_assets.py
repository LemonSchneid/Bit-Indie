"""Add hero and receipt thumbnail URLs to game listings."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202408050001"
down_revision = "202408020001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add media asset URL columns to the games table."""

    op.add_column("games", sa.Column("hero_url", sa.String(length=500)))
    op.add_column("games", sa.Column("receipt_thumbnail_url", sa.String(length=500)))


def downgrade() -> None:
    """Remove media asset URL columns from the games table."""

    op.drop_column("games", "receipt_thumbnail_url")
    op.drop_column("games", "hero_url")

