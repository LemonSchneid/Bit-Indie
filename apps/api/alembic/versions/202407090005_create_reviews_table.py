"""Create reviews table with zap tracking metadata."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202407090005"
down_revision = "202407090004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the reviews table for community feedback entries."""

    op.create_table(
        "reviews",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "game_id",
            sa.String(length=36),
            sa.ForeignKey("games.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200)),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer()),
        sa.Column("helpful_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_zap_msats", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "is_verified_purchase",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "(rating BETWEEN 1 AND 5) OR rating IS NULL",
            name="ck_reviews_rating_range",
        ),
    )
    op.create_index("ix_reviews_game_id", "reviews", ["game_id"], unique=False)


def downgrade() -> None:
    """Drop the reviews table."""

    op.drop_index("ix_reviews_game_id", table_name="reviews")
    op.drop_table("reviews")
