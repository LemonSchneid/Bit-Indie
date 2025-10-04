"""Create community forum tables."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202410030001"
down_revision = "202408050001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create tables to support the community forum."""

    op.create_table(
        "community_threads",
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
            "author_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("body_md", sa.Text(), nullable=True),
        sa.Column(
            "is_pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "is_locked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_community_threads_author_id",
        "community_threads",
        ["author_id"],
        unique=False,
    )
    op.create_index(
        "ix_community_threads_is_pinned",
        "community_threads",
        ["is_pinned"],
        unique=False,
    )

    op.create_table(
        "community_thread_tags",
        sa.Column("thread_id", sa.String(length=36), primary_key=True),
        sa.Column("tag", sa.String(length=40), primary_key=True),
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
        sa.ForeignKeyConstraint(["thread_id"], ["community_threads.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "community_posts",
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
            "thread_id",
            sa.String(length=36),
            sa.ForeignKey("community_threads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_post_id",
            sa.String(length=36),
            sa.ForeignKey("community_posts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "author_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body_md", sa.Text(), nullable=False),
        sa.Column(
            "is_removed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.create_index(
        "ix_community_posts_thread_id",
        "community_posts",
        ["thread_id"],
        unique=False,
    )
    op.create_index(
        "ix_community_posts_parent_post_id",
        "community_posts",
        ["parent_post_id"],
        unique=False,
    )
    op.create_index(
        "ix_community_posts_author_id",
        "community_posts",
        ["author_id"],
        unique=False,
    )
    op.create_index(
        "ix_community_posts_is_removed",
        "community_posts",
        ["is_removed"],
        unique=False,
    )


def downgrade() -> None:
    """Drop community forum tables."""

    op.drop_index("ix_community_posts_is_removed", table_name="community_posts")
    op.drop_index("ix_community_posts_author_id", table_name="community_posts")
    op.drop_index("ix_community_posts_parent_post_id", table_name="community_posts")
    op.drop_index("ix_community_posts_thread_id", table_name="community_posts")
    op.drop_table("community_posts")

    op.drop_table("community_thread_tags")

    op.drop_index("ix_community_threads_is_pinned", table_name="community_threads")
    op.drop_index("ix_community_threads_author_id", table_name="community_threads")
    op.drop_table("community_threads")

