"""Add release note relay checkpoints and replies tables."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202407200002"
down_revision = "202407200001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply schema changes required for release note reply ingestion."""

    op.create_table(
        "release_note_relay_checkpoints",
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
        sa.Column("relay_url", sa.String(length=500), nullable=False),
        sa.Column("last_event_created_at", sa.BigInteger(), nullable=True),
        sa.Column("last_event_id", sa.String(length=128), nullable=True),
        sa.UniqueConstraint("relay_url", name="ux_release_note_relay_checkpoint_url"),
    )

    op.create_table(
        "release_note_replies",
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
        sa.Column("game_id", sa.String(length=36), nullable=False),
        sa.Column("release_note_event_id", sa.String(length=128), nullable=False),
        sa.Column("relay_url", sa.String(length=500), nullable=False),
        sa.Column("event_id", sa.String(length=128), nullable=False),
        sa.Column("pubkey", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.Integer(), nullable=False),
        sa.Column("event_created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags_json", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("game_id", "event_id", name="ux_release_note_replies_game_event"),
    )
    op.create_index(
        "ix_release_note_replies_game_id",
        "release_note_replies",
        ["game_id"],
    )
    op.create_index(
        "ix_release_note_replies_release_note_event_id",
        "release_note_replies",
        ["release_note_event_id"],
    )


def downgrade() -> None:
    """Revert schema changes required for release note reply ingestion."""

    op.drop_index(
        "ix_release_note_replies_release_note_event_id",
        table_name="release_note_replies",
    )
    op.drop_index(
        "ix_release_note_replies_game_id",
        table_name="release_note_replies",
    )
    op.drop_table("release_note_replies")
    op.drop_table("release_note_relay_checkpoints")
