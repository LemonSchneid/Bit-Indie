"""Normalize cached release note replies into user-aware records."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from bit_indie_api.db.models import User

from .cache import ReleaseNoteReplySnapshot
from .utils import normalize_hex_key
from .verification import load_verified_user_ids


@dataclass(frozen=True)
class NormalizedReleaseNoteReply:
    """Represents a cached reply enriched with resolved user context."""

    snapshot: ReleaseNoteReplySnapshot
    matched_user: User | None
    is_verified_purchase: bool


class ReleaseNoteReplyNormalizer:
    """Resolve cached reply snapshots into user-aware representations."""

    def normalize(
        self,
        *,
        session: Session,
        game_id: str,
        snapshots: Sequence[ReleaseNoteReplySnapshot],
    ) -> list[NormalizedReleaseNoteReply]:
        """Return normalized replies with associated users and verification state."""

        alias_pubkeys = {alias for snapshot in snapshots for alias in snapshot.alias_pubkeys}
        users_by_pubkey = self._load_users_by_pubkey(
            session=session, pubkeys=alias_pubkeys
        )
        verified_user_ids = load_verified_user_ids(
            session=session,
            game_id=game_id,
            user_ids={user.id for user in users_by_pubkey.values()},
        )

        normalized: list[NormalizedReleaseNoteReply] = []
        for snapshot in snapshots:
            matched_user = self._resolve_snapshot_user(
                snapshot=snapshot, users_by_pubkey=users_by_pubkey
            )
            verified = matched_user is not None and matched_user.id in verified_user_ids
            normalized.append(
                NormalizedReleaseNoteReply(
                    snapshot=snapshot,
                    matched_user=matched_user,
                    is_verified_purchase=verified,
                )
            )
        return normalized

    def _load_users_by_pubkey(
        self, *, session: Session, pubkeys: Iterable[str]
    ) -> dict[str, User]:
        normalized = {key.lower() for key in pubkeys if key}
        if not normalized:
            return {}
        stmt = select(User).where(User.pubkey_hex.in_(normalized))
        return {user.pubkey_hex.lower(): user for user in session.scalars(stmt)}

    def _resolve_snapshot_user(
        self,
        *,
        snapshot: ReleaseNoteReplySnapshot,
        users_by_pubkey: Mapping[str, User],
    ) -> User | None:
        if snapshot.pubkey_hex:
            direct = users_by_pubkey.get(snapshot.pubkey_hex.lower())
            if direct is not None:
                return direct
        normalized_primary = normalize_hex_key(snapshot.pubkey_hex)
        for alias in snapshot.alias_pubkeys:
            alias_lower = alias.lower()
            if normalized_primary is not None and alias_lower != normalized_primary:
                continue
            resolved = users_by_pubkey.get(alias_lower)
            if resolved is not None:
                return resolved
        return None


__all__ = [
    "NormalizedReleaseNoteReply",
    "ReleaseNoteReplyNormalizer",
]
