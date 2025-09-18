"""Add suspicious zap pattern flag to reviews."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202407150002"
down_revision = "202407150001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add a boolean flag for suspicious zap patterns to reviews."""

    op.add_column(
        "reviews",
        sa.Column(
            "suspicious_zap_pattern",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    """Remove the suspicious zap pattern flag from reviews."""

    op.drop_column("reviews", "suspicious_zap_pattern")
