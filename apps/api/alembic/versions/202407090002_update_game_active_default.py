"""Set games.active default to false for unpublished drafts."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202407090002"
down_revision = "202407090001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Ensure new games default to inactive until explicitly published."""

    op.alter_column(
        "games",
        "active",
        existing_type=sa.Boolean(),
        server_default=sa.text("false"),
        existing_server_default=sa.text("true"),
    )


def downgrade() -> None:
    """Restore the previous default for the games.active column."""

    op.alter_column(
        "games",
        "active",
        existing_type=sa.Boolean(),
        server_default=sa.text("true"),
        existing_server_default=sa.text("false"),
    )
