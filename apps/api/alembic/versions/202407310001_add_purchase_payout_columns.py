"""Add payout tracking fields to purchases."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from proof_of_play_api.db.models import PayoutStatus

# revision identifiers, used by Alembic.
revision = "202407310001"
down_revision = "202407300001"
branch_labels = None
depends_on = None


def _enum(values: list[str], name: str) -> sa.Enum:
    """Return a portable SQLAlchemy enum definition."""

    return sa.Enum(*values, name=name, native_enum=False)


def upgrade() -> None:
    """Add payout tracking columns to the purchases table."""

    payout_enum = _enum([status.value for status in PayoutStatus], "payout_status")
    bind = op.get_bind()
    payout_enum.create(bind, checkfirst=True)

    op.add_column(
        "purchases",
        sa.Column(
            "developer_payout_status",
            payout_enum,
            nullable=False,
            server_default=PayoutStatus.PENDING.value,
        ),
    )
    op.add_column("purchases", sa.Column("developer_payout_reference", sa.String(length=120)))
    op.add_column("purchases", sa.Column("developer_payout_error", sa.String(length=500)))
    op.add_column(
        "purchases",
        sa.Column(
            "platform_payout_status",
            payout_enum,
            nullable=False,
            server_default=PayoutStatus.PENDING.value,
        ),
    )
    op.add_column("purchases", sa.Column("platform_payout_reference", sa.String(length=120)))
    op.add_column("purchases", sa.Column("platform_payout_error", sa.String(length=500)))


def downgrade() -> None:
    """Remove payout tracking columns from the purchases table."""

    op.drop_column("purchases", "platform_payout_error")
    op.drop_column("purchases", "platform_payout_reference")
    op.drop_column("purchases", "platform_payout_status")
    op.drop_column("purchases", "developer_payout_error")
    op.drop_column("purchases", "developer_payout_reference")
    op.drop_column("purchases", "developer_payout_status")

    payout_enum = _enum([status.value for status in PayoutStatus], "payout_status")
    bind = op.get_bind()
    payout_enum.drop(bind, checkfirst=True)
