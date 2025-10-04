"""Domain helpers supporting the community forum experience."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
from typing import Iterable, Sequence

from sqlalchemy import Select, and_, func, select
from sqlalchemy.orm import Session, aliased, joinedload

from bit_indie_api.db.models import CommunityPost, CommunityThread, CommunityThreadTag, User


class CommunityForumError(RuntimeError):
    """Base error type raised when community forum operations fail."""


class CommunityThreadNotFoundError(CommunityForumError):
    """Raised when the requested community thread cannot be found."""


class CommunityPostNotFoundError(CommunityForumError):
    """Raised when the requested community post cannot be found."""


class CommunityThreadLockedError(CommunityForumError):
    """Raised when attempting to post inside a locked thread."""


class CommunityUserNotFoundError(CommunityForumError):
    """Raised when an operation references an unknown user."""


class CommunityValidationError(CommunityForumError):
    """Raised when supplied payloads fail validation rules."""


class CommunityPermissionError(CommunityForumError):
    """Raised when a user attempts an action they are not authorized to perform."""


@dataclass(slots=True)
class CommunityAuthorDTO:
    """Serialized author information for community content."""

    id: str
    display_name: str | None
    is_admin: bool


@dataclass(slots=True)
class CommunityPostDTO:
    """Serialized representation of a community post."""

    id: str
    thread_id: str
    parent_post_id: str | None
    body_md: str | None
    is_removed: bool
    created_at: datetime
    updated_at: datetime
    author: CommunityAuthorDTO
    reply_count: int


@dataclass(slots=True)
class CommunityThreadSummaryDTO:
    """Serialized representation of a community thread summary."""

    id: str
    title: str | None
    body_md: str | None
    is_pinned: bool
    is_locked: bool
    created_at: datetime
    updated_at: datetime
    reply_count: int
    tags: list[str]
    author: CommunityAuthorDTO | None


@dataclass(slots=True)
class CommunityThreadDetailDTO(CommunityThreadSummaryDTO):
    """Thread summary extended with top-level posts."""

    posts: list[CommunityPostDTO]


@dataclass(slots=True)
class CommunityTagSummaryDTO:
    """Serialized representation of a thread tag with usage counts."""

    tag: str
    thread_count: int


class CommunityForumService:
    """Coordinate CRUD operations for the community forum."""

    MAX_TAGS = 6
    _TAG_SANITIZER = re.compile(r"[^a-z0-9-]+")

    def list_threads(
        self,
        *,
        session: Session,
        tags: Sequence[str] | None,
        limit: int,
        offset: int,
    ) -> list[CommunityThreadSummaryDTO]:
        """Return pinned and recent threads with aggregate reply counts."""

        normalized_tags = self._normalize_tags(tags) if tags else None

        reply_count_subquery = (
            select(
                CommunityPost.thread_id.label("thread_id"),
                func.count(CommunityPost.id).label("reply_count"),
            )
            .where(CommunityPost.is_removed.is_(False))
            .group_by(CommunityPost.thread_id)
            .subquery()
        )

        stmt: Select[tuple[CommunityThread, int | None]] = (
            select(CommunityThread, reply_count_subquery.c.reply_count)
            .outerjoin(reply_count_subquery, CommunityThread.id == reply_count_subquery.c.thread_id)
            .options(
                joinedload(CommunityThread.author),
                joinedload(CommunityThread.tag_rows),
            )
        )

        if normalized_tags:
            tag_subquery = (
                select(CommunityThreadTag.thread_id)
                .where(CommunityThreadTag.tag.in_(normalized_tags))
                .group_by(CommunityThreadTag.thread_id)
            )
            stmt = stmt.where(CommunityThread.id.in_(tag_subquery))

        stmt = stmt.order_by(
            CommunityThread.is_pinned.desc(),
            CommunityThread.created_at.desc(),
            CommunityThread.id.desc(),
        )
        stmt = stmt.offset(offset).limit(limit)

        rows = session.execute(stmt).all()

        summaries: list[CommunityThreadSummaryDTO] = []
        for thread, reply_count in rows:
            summaries.append(
                self._build_thread_summary(
                    thread=thread,
                    reply_count=int(reply_count or 0),
                )
            )
        return summaries

    def create_thread(
        self,
        *,
        session: Session,
        user_id: str,
        title: str | None,
        body_md: str | None,
        tags: Sequence[str],
    ) -> CommunityThreadDetailDTO:
        """Persist a new community thread authored by the supplied user."""

        author = session.get(User, user_id)
        if author is None:
            raise CommunityUserNotFoundError("User not found.")

        normalized_title = title.strip() if title else None
        normalized_body = self._normalize_markdown(body_md)
        if not normalized_title and not normalized_body:
            raise CommunityValidationError("Provide a title or body when creating a thread.")

        normalized_tags = self._normalize_tags(tags)

        thread = CommunityThread(
            author_id=author.id,
            title=normalized_title,
            body_md=normalized_body,
        )
        session.add(thread)
        session.flush()

        for tag in normalized_tags:
            session.add(CommunityThreadTag(thread_id=thread.id, tag=tag))

        session.flush()

        reply_count = self._count_visible_posts(session=session, thread_id=thread.id)
        return self._build_thread_detail(
            thread=thread,
            reply_count=reply_count,
            posts=[],
        )

    def get_thread(
        self,
        *,
        session: Session,
        thread_id: str,
    ) -> CommunityThreadDetailDTO:
        """Return the thread with top-level posts ordered chronologically."""

        thread = session.get(CommunityThread, thread_id)
        if thread is None:
            raise CommunityThreadNotFoundError("Thread not found.")

        session.refresh(
            thread,
            attribute_names=["author", "tag_rows"],
        )

        reply_count = self._count_visible_posts(session=session, thread_id=thread.id)

        top_level = self._load_top_level_posts(session=session, thread_id=thread.id)
        return self._build_thread_detail(
            thread=thread,
            reply_count=reply_count,
            posts=top_level,
        )

    def create_post(
        self,
        *,
        session: Session,
        thread_id: str,
        user_id: str,
        body_md: str,
        parent_post_id: str | None,
    ) -> CommunityPostDTO:
        """Persist a post inside the referenced thread."""

        thread = session.get(CommunityThread, thread_id)
        if thread is None:
            raise CommunityThreadNotFoundError("Thread not found.")
        if thread.is_locked:
            raise CommunityThreadLockedError("Thread is locked to new replies.")

        author = session.get(User, user_id)
        if author is None:
            raise CommunityUserNotFoundError("User not found.")

        normalized_body = self._normalize_markdown(body_md)
        if not normalized_body:
            raise CommunityValidationError("Post body cannot be empty.")

        parent_post: CommunityPost | None = None
        if parent_post_id:
            parent_post = session.get(CommunityPost, parent_post_id)
            if parent_post is None:
                raise CommunityPostNotFoundError("Parent post not found.")
            if parent_post.thread_id != thread.id:
                raise CommunityValidationError("Parent post does not belong to this thread.")

        post = CommunityPost(
            thread_id=thread.id,
            parent_post_id=parent_post.id if parent_post else None,
            author_id=author.id,
            body_md=normalized_body,
        )
        session.add(post)
        session.flush()

        session.refresh(post, attribute_names=["author"])
        reply_count = self._count_direct_replies(session=session, post_id=post.id)
        return self._build_post_dto(post=post, reply_count=reply_count)

    def list_replies(
        self,
        *,
        session: Session,
        post_id: str,
    ) -> list[CommunityPostDTO]:
        """Return direct replies for the referenced post ordered chronologically."""

        post = session.get(CommunityPost, post_id)
        if post is None:
            raise CommunityPostNotFoundError("Post not found.")

        stmt: Select[CommunityPost] = (
            select(CommunityPost)
            .where(CommunityPost.parent_post_id == post.id)
            .order_by(CommunityPost.created_at.asc(), CommunityPost.id.asc())
            .options(joinedload(CommunityPost.author))
        )
        replies = session.scalars(stmt).all()

        dtos: list[CommunityPostDTO] = []
        for reply in replies:
            reply_count = self._count_direct_replies(session=session, post_id=reply.id)
            dtos.append(self._build_post_dto(post=reply, reply_count=reply_count))
        return dtos

    def remove_post(
        self,
        *,
        session: Session,
        post_id: str,
        admin_id: str,
    ) -> CommunityPostDTO:
        """Soft-delete a post as part of an admin moderation action."""

        admin = session.get(User, admin_id)
        if admin is None:
            raise CommunityUserNotFoundError("User not found.")
        if not admin.is_admin:
            raise CommunityPermissionError("Administrator privileges are required.")

        post = session.get(CommunityPost, post_id)
        if post is None:
            raise CommunityPostNotFoundError("Post not found.")

        post.is_removed = True
        session.flush()
        session.refresh(post, attribute_names=["author"])
        reply_count = self._count_direct_replies(session=session, post_id=post.id)
        return self._build_post_dto(post=post, reply_count=reply_count)

    def list_tags(self, *, session: Session, limit: int = 50) -> list[CommunityTagSummaryDTO]:
        """Return popular tags ordered by usage count then alphabetically."""

        stmt = (
            select(
                CommunityThreadTag.tag,
                func.count(func.distinct(CommunityThreadTag.thread_id)).label("thread_count"),
            )
            .join(CommunityThread, CommunityThread.id == CommunityThreadTag.thread_id)
            .group_by(CommunityThreadTag.tag)
            .order_by(func.count(func.distinct(CommunityThreadTag.thread_id)).desc(), CommunityThreadTag.tag.asc())
            .limit(limit)
        )
        rows = session.execute(stmt).all()
        return [
            CommunityTagSummaryDTO(tag=row.tag, thread_count=int(row.thread_count or 0))
            for row in rows
        ]

    def _normalize_markdown(self, body_md: str | None) -> str | None:
        if body_md is None:
            return None
        trimmed = body_md.strip()
        return trimmed or None

    def _normalize_tags(self, tags: Sequence[str]) -> list[str]:
        unique: list[str] = []
        for raw in tags[: self.MAX_TAGS]:
            normalized = self._normalize_tag(raw)
            if normalized and normalized not in unique:
                unique.append(normalized)
        if len(tags) > self.MAX_TAGS:
            raise CommunityValidationError(f"Provide at most {self.MAX_TAGS} tags per thread.")
        return unique

    def _normalize_tag(self, tag: str) -> str | None:
        cleaned = tag.strip().lower()
        cleaned = self._TAG_SANITIZER.sub("-", cleaned)
        cleaned = cleaned.strip("-")
        if not cleaned:
            raise CommunityValidationError("Tags cannot be empty.")
        if len(cleaned) > 40:
            cleaned = cleaned[:40]
        return cleaned

    def _count_visible_posts(self, *, session: Session, thread_id: str) -> int:
        stmt = (
            select(func.count(CommunityPost.id))
            .where(CommunityPost.thread_id == thread_id)
            .where(CommunityPost.is_removed.is_(False))
        )
        return int(session.execute(stmt).scalar_one())

    def _count_direct_replies(self, *, session: Session, post_id: str) -> int:
        stmt = (
            select(func.count(CommunityPost.id))
            .where(CommunityPost.parent_post_id == post_id)
            .where(CommunityPost.is_removed.is_(False))
        )
        return int(session.execute(stmt).scalar_one())

    def _load_top_level_posts(
        self,
        *,
        session: Session,
        thread_id: str,
    ) -> list[CommunityPostDTO]:
        child_alias = aliased(CommunityPost)
        stmt = (
            select(CommunityPost, func.count(child_alias.id).label("reply_count"))
            .outerjoin(
                child_alias,
                and_(
                    child_alias.parent_post_id == CommunityPost.id,
                    child_alias.is_removed.is_(False),
                ),
            )
            .where(CommunityPost.thread_id == thread_id)
            .where(CommunityPost.parent_post_id.is_(None))
            .group_by(CommunityPost.id)
            .order_by(CommunityPost.created_at.asc(), CommunityPost.id.asc())
            .options(joinedload(CommunityPost.author))
        )
        rows = session.execute(stmt).all()
        return [
            self._build_post_dto(post=row[0], reply_count=int(row[1] or 0))
            for row in rows
        ]

    def _build_thread_summary(
        self,
        *,
        thread: CommunityThread,
        reply_count: int,
    ) -> CommunityThreadSummaryDTO:
        author_dto = self._build_author_dto(thread.author) if thread.author else None
        tags = sorted(thread.tag_names)
        return CommunityThreadSummaryDTO(
            id=thread.id,
            title=thread.title,
            body_md=thread.body_md,
            is_pinned=thread.is_pinned,
            is_locked=thread.is_locked,
            created_at=thread.created_at,
            updated_at=thread.updated_at,
            reply_count=reply_count,
            tags=tags,
            author=author_dto,
        )

    def _build_thread_detail(
        self,
        *,
        thread: CommunityThread,
        reply_count: int,
        posts: Iterable[CommunityPostDTO],
    ) -> CommunityThreadDetailDTO:
        summary = self._build_thread_summary(thread=thread, reply_count=reply_count)
        return CommunityThreadDetailDTO(
            id=summary.id,
            title=summary.title,
            body_md=summary.body_md,
            is_pinned=summary.is_pinned,
            is_locked=summary.is_locked,
            created_at=summary.created_at,
            updated_at=summary.updated_at,
            reply_count=summary.reply_count,
            tags=summary.tags,
            author=summary.author,
            posts=list(posts),
        )

    def _build_post_dto(
        self,
        *,
        post: CommunityPost,
        reply_count: int,
    ) -> CommunityPostDTO:
        author_dto = self._build_author_dto(post.author)
        body = None if post.is_removed else post.body_md
        return CommunityPostDTO(
            id=post.id,
            thread_id=post.thread_id,
            parent_post_id=post.parent_post_id,
            body_md=body,
            is_removed=post.is_removed,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=author_dto,
            reply_count=reply_count,
        )

    def _build_author_dto(self, user: User) -> CommunityAuthorDTO:
        return CommunityAuthorDTO(
            id=user.id,
            display_name=user.display_name,
            is_admin=user.is_admin,
        )


__all__ = [
    "CommunityAuthorDTO",
    "CommunityForumService",
    "CommunityPermissionError",
    "CommunityPostDTO",
    "CommunityPostNotFoundError",
    "CommunityTagSummaryDTO",
    "CommunityThreadDetailDTO",
    "CommunityThreadLockedError",
    "CommunityThreadNotFoundError",
    "CommunityThreadSummaryDTO",
    "CommunityUserNotFoundError",
    "CommunityValidationError",
]

