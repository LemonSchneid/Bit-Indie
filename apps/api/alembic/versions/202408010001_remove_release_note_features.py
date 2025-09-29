"""Remove legacy release note tables and columns."""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202408010001_remove_release_note_features"
down_revision = "202407250002_add_release_note_reply_moderation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Drop release note persistence structures from the database."""

    with op.batch_alter_table("games") as batch_op:
        batch_op.drop_constraint("uq_games_release_note_event_id", type_="unique")
        batch_op.drop_column("release_note_published_at")
        batch_op.drop_column("release_note_event_id")

    op.drop_table("release_note_replies")
    op.drop_table("release_note_relay_checkpoints")
    op.drop_table("release_note_publish_queue")


def downgrade() -> None:
    """Recreate release note persistence structures."""

    op.create_table(
        "release_note_publish_queue",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("game_id", sa.String(length=36), nullable=False),
        sa.Column("relay_url", sa.String(length=500), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("game_id", "relay_url", name="ux_release_note_queue_game_relay"),
    )

    op.create_table(
        "release_note_relay_checkpoints",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("relay_url", sa.String(length=500), nullable=False),
        sa.Column("last_event_created_at", sa.BigInteger(), nullable=True),
        sa.Column("last_event_id", sa.String(length=128), nullable=True),
        sa.UniqueConstraint("relay_url", name="ux_release_note_relay_checkpoint_url"),
    )

    op.create_table(
        "release_note_replies",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("game_id", sa.String(length=36), nullable=False),
        sa.Column("release_note_event_id", sa.String(length=128), nullable=False),
        sa.Column("relay_url", sa.String(length=500), nullable=False),
        sa.Column("event_id", sa.String(length=128), nullable=False),
        sa.Column("pubkey", sa.String(length=128), nullable=False),
        sa.Column("kind", sa.Integer(), nullable=False),
        sa.Column("event_created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags_json", sa.Text(), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("hidden_reason", sa.String(length=64), nullable=True),
        sa.Column("moderation_notes", sa.Text(), nullable=True),
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("game_id", "event_id", name="ux_release_note_replies_game_event"),
    )

    with op.batch_alter_table("games") as batch_op:
        batch_op.add_column(sa.Column("release_note_event_id", sa.String(length=128), nullable=True))
        batch_op.add_column(sa.Column("release_note_published_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_unique_constraint(
            "uq_games_release_note_event_id", ["release_note_event_id"]
        )
