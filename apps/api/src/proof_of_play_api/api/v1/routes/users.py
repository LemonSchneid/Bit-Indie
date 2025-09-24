"""Endpoints for managing user profile settings."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import User
from proof_of_play_api.schemas.user import UserLightningAddressUpdate, UserRead


router = APIRouter(prefix="/v1/users", tags=["users"])


@router.patch(
    "/{user_id}/lightning-address",
    response_model=UserRead,
    summary="Update Lightning payout address for a user",
)
def update_user_lightning_address(
    user_id: str,
    request: UserLightningAddressUpdate,
    session: Session = Depends(get_session),
) -> UserRead:
    """Persist the Lightning address used for developer payouts."""

    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.lightning_address = request.lightning_address
    session.flush()
    session.refresh(user)
    return UserRead.model_validate(user)


__all__ = ["update_user_lightning_address"]
