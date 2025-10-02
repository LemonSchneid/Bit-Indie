"""Endpoints related to developer profile management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from bit_indie_api.api.security import require_authenticated_user_id
from bit_indie_api.db import get_session
from bit_indie_api.db.models import Developer, User
from bit_indie_api.schemas.developer import DeveloperCreateRequest, DeveloperRead


router = APIRouter(prefix="/v1/devs", tags=["developers"])


@router.get(
    "/{user_id}",
    response_model=DeveloperRead,
    summary="Fetch the developer profile for a user",
)
def get_developer_profile(
    user_id: str,
    session: Session = Depends(get_session),
    authenticated_user_id: str = Depends(require_authenticated_user_id),
) -> DeveloperRead:
    """Return the developer profile owned by the authenticated user."""

    if authenticated_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this developer profile.",
        )

    statement = select(Developer).where(Developer.user_id == user_id)
    profile = session.execute(statement).scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Developer profile not found.")

    return DeveloperRead.model_validate(profile)


@router.post(
    "",
    response_model=DeveloperRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create or update developer profile",
)
def create_or_update_developer_profile(
    request: DeveloperCreateRequest,
    response: Response,
    session: Session = Depends(get_session),
    authenticated_user_id: str = Depends(require_authenticated_user_id),
) -> DeveloperRead:
    """Create a developer profile for the given user or update the existing one."""

    if authenticated_user_id != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this developer profile.",
        )

    user = session.get(User, request.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    profile = user.developer_profile
    if profile is None:
        profile = Developer(
            user_id=user.id,
            profile_url=request.profile_url,
            contact_email=request.contact_email,
        )
        session.add(profile)
        session.flush()
    else:
        response.status_code = status.HTTP_200_OK
        profile.profile_url = request.profile_url
        profile.contact_email = request.contact_email

    session.refresh(profile)
    return DeveloperRead.model_validate(profile)

