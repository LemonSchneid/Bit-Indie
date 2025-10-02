from __future__ import annotations

from datetime import datetime, timezone
import uuid

import pytest

from sqlalchemy import select

from bit_indie_api.db import Base, get_engine, reset_database_state, session_scope
from bit_indie_api.db.models import DownloadAuditLog, Game, InvoiceStatus, Purchase, User
from bit_indie_api.services.purchase_downloads import PurchaseDownloadManager
from bit_indie_api.services.purchase_errors import (
    PurchaseBuildUnavailableError,
    PurchaseNotDownloadableError,
)
from bit_indie_api.services.storage import PresignedDownload


class _StubStorage:
    """Test double that records download requests."""

    def __init__(self) -> None:
        self.object_keys: list[str] = []
        self.response = PresignedDownload(
            url="https://example.com/build.zip",
            expires_at=datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc),
        )

    def create_presigned_download(self, *, object_key: str) -> PresignedDownload:
        self.object_keys.append(object_key)
        return self.response


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run each test against an isolated in-memory database."""

    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    reset_database_state()
    yield
    reset_database_state()


def _create_schema() -> None:
    """Create the ORM schema for the temporary SQLite database."""

    engine = get_engine()
    Base.metadata.create_all(engine)


def _create_game_with_purchase(session) -> Purchase:
    """Persist a user, game, and paid purchase for download tests."""

    user = User(account_identifier="download-user")
    session.add(user)
    session.flush()

    game = Game(
        developer_id=user.id,
        title="Downloadable",
        slug="downloadable",
        price_msats=5_000,
        build_object_key="games/downloadable.zip",
    )
    session.add(game)
    session.flush()

    purchase = Purchase(
        user_id=user.id,
        game_id=game.id,
        invoice_id=f"inv-{uuid.uuid4().hex}",
        invoice_status=InvoiceStatus.PAID,
        download_granted=True,
    )
    session.add(purchase)
    session.flush()
    return purchase


def test_ensure_downloadable_rejects_unpaid_purchase() -> None:
    """The download manager should guard against unpaid purchases."""

    _create_schema()
    with session_scope() as session:
        purchase = _create_game_with_purchase(session)
        purchase.invoice_status = InvoiceStatus.PENDING
        purchase.download_granted = False

        manager = PurchaseDownloadManager(session=session, storage=_StubStorage())

        with pytest.raises(PurchaseNotDownloadableError):
            manager.ensure_downloadable(purchase)


def test_create_download_logs_access() -> None:
    """Creating a download should hit storage and persist an audit row."""

    _create_schema()
    with session_scope() as session:
        purchase = _create_game_with_purchase(session)
        manager = PurchaseDownloadManager(session=session, storage=_StubStorage())

        manager.ensure_downloadable(purchase)
        download = manager.create_download(purchase=purchase)

        assert download.url.endswith("build.zip")
        audit = session.scalars(
            select(DownloadAuditLog).where(DownloadAuditLog.purchase_id == purchase.id)
        ).one()
        assert audit.object_key == "games/downloadable.zip"
        assert audit.expires_at == download.expires_at.replace(tzinfo=None)


def test_create_download_requires_build_object() -> None:
    """An audit entry cannot be created when the game lacks a build."""

    _create_schema()
    with session_scope() as session:
        purchase = _create_game_with_purchase(session)
        purchase.game.build_object_key = None

        manager = PurchaseDownloadManager(session=session, storage=_StubStorage())
        manager.ensure_downloadable(purchase)

        with pytest.raises(PurchaseBuildUnavailableError):
            manager.create_download(purchase=purchase)
