"""Caching helpers for release note replies sourced from Nostr relays."""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import RLock
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from proof_of_play_api.db.models import ReleaseNoteReply

from .utils import extract_alias_pubkeys, normalize_hex_key

_CACHE_DEFAULT_TTL_SECONDS = 30.0
_CACHE_DEFAULT_MAX_SIZE = 256


@dataclass(frozen=True)
class ReleaseNoteReplySnapshot:
    """Serializable snapshot of a release note reply used for caching."""

    comment_id: str
    game_id: str
    pubkey_hex: str | None
    body_md: str
    created_at: datetime
    alias_pubkeys: tuple[str, ...]


@dataclass
class _CacheEntry:
    """In-memory cache entry storing release note reply snapshots."""

    expires_at: float
    value: list[ReleaseNoteReplySnapshot]


class ReleaseNoteReplyCache:
    """Time-bound cache for release note replies keyed by game identifier."""

    def __init__(
        self,
        *,
        ttl_seconds: float = _CACHE_DEFAULT_TTL_SECONDS,
        max_size: int = _CACHE_DEFAULT_MAX_SIZE,
    ) -> None:
        if ttl_seconds <= 0:
            msg = "ttl_seconds must be positive"
            raise ValueError(msg)
        if max_size <= 0:
            msg = "max_size must be positive"
            raise ValueError(msg)
        self._ttl_seconds = float(ttl_seconds)
        self._max_size = int(max_size)
        self._entries: dict[str, _CacheEntry] = {}
        self._lock = RLock()

    def get(self, key: str) -> list[ReleaseNoteReplySnapshot] | None:
        """Return cached snapshots for the supplied game when they are fresh."""

        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            now = time.monotonic()
            if entry.expires_at <= now:
                self._entries.pop(key, None)
                return None
            return list(entry.value)

    def set(self, key: str, value: Iterable[ReleaseNoteReplySnapshot]) -> None:
        """Store snapshots for the supplied key and evict stale entries if needed."""

        now = time.monotonic()
        expires_at = now + self._ttl_seconds
        snapshots = list(value)
        entry = _CacheEntry(expires_at=expires_at, value=snapshots)
        with self._lock:
            self._entries[key] = entry
            if len(self._entries) > self._max_size:
                oldest_key = min(
                    self._entries.items(),
                    key=lambda item: item[1].expires_at,
                )[0]
                if oldest_key != key:
                    self._entries.pop(oldest_key, None)

    def clear(self) -> None:
        """Remove all cached entries. Intended for use in tests."""

        with self._lock:
            self._entries.clear()


class ReleaseNoteReplyLoader:
    """Load and cache release note replies for reuse across sessions."""

    def __init__(
        self,
        *,
        cache: ReleaseNoteReplyCache | None = None,
    ) -> None:
        self._cache = cache or ReleaseNoteReplyCache()

    def load_snapshots(
        self, *, session: Session, game_id: str
    ) -> list[ReleaseNoteReplySnapshot]:
        """Return cached reply snapshots for the supplied game identifier."""

        cached = self._cache.get(game_id)
        if cached is None:
            stmt = (
                select(ReleaseNoteReply)
                .where(ReleaseNoteReply.game_id == game_id)
                .where(ReleaseNoteReply.is_hidden.is_(False))
                .order_by(
                    ReleaseNoteReply.event_created_at.asc(),
                    ReleaseNoteReply.id.asc(),
                )
            )
            replies = session.scalars(stmt).all()
            cached = [self._snapshot_reply(reply=reply) for reply in replies]
            self._cache.set(game_id, cached)
        return list(cached)

    def clear_cache(self) -> None:
        """Remove cached reply snapshots. Primarily used in tests."""

        self._cache.clear()

    def _snapshot_reply(self, *, reply: ReleaseNoteReply) -> ReleaseNoteReplySnapshot:
        pubkey_hex = normalize_hex_key(reply.pubkey)
        aliases = extract_alias_pubkeys(reply.tags_json, pubkey_hex)
        created_at = reply.event_created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return ReleaseNoteReplySnapshot(
            comment_id=f"nostr:{reply.event_id}",
            game_id=reply.game_id,
            pubkey_hex=pubkey_hex,
            body_md=reply.content or "",
            created_at=created_at,
            alias_pubkeys=aliases,
        )


__all__ = [
    "ReleaseNoteReplyCache",
    "ReleaseNoteReplyLoader",
    "ReleaseNoteReplySnapshot",
]
