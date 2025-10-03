"""Tests covering payment service behaviour when configuration is absent."""

from __future__ import annotations

import pytest

from bit_indie_api.core.config import clear_payment_settings_cache
from bit_indie_api.services.payments import (
    PaymentServiceError,
    get_payment_service,
    reset_payment_service,
)


def test_get_payment_service_returns_disabled_stub_when_env_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Missing Lightning env vars should surface a clear PaymentServiceError."""

    monkeypatch.delenv("OPENNODE_API_KEY", raising=False)
    monkeypatch.delenv("OPENNODE_TREASURY_WALLET", raising=False)
    clear_payment_settings_cache()
    reset_payment_service()

    try:
        service = get_payment_service()
        with pytest.raises(PaymentServiceError) as excinfo:
            service.create_invoice(
                amount_msats=1000,
                memo="dev-test",
                webhook_url="https://example.invalid/webhook",
            )
        assert "Lightning payments are disabled" in str(excinfo.value)
    finally:
        reset_payment_service()
        clear_payment_settings_cache()
