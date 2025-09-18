"""Add lightning_address column to users."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202407090006"
down_revision = "202407090005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add the lightning_address column to the users table."""

    op.add_column("users", sa.Column("lightning_address", sa.String(length=255)))


def downgrade() -> None:
    """Remove the lightning_address column from the users table."""

    op.drop_column("users", "lightning_address")
