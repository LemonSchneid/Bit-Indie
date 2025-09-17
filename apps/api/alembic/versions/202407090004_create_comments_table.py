"""create comments table"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202407090004"
down_revision = "202407090003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the comments table for per-game discussion."""

    op.create_table(
        "comments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("game_id", sa.String(length=36), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_comments_game_id", "comments", ["game_id"], unique=False)


def downgrade() -> None:
    """Drop the comments table."""

    op.drop_index("ix_comments_game_id", table_name="comments")
    op.drop_table("comments")

