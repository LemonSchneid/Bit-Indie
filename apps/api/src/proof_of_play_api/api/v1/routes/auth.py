"""Routes powering the Nostr-based authentication workflow."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.core.config import get_settings
from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import User
from proof_of_play_api.schemas.auth import (
    LoginChallengeResponse,
    LoginSuccessResponse,
    LoginVerifyRequest,
)
from proof_of_play_api.schemas.user import UserRead
from proof_of_play_api.services.auth import (
    ChallengeExpiredError,
    ChallengeNotFoundError,
    extract_challenge_value,
    get_login_challenge_store,
)
from proof_of_play_api.services.nostr import (
    InvalidNostrEventError,
    SignatureVerificationError,
    verify_signed_event,
)
from proof_of_play_api.services.session_tokens import create_session_token


router = APIRouter(prefix="/v1/auth", tags=["auth"])

LOGIN_EVENT_KIND = 22242
TIMESTAMP_SKEW = timedelta(seconds=120)


@router.post("/challenge", response_model=LoginChallengeResponse, summary="Issue login challenge")
async def issue_login_challenge() -> LoginChallengeResponse:
    """Create a new challenge for a client to sign via NIP-07."""

    store = get_login_challenge_store()
    challenge = store.issue()
    return LoginChallengeResponse(
        challenge=challenge.value,
        issued_at=challenge.issued_at,
        expires_at=challenge.expires_at,
    )


@router.post("/verify", response_model=LoginSuccessResponse, summary="Verify signed challenge")
async def verify_login(
    request: LoginVerifyRequest,
    session: Session = Depends(get_session),
) -> LoginSuccessResponse:
    """Validate a signed challenge and upsert the corresponding user."""

    event = request.event

    if event.kind != LOGIN_EVENT_KIND:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported event kind for login.")

    challenge_value = extract_challenge_value(event.tags)
    if challenge_value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signed event is missing a challenge tag.",
        )

    store = get_login_challenge_store()
    try:
        challenge = store.get(challenge_value)
    except ChallengeNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge not found. Request a new login attempt.",
        ) from exc
    except ChallengeExpiredError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge expired. Request a new login attempt.",
        ) from exc

    event_timestamp = datetime.fromtimestamp(event.created_at, tz=timezone.utc)
    if event_timestamp < challenge.issued_at - TIMESTAMP_SKEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event timestamp predates issued challenge.",
        )
    if event_timestamp > challenge.expires_at + TIMESTAMP_SKEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event timestamp falls outside the allowed window.",
        )

    try:
        verify_signed_event(event)
    except InvalidNostrEventError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signature verification failed.") from exc

    try:
        store.consume(challenge_value)
    except ChallengeNotFoundError as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge not found. Request a new login attempt.",
        ) from exc
    except ChallengeExpiredError as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge expired. Request a new login attempt.",
        ) from exc

    user = _get_or_create_user(session=session, pubkey_hex=event.pubkey)
    settings = get_settings()
    session_token = create_session_token(
        user_id=user.id,
        secret=settings.session_secret,
        ttl_seconds=settings.session_ttl_seconds,
    )
    return LoginSuccessResponse(
        user=UserRead.model_validate(user),
        session_token=session_token,
    )


def _get_or_create_user(*, session: Session, pubkey_hex: str) -> User:
    """Fetch an existing user or persist a new one for the given pubkey."""

    stmt = select(User).where(User.pubkey_hex == pubkey_hex)
    user = session.scalar(stmt)
    if user is not None:
        return user

    user = User(pubkey_hex=pubkey_hex)
    session.add(user)
    session.flush()
    session.refresh(user)
    return user

