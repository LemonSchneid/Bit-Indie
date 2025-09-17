"""Endpoints related to developer profile management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from proof_of_play_api.db import get_session
from proof_of_play_api.db.models import Developer, User
from proof_of_play_api.schemas.developer import DeveloperCreateRequest, DeveloperRead


router = APIRouter(prefix="/v1/devs", tags=["developers"])


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
) -> DeveloperRead:
    """Create a developer profile for the given user or update the existing one."""

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

