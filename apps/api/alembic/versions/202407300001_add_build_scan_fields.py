"""Add malware scan tracking fields to games."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

from proof_of_play_api.db.models import BuildScanStatus

# revision identifiers, used by Alembic.
revision = "202407300001"
down_revision = "202407250002"
branch_labels = None
depends_on = None


def _enum(values: list[str], name: str) -> sa.Enum:
    """Return a portable SQLAlchemy enum definition."""

    return sa.Enum(*values, name=name, native_enum=False)


def upgrade() -> None:
    """Add build scan status columns to the games table."""

    build_scan_enum = _enum([status.value for status in BuildScanStatus], "build_scan_status")
    bind = op.get_bind()
    build_scan_enum.create(bind, checkfirst=True)

    op.add_column(
        "games",
        sa.Column(
            "build_scan_status",
            build_scan_enum,
            nullable=False,
            server_default=BuildScanStatus.NOT_SCANNED.value,
        ),
    )
    op.add_column("games", sa.Column("build_scan_message", sa.String(length=500)))
    op.add_column("games", sa.Column("build_scanned_at", sa.DateTime(timezone=True)))



def downgrade() -> None:
    """Remove build scan tracking fields from the games table."""

    op.drop_column("games", "build_scanned_at")
    op.drop_column("games", "build_scan_message")
    op.drop_column("games", "build_scan_status")

    build_scan_enum = _enum([status.value for status in BuildScanStatus], "build_scan_status")
    bind = op.get_bind()
    build_scan_enum.drop(bind, checkfirst=True)
