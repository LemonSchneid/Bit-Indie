"""Update user account fields for neutral authentication."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import column, table

# revision identifiers, used by Alembic.
revision = "202408020001"
down_revision = ("202408010001_remove_release_note_features", "202408010001")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate users to the neutral account representation."""

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("account_identifier", sa.String(length=160), nullable=True))
        batch.add_column(sa.Column("email", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("password_hash", sa.String(length=255), nullable=True))
        batch.create_unique_constraint("uq_users_account_identifier", ["account_identifier"])
        batch.create_unique_constraint("uq_users_email", ["email"])

    users = table(
        "users",
        column("id", sa.String(length=36)),
        column("pubkey_hex", sa.String(length=128)),
        column("account_identifier", sa.String(length=160)),
    )
    op.execute(
        users.update()
        .where(users.c.account_identifier.is_(None))
        .values(account_identifier=users.c.pubkey_hex)
    )

    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "account_identifier",
            existing_type=sa.String(length=160),
            nullable=False,
        )
        batch.drop_constraint("users_pubkey_hex_key", type_="unique")
        batch.drop_column("pubkey_hex")
        batch.drop_column("nip05")


def downgrade() -> None:
    """Reintroduce the Nostr-specific user columns."""

    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("nip05", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("pubkey_hex", sa.String(length=128), nullable=True))
        batch.create_unique_constraint("users_pubkey_hex_key", ["pubkey_hex"])

    users = table(
        "users",
        column("id", sa.String(length=36)),
        column("account_identifier", sa.String(length=160)),
        column("pubkey_hex", sa.String(length=128)),
    )
    op.execute(
        users.update()
        .where(users.c.pubkey_hex.is_(None))
        .values(pubkey_hex=users.c.account_identifier)
    )

    with op.batch_alter_table("users") as batch:
        batch.alter_column(
            "pubkey_hex",
            existing_type=sa.String(length=128),
            nullable=False,
        )
        batch.drop_constraint("uq_users_email", type_="unique")
        batch.drop_constraint("uq_users_account_identifier", type_="unique")
        batch.drop_column("password_hash")
        batch.drop_column("email")
        batch.drop_column("account_identifier")
