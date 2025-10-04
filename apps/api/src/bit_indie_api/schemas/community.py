"""Pydantic schemas for the community forum endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Sequence

from pydantic import BaseModel, Field, validator

from bit_indie_api.services.community_forum import (
    CommunityAuthorDTO,
    CommunityPostDTO,
    CommunityTagSummaryDTO,
    CommunityThreadDetailDTO,
    CommunityThreadSummaryDTO,
)


class CommunityAuthor(BaseModel):
    """Serialized author metadata."""

    id: str
    display_name: str | None = None
    is_admin: bool

    @classmethod
    def from_dto(cls, dto: CommunityAuthorDTO | None) -> CommunityAuthor | None:
        if dto is None:
            return None
        return cls(id=dto.id, display_name=dto.display_name, is_admin=dto.is_admin)


class CommunityPost(BaseModel):
    """Serialized post including reply counts."""

    id: str
    thread_id: str
    parent_post_id: str | None = None
    body_md: str | None = None
    is_removed: bool
    created_at: datetime
    updated_at: datetime
    reply_count: int
    author: CommunityAuthor

    @classmethod
    def from_dto(cls, dto: CommunityPostDTO) -> CommunityPost:
        return cls(
            id=dto.id,
            thread_id=dto.thread_id,
            parent_post_id=dto.parent_post_id,
            body_md=dto.body_md,
            is_removed=dto.is_removed,
            created_at=dto.created_at,
            updated_at=dto.updated_at,
            reply_count=dto.reply_count,
            author=CommunityAuthor.from_dto(dto.author),
        )


class CommunityThreadSummary(BaseModel):
    """Thread summary used when listing community discussions."""

    id: str
    title: str | None = None
    body_md: str | None = None
    is_pinned: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    reply_count: int
    tags: list[str]
    author: CommunityAuthor | None = None

    @classmethod
    def from_dto(cls, dto: CommunityThreadSummaryDTO) -> CommunityThreadSummary:
        return cls(
            id=dto.id,
            title=dto.title,
            body_md=dto.body_md,
            is_pinned=dto.is_pinned,
            is_locked=dto.is_locked,
            created_at=dto.created_at,
            updated_at=dto.updated_at,
            reply_count=dto.reply_count,
            tags=dto.tags,
            author=CommunityAuthor.from_dto(dto.author),
        )


class CommunityThreadDetail(CommunityThreadSummary):
    """Thread detail including top-level posts."""

    posts: list[CommunityPost]

    @classmethod
    def from_dto(cls, dto: CommunityThreadDetailDTO) -> CommunityThreadDetail:
        return cls(
            id=dto.id,
            title=dto.title,
            body_md=dto.body_md,
            is_pinned=dto.is_pinned,
            is_locked=dto.is_locked,
            created_at=dto.created_at,
            updated_at=dto.updated_at,
            reply_count=dto.reply_count,
            tags=dto.tags,
            author=CommunityAuthor.from_dto(dto.author),
            posts=[CommunityPost.from_dto(post) for post in dto.posts],
        )


class CommunityThreadCreateRequest(BaseModel):
    """Payload required to start a new discussion thread."""

    user_id: str
    title: str | None = Field(None, max_length=200)
    body_md: str | None = Field(None, max_length=10000)
    tags: list[str] = Field(default_factory=list, max_items=10)

    @validator("tags", each_item=True)
    def _ensure_tag_length(cls, value: str) -> str:
        if len(value) > 120:
            raise ValueError("Tags must be 120 characters or fewer before normalization.")
        return value


class CommunityPostCreateRequest(BaseModel):
    """Payload required to add a post or reply."""

    user_id: str
    body_md: str = Field(..., max_length=10000)
    parent_post_id: str | None = None


class CommunityPostModerationRequest(BaseModel):
    """Payload required to moderate a post."""

    admin_id: str


class CommunityTagSummary(BaseModel):
    """Popular thread tag with usage counts."""

    tag: str
    thread_count: int

    @classmethod
    def from_dto(cls, dto: CommunityTagSummaryDTO) -> CommunityTagSummary:
        return cls(tag=dto.tag, thread_count=dto.thread_count)


__all__ = [
    "CommunityAuthor",
    "CommunityPost",
    "CommunityPostCreateRequest",
    "CommunityPostModerationRequest",
    "CommunityTagSummary",
    "CommunityThreadCreateRequest",
    "CommunityThreadDetail",
    "CommunityThreadSummary",
]

