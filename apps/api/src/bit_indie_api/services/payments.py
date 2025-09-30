"""Integrations for creating invoices and payouts via OpenNode."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Mapping, Protocol

import httpx

from bit_indie_api.core.config import OpenNodeSettings, get_payment_settings


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
    hosted_checkout_url: str | None = None


@dataclass(frozen=True)
class InvoiceStatus:
    """Observed state for a previously issued Lightning invoice."""

    paid: bool
    pending: bool
    amount_msats: int | None


@dataclass(frozen=True)
class PayoutResult:
    """Representation of a payout initiated through the Lightning provider."""

    payout_id: str
    status: str
    amount_msats: int


class PaymentService:
    """Business logic for interacting with OpenNode charges and payouts."""

    def __init__(
        self,
        *,
        client: _HttpClient,
        settings: OpenNodeSettings,
        request_timeout: float = 10.0,
    ) -> None:
        self._client = client
        self._settings = settings
        self._base_url = settings.api_base_url.rstrip("/")
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
            "amount": amount_sats,
            "callback_url": webhook_url,
            "description": memo,
            "auto_settle": False,
        }
        response = self._client.post(
            f"{self._base_url}/v1/invoices",
            json=payload,
            headers=self._build_headers(),
            timeout=self._timeout,
        )
        data = self._extract_data_object(response)

        try:
            invoice_id = str(data["id"])
            payment_request = self._extract_invoice_request(data)
        except KeyError as exc:  # pragma: no cover - defensive guard
            msg = "OpenNode response missing invoice identifier or payment request."
            raise PaymentServiceError(msg) from exc

        checking_id = data.get("id")
        checking_value = str(checking_id) if checking_id is not None else None
        hosted_checkout = data.get("hosted_checkout_url") or data.get("uri")
        hosted_checkout_value = str(hosted_checkout) if hosted_checkout else None
        return CreatedInvoice(
            invoice_id=invoice_id,
            payment_request=payment_request,
            checking_id=checking_value,
            hosted_checkout_url=hosted_checkout_value,
        )

    def get_invoice_status(self, *, invoice_id: str) -> InvoiceStatus:
        """Return the provider reported state for the supplied invoice."""

        response = self._client.get(
            f"{self._base_url}/v1/invoices/{invoice_id}",
            headers=self._build_headers(),
            timeout=self._timeout,
        )
        data = self._extract_data_object(response)
        status_value = str(data.get("status", ""))
        normalized_status = status_value.lower()
        paid = normalized_status == "paid"
        pending = normalized_status in {"processing", "pending", "unpaid"} and not paid
        amount_msats = self._extract_amount_msats(data)
        return InvoiceStatus(paid=paid, pending=pending, amount_msats=amount_msats)

    def send_payout(
        self,
        *,
        amount_msats: int,
        lightning_address: str,
        memo: str | None = None,
    ) -> PayoutResult:
        """Send a Lightning payout to the supplied address via OpenNode."""

        normalized_address = lightning_address.strip()
        if not normalized_address:
            msg = "Lightning address is required for payouts."
            raise PaymentServiceError(msg)
        if amount_msats <= 0:
            msg = "Payout amount must be greater than zero."
            raise PaymentServiceError(msg)
        if amount_msats % 1000 != 0:
            msg = "Payout amount must be divisible by 1,000 msats."
            raise PaymentServiceError(msg)

        amount_sats = amount_msats // 1000
        payload: dict[str, Any] = {
            "type": "lnurl",
            "address": normalized_address,
            "amount": amount_sats,
        }
        if memo:
            payload["memo"] = memo

        response = self._client.post(
            f"{self._base_url}/v1/withdrawals",
            json=payload,
            headers=self._build_headers(),
            timeout=self._timeout,
        )
        data = self._extract_data_object(response)

        payout_id = str(
            data.get("id")
            or data.get("withdrawal_id")
            or data.get("reference")
            or data.get("identifier")
        )
        status_value = str(data.get("status", "pending"))
        return PayoutResult(payout_id=payout_id, status=status_value, amount_msats=amount_msats)

    @property
    def treasury_wallet_address(self) -> str:
        """Return the configured treasury Lightning address."""

        return self._settings.treasury_wallet_address

    def _build_headers(self) -> dict[str, str]:
        """Return headers required for authenticated OpenNode requests."""

        return {
            "Authorization": self._settings.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _extract_data_object(self, response: _HttpResponse) -> Mapping[str, Any]:
        """Decode JSON from a provider response while handling errors."""

        payload = self._parse_json_response(response)
        data = payload.get("data")
        if isinstance(data, Mapping):
            return data
        if isinstance(payload, Mapping):
            return payload
        msg = "OpenNode response payload was not an object."
        raise PaymentServiceError(msg)

    @staticmethod
    def _parse_json_response(response: _HttpResponse) -> Mapping[str, Any]:
        """Decode the raw JSON body into a mapping."""

        if response.status_code >= 400:
            msg = (
                "OpenNode request failed with status "
                f"{response.status_code}: {response.text.strip()}"
            )
            raise PaymentServiceError(msg)
        try:
            payload = response.json()
        except Exception as exc:  # pragma: no cover - defensive guard
            msg = "OpenNode response could not be decoded as JSON."
            raise PaymentServiceError(msg) from exc
        if not isinstance(payload, Mapping):
            msg = "OpenNode response JSON must be an object."
            raise PaymentServiceError(msg)
        return payload

    @staticmethod
    def _extract_invoice_request(data: Mapping[str, Any]) -> str:
        """Return the Lightning payment request from the provider payload."""

        candidates = (
            data.get("payment_request"),
            data.get("lightning_invoice"),
            data.get("ln_invoice"),
            data.get("invoice"),
        )
        for candidate in candidates:
            if isinstance(candidate, str) and candidate.strip():
                return candidate
        msg = "OpenNode response did not include a Lightning payment request."
        raise PaymentServiceError(msg)

    @staticmethod
    def _extract_amount_msats(data: Mapping[str, Any]) -> int | None:
        """Extract a milli-satoshi amount from the provider payload when present."""

        candidates = []
        for container in (
            data,
            data.get("details") if isinstance(data.get("details"), Mapping) else {},
        ):
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

    settings = get_payment_settings().opennode
    return PaymentService(client=httpx, settings=settings)


def reset_payment_service() -> None:
    """Clear the cached payment service. Intended for use in tests."""

    get_payment_service.cache_clear()


__all__ = [
    "CreatedInvoice",
    "InvoiceStatus",
    "PaymentService",
    "PaymentServiceError",
    "PayoutResult",
    "get_payment_service",
    "reset_payment_service",
]
