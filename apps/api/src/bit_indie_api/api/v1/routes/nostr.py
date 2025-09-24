"""Routes for ingesting Nostr relay events."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from bit_indie_api.db import get_session
from bit_indie_api.schemas.zap import (
    ZapReceiptIngestRequest,
    ZapReceiptResponse,
)
from bit_indie_api.services.nostr import SignatureVerificationError
from bit_indie_api.services.zaps import (
    InvalidZapReceiptError,
    ZapAlreadyProcessedError,
    ZapTargetNotFoundError,
    ingest_zap_receipt,
)


router = APIRouter(prefix="/v1/nostr", tags=["nostr"])


@router.post(
    "/zap-receipts",
    response_model=ZapReceiptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a zap receipt event",
)
def receive_zap_receipt(
    request: ZapReceiptIngestRequest,
    session: Session = Depends(get_session),
) -> ZapReceiptResponse:
    """Store a zap receipt and update the referenced review."""

    try:
        zap, review = ingest_zap_receipt(session=session, event=request.event)
    except InvalidZapReceiptError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SignatureVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature verification failed.",
        ) from exc
    except ZapTargetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ZapAlreadyProcessedError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return ZapReceiptResponse(zap=zap, review=review)


__all__ = ["receive_zap_receipt"]
