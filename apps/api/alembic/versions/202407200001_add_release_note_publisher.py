"""Add tables and fields for the release note publisher pipeline."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "202407200001"
down_revision = "202407150002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply the release note publisher schema additions."""

    op.add_column(
        "games",
        sa.Column("release_note_event_id", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "games",
        sa.Column("release_note_published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_games_release_note_event_id",
        "games",
        ["release_note_event_id"],
    )

    op.create_table(
        "release_note_publish_queue",
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
        sa.Column("relay_url", sa.String(length=500), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column(
            "attempts",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("game_id", "relay_url", name="ux_release_note_queue_game_relay"),
    )
    op.create_index(
        "ix_release_note_publish_queue_game_id",
        "release_note_publish_queue",
        ["game_id"],
    )


def downgrade() -> None:
    """Revert the release note publisher schema additions."""

    op.drop_index(
        "ix_release_note_publish_queue_game_id",
        table_name="release_note_publish_queue",
    )
    op.drop_table("release_note_publish_queue")
    op.drop_constraint(
        "uq_games_release_note_event_id",
        "games",
        type_="unique",
    )
    op.drop_column("games", "release_note_published_at")
    op.drop_column("games", "release_note_event_id")
