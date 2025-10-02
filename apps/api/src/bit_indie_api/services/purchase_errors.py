"""Custom exceptions for purchase lifecycle operations."""

from __future__ import annotations

from fastapi import status


class PurchaseWorkflowError(RuntimeError):
    """Base error raised when purchase workflow operations fail validation."""

    def __init__(self, detail: str, *, status_code: int) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class MissingLookupIdentifierError(PurchaseWorkflowError):
    """Raised when a purchase lookup omits both user and anon identifiers."""

    def __init__(self) -> None:
        super().__init__(
            "Provide user_id or anon_id to look up purchases.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class GuestLookupError(PurchaseWorkflowError):
    """Raised when resolving a guest identifier fails validation."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail, status_code=status.HTTP_400_BAD_REQUEST)


class PurchaseNotFoundError(PurchaseWorkflowError):
    """Raised when the referenced purchase record cannot be located."""

    def __init__(self) -> None:
        super().__init__("Purchase not found.", status_code=status.HTTP_404_NOT_FOUND)


class PurchasePermissionError(PurchaseWorkflowError):
    """Raised when a user attempts to act on a purchase they do not own."""

    def __init__(self) -> None:
        super().__init__(
            "You do not have permission to access this purchase.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class PurchaseNotDownloadableError(PurchaseWorkflowError):
    """Raised when a purchase is not yet eligible for download access."""

    def __init__(self) -> None:
        super().__init__(
            "Purchase is not eligible for download.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class PurchaseBuildUnavailableError(PurchaseWorkflowError):
    """Raised when the associated game lacks a downloadable build."""

    def __init__(self) -> None:
        super().__init__(
            "Game build is not available for download.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class PurchaseNotRefundableError(PurchaseWorkflowError):
    """Raised when a purchase fails the prerequisites for requesting a refund."""

    def __init__(self, detail: str = "Only paid purchases can be refunded.") -> None:
        super().__init__(detail, status_code=status.HTTP_400_BAD_REQUEST)


class PaymentProviderUnavailableError(PurchaseWorkflowError):
    """Raised when the Lightning provider returns an error response."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail, status_code=status.HTTP_502_BAD_GATEWAY)


__all__ = [
    "GuestLookupError",
    "MissingLookupIdentifierError",
    "PaymentProviderUnavailableError",
    "PurchaseBuildUnavailableError",
    "PurchaseNotDownloadableError",
    "PurchaseNotFoundError",
    "PurchaseNotRefundableError",
    "PurchasePermissionError",
    "PurchaseWorkflowError",
]
