"""Schema objects for administrative release note reply moderation endpoints."""

from __future__ import annotations

import json
from datetime import datetime

from pydantic import BaseModel, Field

from bit_indie_api.db.models import ReleaseNoteReply, ReleaseNoteReplyHiddenReason


class ReleaseNoteReplyModerationRequest(BaseModel):
    """Administrative action payload targeting a specific release note reply."""

    user_id: str = Field(..., description="Identifier of the acting administrator.")
    notes: str | None = Field(
        default=None,
        max_length=500,
        description="Optional contextual notes recorded alongside the action.",
    )


class ReleaseNoteReplyAuditRead(BaseModel):
    """Detailed representation of a release note reply for moderation tooling."""

    id: str
    game_id: str
    release_note_event_id: str
    relay_url: str
    event_id: str
    pubkey: str
    kind: int
    event_created_at: datetime
    content: str
    tags: list[list[str]]
    is_hidden: bool
    hidden_reason: ReleaseNoteReplyHiddenReason | None
    moderation_notes: str | None
    hidden_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, reply: ReleaseNoteReply) -> "ReleaseNoteReplyAuditRead":
        """Return an audit view constructed from the ORM release note reply model."""

        try:
            parsed_tags = json.loads(reply.tags_json)
        except (TypeError, json.JSONDecodeError):
            parsed_tags = []
        if not isinstance(parsed_tags, list):
            parsed_tags = []
        normalized_tags: list[list[str]] = []
        for tag in parsed_tags:
            if isinstance(tag, list) and all(isinstance(item, str) for item in tag):
                normalized_tags.append([item for item in tag])
        return cls(
            id=reply.id,
            game_id=reply.game_id,
            release_note_event_id=reply.release_note_event_id,
            relay_url=reply.relay_url,
            event_id=reply.event_id,
            pubkey=reply.pubkey,
            kind=reply.kind,
            event_created_at=reply.event_created_at,
            content=reply.content,
            tags=normalized_tags,
            is_hidden=reply.is_hidden,
            hidden_reason=reply.hidden_reason,
            moderation_notes=reply.moderation_notes,
            hidden_at=reply.hidden_at,
            created_at=reply.created_at,
            updated_at=reply.updated_at,
        )


__all__ = [
    "ReleaseNoteReplyAuditRead",
    "ReleaseNoteReplyModerationRequest",
]
