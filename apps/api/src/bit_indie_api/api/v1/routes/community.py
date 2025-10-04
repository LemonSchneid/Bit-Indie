"""Community forum endpoints for threads, posts, and tags."""

from __future__ import annotations

from functools import lru_cache
from typing import Sequence

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from bit_indie_api.db import get_session
from bit_indie_api.schemas.community import (
    CommunityPost,
    CommunityPostCreateRequest,
    CommunityPostModerationRequest,
    CommunityTagSummary,
    CommunityThreadCreateRequest,
    CommunityThreadDetail,
    CommunityThreadSummary,
)
from bit_indie_api.services.community_forum import (
    CommunityForumService,
    CommunityPermissionError,
    CommunityPostNotFoundError,
    CommunityThreadLockedError,
    CommunityThreadNotFoundError,
    CommunityUserNotFoundError,
    CommunityValidationError,
)


router = APIRouter(prefix="/v1/community", tags=["community"])


@lru_cache(maxsize=1)
def _build_forum_service() -> CommunityForumService:
    return CommunityForumService()


def get_forum_service() -> CommunityForumService:
    return _build_forum_service()


@router.get("/threads", response_model=list[CommunityThreadSummary], summary="List community threads")
def list_threads(
    *,
    session: Session = Depends(get_session),
    forum_service: CommunityForumService = Depends(get_forum_service),
    tag: Sequence[str] = Query(default=()),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
) -> list[CommunityThreadSummary]:
    dtos = forum_service.list_threads(
        session=session,
        tags=list(tag) if tag else None,
        limit=limit,
        offset=offset,
    )
    return [CommunityThreadSummary.from_dto(dto) for dto in dtos]


@router.post(
    "/threads",
    response_model=CommunityThreadDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a community thread",
)
def create_thread(
    request: CommunityThreadCreateRequest,
    *,
    session: Session = Depends(get_session),
    forum_service: CommunityForumService = Depends(get_forum_service),
) -> CommunityThreadDetail:
    try:
        dto = forum_service.create_thread(
            session=session,
            user_id=request.user_id,
            title=request.title,
            body_md=request.body_md,
            tags=request.tags,
        )
    except CommunityUserNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from error
    except CommunityValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    return CommunityThreadDetail.from_dto(dto)


@router.get(
    "/threads/{thread_id}",
    response_model=CommunityThreadDetail,
    summary="Retrieve a community thread",
)
def get_thread(
    thread_id: str,
    *,
    session: Session = Depends(get_session),
    forum_service: CommunityForumService = Depends(get_forum_service),
) -> CommunityThreadDetail:
    try:
        dto = forum_service.get_thread(session=session, thread_id=thread_id)
    except CommunityThreadNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found.") from error

    return CommunityThreadDetail.from_dto(dto)


@router.post(
    "/threads/{thread_id}/posts",
    response_model=CommunityPost,
    status_code=status.HTTP_201_CREATED,
    summary="Create a post or reply",
)
def create_post(
    thread_id: str,
    request: CommunityPostCreateRequest,
    *,
    session: Session = Depends(get_session),
    forum_service: CommunityForumService = Depends(get_forum_service),
) -> CommunityPost:
    try:
        dto = forum_service.create_post(
            session=session,
            thread_id=thread_id,
            user_id=request.user_id,
            body_md=request.body_md,
            parent_post_id=request.parent_post_id,
        )
    except CommunityUserNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from error
    except CommunityThreadNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found.") from error
    except CommunityPostNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent post not found.") from error
    except CommunityThreadLockedError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error
    except CommunityValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error

    return CommunityPost.from_dto(dto)


@router.get(
    "/posts/{post_id}/replies",
    response_model=list[CommunityPost],
    summary="List replies for a post",
)
def list_replies(
    post_id: str,
    *,
    session: Session = Depends(get_session),
    forum_service: CommunityForumService = Depends(get_forum_service),
) -> list[CommunityPost]:
    try:
        dtos = forum_service.list_replies(session=session, post_id=post_id)
    except CommunityPostNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.") from error

    return [CommunityPost.from_dto(dto) for dto in dtos]


@router.delete(
    "/posts/{post_id}",
    response_model=CommunityPost,
    summary="Remove a post",
)
def remove_post(
    post_id: str,
    request: CommunityPostModerationRequest,
    *,
    session: Session = Depends(get_session),
    forum_service: CommunityForumService = Depends(get_forum_service),
) -> CommunityPost:
    try:
        dto = forum_service.remove_post(
            session=session,
            post_id=post_id,
            admin_id=request.admin_id,
        )
    except CommunityUserNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.") from error
    except CommunityPostNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found.") from error
    except CommunityPermissionError as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error)) from error

    return CommunityPost.from_dto(dto)


@router.get(
    "/tags",
    response_model=list[CommunityTagSummary],
    summary="List popular community tags",
)
def list_tags(
    *,
    session: Session = Depends(get_session),
    forum_service: CommunityForumService = Depends(get_forum_service),
    limit: int = Query(50, ge=1, le=100),
) -> list[CommunityTagSummary]:
    dtos = forum_service.list_tags(session=session, limit=limit)
    return [CommunityTagSummary.from_dto(dto) for dto in dtos]


__all__ = [
    "create_post",
    "create_thread",
    "get_forum_service",
    "get_thread",
    "list_replies",
    "list_tags",
    "list_threads",
    "remove_post",
]

