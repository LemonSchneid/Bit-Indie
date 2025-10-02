"""Authentication endpoints for first-party email/password accounts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status

from bit_indie_api.api.security import require_authenticated_user_id
from bit_indie_api.schemas.auth import (
    AccountLoginRequest,
    AccountSessionResponse,
    AccountSignupRequest,
)
from bit_indie_api.schemas.user import UserRead
from bit_indie_api.services.accounts import (
    AccountService,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    UserNotFoundError,
    get_account_service,
)


router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/signup", response_model=AccountSessionResponse, status_code=status.HTTP_201_CREATED)
def sign_up(
    request: AccountSignupRequest,
    accounts: AccountService = Depends(get_account_service),
) -> AccountSessionResponse:
    """Register a new account and return the initial session token."""

    try:
        user = accounts.register_user(
            email=request.email,
            password=request.password,
            display_name=request.display_name,
        )
    except EmailAlreadyRegisteredError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered.") from None

    token = accounts.issue_session_token(user=user)
    return AccountSessionResponse(user=UserRead.model_validate(user), session_token=token)


@router.post("/login", response_model=AccountSessionResponse)
def login(
    request: AccountLoginRequest,
    accounts: AccountService = Depends(get_account_service),
) -> AccountSessionResponse:
    """Authenticate a user by email and password."""

    try:
        user = accounts.authenticate_user(email=request.email, password=request.password)
    except InvalidCredentialsError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.") from None

    token = accounts.issue_session_token(user=user)
    return AccountSessionResponse(user=UserRead.model_validate(user), session_token=token)


@router.post("/refresh", response_model=AccountSessionResponse)
def refresh_session(
    authenticated_user_id: str = Depends(require_authenticated_user_id),
    accounts: AccountService = Depends(get_account_service),
) -> AccountSessionResponse:
    """Issue a new session token for the authenticated user."""

    try:
        user = accounts.get_user_by_id(user_id=authenticated_user_id)
    except UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from None

    token = accounts.issue_session_token(user=user)
    return AccountSessionResponse(user=UserRead.model_validate(user), session_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: str = Depends(require_authenticated_user_id)) -> Response:
    """Acknowledge the logout request allowing clients to clear local sessions."""

    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["login", "logout", "refresh_session", "sign_up"]
