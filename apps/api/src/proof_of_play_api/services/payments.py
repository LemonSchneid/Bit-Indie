"""Integrations for creating and reconciling Lightning invoices via LNbits."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Mapping, Protocol

import httpx

from proof_of_play_api.core.config import LnBitsSettings, get_payment_settings


class PaymentServiceError(RuntimeError):
    """Raised when the payment provider returns an error response."""


class _HttpResponse(Protocol):
    """Protocol describing the subset of HTTP responses this module relies on."""

    status_code: int
    text: str

    def json(self) -> Any:
        """Return the decoded JSON payload from the response."""


class _HttpClient(Protocol):
    """Protocol describing the HTTP client interface required by the service."""

    def post(self, url: str, *, json: Mapping[str, Any], headers: Mapping[str, str], timeout: float) -> _HttpResponse:
        """Send a POST request returning the provider's response."""

    def get(self, url: str, *, headers: Mapping[str, str], timeout: float) -> _HttpResponse:
        """Send a GET request returning the provider's response."""


@dataclass(frozen=True)
class CreatedInvoice:
    """Representation of a freshly created Lightning invoice."""

    invoice_id: str
    payment_request: str
    checking_id: str | None


@dataclass(frozen=True)
class InvoiceStatus:
    """Observed state for a previously issued Lightning invoice."""

    paid: bool
    pending: bool
    amount_msats: int | None


class PaymentService:
    """Business logic for interacting with LNbits invoices."""

    def __init__(
        self,
        *,
        client: _HttpClient,
        settings: LnBitsSettings,
        request_timeout: float = 10.0,
    ) -> None:
        self._client = client
        self._settings = settings
        self._base_url = settings.api_url.rstrip("/")
        self._timeout = request_timeout

    def create_invoice(
        self,
        *,
        amount_msats: int,
        memo: str,
        webhook_url: str,
    ) -> CreatedInvoice:
        """Create an invoice for the supplied milli-satoshi amount."""

        if amount_msats <= 0:
            msg = "Invoice amount must be greater than zero."
            raise PaymentServiceError(msg)
        if amount_msats % 1000 != 0:
            msg = "Invoice amount must be divisible by 1,000 msats."
            raise PaymentServiceError(msg)

        amount_sats = amount_msats // 1000
        payload = {
            "out": False,
            "amount": amount_sats,
            "unit": "sat",
            "memo": memo,
            "webhook": webhook_url,
        }
        response = self._client.post(
            f"{self._base_url}/payments",
            json=payload,
            headers=self._build_headers(),
            timeout=self._timeout,
        )
        data = self._parse_json_response(response)

        try:
            invoice_id = str(data["payment_hash"])
            payment_request = str(data["payment_request"])
        except KeyError as exc:  # pragma: no cover - defensive guard
            msg = "LNbits response missing payment hash or payment request."
            raise PaymentServiceError(msg) from exc

        checking_id = data.get("checking_id") or data.get("id")
        checking_value = str(checking_id) if checking_id is not None else None
        return CreatedInvoice(
            invoice_id=invoice_id,
            payment_request=payment_request,
            checking_id=checking_value,
        )

    def get_invoice_status(self, *, invoice_id: str) -> InvoiceStatus:
        """Return the provider reported state for the supplied invoice."""

        response = self._client.get(
            f"{self._base_url}/payments/{invoice_id}",
            headers=self._build_headers(),
            timeout=self._timeout,
        )
        data = self._parse_json_response(response)
        paid = self._extract_bool(data, "paid", default=False)
        pending = self._extract_bool(data, "pending", default=not paid)
        amount_msats = self._extract_amount_msats(data)
        return InvoiceStatus(paid=paid, pending=pending, amount_msats=amount_msats)

    def _build_headers(self) -> dict[str, str]:
        """Return headers required for authenticated LNbits requests."""

        return {
            "X-Api-Key": self._settings.api_key,
            "X-Client": "proof-of-play-api",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @staticmethod
    def _parse_json_response(response: _HttpResponse) -> Mapping[str, Any]:
        """Decode JSON from a provider response while handling errors."""

        if response.status_code >= 400:
            msg = (
                "LNbits request failed with status "
                f"{response.status_code}: {response.text.strip()}"
            )
            raise PaymentServiceError(msg)
        try:
            payload = response.json()
        except Exception as exc:  # pragma: no cover - defensive guard
            msg = "LNbits response could not be decoded as JSON."
            raise PaymentServiceError(msg) from exc
        if not isinstance(payload, Mapping):
            msg = "LNbits response JSON must be an object."
            raise PaymentServiceError(msg)
        return payload

    @staticmethod
    def _extract_bool(data: Mapping[str, Any], key: str, *, default: bool) -> bool:
        """Read a boolean value from the response with fallbacks."""

        value = data.get(key)
        if isinstance(value, bool):
            return value
        details = data.get("details")
        if isinstance(details, Mapping):
            nested = details.get(key)
            if isinstance(nested, bool):
                return nested
        return default

    @staticmethod
    def _extract_amount_msats(data: Mapping[str, Any]) -> int | None:
        """Extract a milli-satoshi amount from the provider payload when present."""

        candidates = []
        for container in (data, data.get("details") if isinstance(data.get("details"), Mapping) else {}):
            if not isinstance(container, Mapping):
                continue
            for key in ("amount_msat", "amount"):
                raw_value = container.get(key)
                if raw_value is None:
                    continue
                try:
                    amount = int(raw_value)
                except (TypeError, ValueError):  # pragma: no cover - defensive guard
                    continue
                candidates.append(abs(amount))
        if not candidates:
            return None
        return candidates[0]


@lru_cache(maxsize=1)
def get_payment_service() -> PaymentService:
    """Return a cached `PaymentService` configured from environment variables."""

    settings = get_payment_settings().lnbits
    return PaymentService(client=httpx, settings=settings)


def reset_payment_service() -> None:
    """Clear the cached payment service. Intended for use in tests."""

    get_payment_service.cache_clear()


__all__ = [
    "CreatedInvoice",
    "InvoiceStatus",
    "PaymentService",
    "PaymentServiceError",
    "get_payment_service",
    "reset_payment_service",
]
