"""Add moderation metadata to release note replies."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202407250002"
down_revision = "202407250001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add moderation columns to the release note replies table."""

    hidden_reason_enum = sa.Enum(
        "AUTOMATED_FILTER",
        "ADMIN",
        name="release_note_reply_hidden_reason",
        native_enum=False,
    )

    op.add_column(
        "release_note_replies",
        sa.Column(
            "is_hidden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "release_note_replies",
        sa.Column("hidden_reason", hidden_reason_enum, nullable=True),
    )
    op.add_column(
        "release_note_replies",
        sa.Column("moderation_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "release_note_replies",
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_release_note_replies_is_hidden",
        "release_note_replies",
        ["is_hidden"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the moderation metadata columns from release note replies."""

    op.drop_index(
        "ix_release_note_replies_is_hidden",
        table_name="release_note_replies",
    )
    op.drop_column("release_note_replies", "hidden_at")
    op.drop_column("release_note_replies", "moderation_notes")
    op.drop_column("release_note_replies", "hidden_reason")
    op.drop_column("release_note_replies", "is_hidden")
    hidden_reason_enum = sa.Enum(
        name="release_note_reply_hidden_reason",
        native_enum=False,
    )
    hidden_reason_enum.drop(op.get_bind(), checkfirst=False)
