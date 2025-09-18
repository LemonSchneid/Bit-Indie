"""Create table for manual refund payout records."""

from alembic import op
import sqlalchemy as sa


revision = "202407150001"
down_revision = "202407090001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the refund_payouts table used to log manual refunds."""

    op.create_table(
        "refund_payouts",
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
            "purchase_id",
            sa.String(length=36),
            sa.ForeignKey("purchases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "processed_by_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("amount_msats", sa.BigInteger(), nullable=True),
        sa.Column("payment_reference", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "amount_msats IS NULL OR amount_msats >= 0",
            name="ck_refund_payouts_amount_msats_positive",
        ),
    )
    op.create_index(
        "ix_refund_payouts_purchase_id",
        "refund_payouts",
        ["purchase_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the refund_payouts table."""

    op.drop_index("ix_refund_payouts_purchase_id", table_name="refund_payouts")
    op.drop_table("refund_payouts")
