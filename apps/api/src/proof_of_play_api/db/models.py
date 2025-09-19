"""SQLAlchemy ORM models for the Proof of Play marketplace."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from proof_of_play_api.db import Base


def _generate_uuid() -> str:
    """Return a random UUID4 string suitable for primary keys."""

    return str(uuid.uuid4())


class TimestampMixin:
    """Shared timestamp columns for auditable tables."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class GameStatus(str, enum.Enum):
    """Lifecycle states for a game listing."""

    UNLISTED = "UNLISTED"
    DISCOVER = "DISCOVER"
    FEATURED = "FEATURED"


class GameCategory(str, enum.Enum):
    """High-level descriptors for the maturity of a game build."""

    PROTOTYPE = "PROTOTYPE"
    EARLY_ACCESS = "EARLY_ACCESS"
    FINISHED = "FINISHED"


class InvoiceStatus(str, enum.Enum):
    """Recorded states for Lightning invoices."""

    PENDING = "PENDING"
    PAID = "PAID"
    EXPIRED = "EXPIRED"
    REFUNDED = "REFUNDED"


class RefundStatus(str, enum.Enum):
    """Manual refund resolution states."""

    NONE = "NONE"
    REQUESTED = "REQUESTED"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    PAID = "PAID"


class ZapTargetType(str, enum.Enum):
    """Entities that can receive Lightning zap receipts."""

    REVIEW = "REVIEW"
    GAME = "GAME"
    COMMENT = "COMMENT"
    PLATFORM = "PLATFORM"


class ZapSource(str, enum.Enum):
    """Origin classification for Lightning zap receipts."""

    DIRECT = "DIRECT"
    FORWARDED = "FORWARDED"


class ModerationTargetType(str, enum.Enum):
    """Types of entities that can be flagged for moderation."""

    GAME = "GAME"
    COMMENT = "COMMENT"
    REVIEW = "REVIEW"


class ModerationFlagReason(str, enum.Enum):
    """Reasons provided by users when flagging content."""

    SPAM = "SPAM"
    TOS = "TOS"
    DMCA = "DMCA"
    MALWARE = "MALWARE"


class ModerationFlagStatus(str, enum.Enum):
    """Lifecycle states for moderation flags."""

    OPEN = "OPEN"
    DISMISSED = "DISMISSED"
    ACTIONED = "ACTIONED"


class User(TimestampMixin, Base):
    """A registered Nostr user in the marketplace."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    pubkey_hex: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    nip05: Mapped[str | None] = mapped_column(String(255))
    lightning_address: Mapped[str | None] = mapped_column(String(255))
    reputation_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    developer_profile: Mapped[Developer | None] = relationship(back_populates="user", uselist=False)
    purchases: Mapped[list[Purchase]] = relationship(
        back_populates="user",
        cascade="all,delete-orphan",
        single_parent=True,
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="user",
        cascade="all,delete-orphan",
        single_parent=True,
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="user",
        cascade="all,delete-orphan",
        single_parent=True,
    )

    @property
    def is_developer(self) -> bool:
        """Return ``True`` when the user has an associated developer profile."""

        return self.developer_profile is not None


class Developer(TimestampMixin, Base):
    """Developer profile linked to a user account."""

    __tablename__ = "developers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    verified_dev: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    profile_url: Mapped[str | None] = mapped_column(String(255))
    contact_email: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(back_populates="developer_profile")
    games: Mapped[list[Game]] = relationship(
        back_populates="developer",
        cascade="all,delete-orphan",
        single_parent=True,
    )


class Game(TimestampMixin, Base):
    """Game listing and downloadable build metadata."""

    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    developer_id: Mapped[str] = mapped_column(String(36), ForeignKey("developers.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[GameStatus] = mapped_column(
        SqlEnum(GameStatus, name="game_status", native_enum=False),
        nullable=False,
        default=GameStatus.UNLISTED,
        server_default=GameStatus.UNLISTED.value,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    summary: Mapped[str | None] = mapped_column(String(280))
    description_md: Mapped[str | None] = mapped_column(Text)
    price_msats: Mapped[int | None] = mapped_column(BigInteger)
    cover_url: Mapped[str | None] = mapped_column(String(500))
    trailer_url: Mapped[str | None] = mapped_column(String(500))
    category: Mapped[GameCategory] = mapped_column(
        SqlEnum(GameCategory, name="game_category", native_enum=False),
        nullable=False,
        default=GameCategory.PROTOTYPE,
        server_default=GameCategory.PROTOTYPE.value,
    )
    build_object_key: Mapped[str | None] = mapped_column(String(500))
    build_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    release_note_event_id: Mapped[str | None] = mapped_column(
        String(128), unique=True
    )
    release_note_published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    developer: Mapped[Developer] = relationship(back_populates="games")
    purchases: Mapped[list[Purchase]] = relationship(
        back_populates="game",
        cascade="all,delete-orphan",
        single_parent=True,
    )
    comments: Mapped[list["Comment"]] = relationship(
        back_populates="game",
        cascade="all,delete-orphan",
        single_parent=True,
    )
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="game",
        cascade="all,delete-orphan",
        single_parent=True,
    )

    @property
    def developer_lightning_address(self) -> str | None:
        """Return the developer's configured Lightning address if available."""

        developer = self.developer
        if developer is None:
            return None

        user = developer.user
        if user is None:
            return None

        return user.lightning_address


class Purchase(TimestampMixin, Base):
    """Lightning purchase record linking a user to a game build."""

    __tablename__ = "purchases"

    __table_args__ = (
        CheckConstraint("amount_msats >= 0", name="ck_purchases_amount_msats_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    game_id: Mapped[str] = mapped_column(String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[str] = mapped_column(String(120), nullable=False)
    invoice_status: Mapped[InvoiceStatus] = mapped_column(
        SqlEnum(InvoiceStatus, name="invoice_status", native_enum=False),
        nullable=False,
        default=InvoiceStatus.PENDING,
        server_default=InvoiceStatus.PENDING.value,
    )
    amount_msats: Mapped[int | None] = mapped_column(BigInteger)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    download_granted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    refund_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    refund_status: Mapped[RefundStatus] = mapped_column(
        SqlEnum(RefundStatus, name="refund_status", native_enum=False),
        nullable=False,
        default=RefundStatus.NONE,
        server_default=RefundStatus.NONE.value,
    )
    playtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    user: Mapped[User] = relationship(back_populates="purchases")
    game: Mapped[Game] = relationship(back_populates="purchases")
    refund_payouts: Mapped[list["RefundPayout"]] = relationship(
        back_populates="purchase",
        cascade="all,delete-orphan",
        single_parent=True,
    )


class RefundPayout(TimestampMixin, Base):
    """Record describing a manually processed refund payout."""

    __tablename__ = "refund_payouts"

    __table_args__ = (
        CheckConstraint(
            "amount_msats IS NULL OR amount_msats >= 0",
            name="ck_refund_payouts_amount_msats_positive",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    purchase_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("purchases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    processed_by_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    amount_msats: Mapped[int | None] = mapped_column(BigInteger)
    payment_reference: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    purchase: Mapped[Purchase] = relationship(back_populates="refund_payouts")
    processed_by: Mapped[User | None] = relationship()


class DownloadAuditLog(TimestampMixin, Base):
    """Audit trail entries recorded each time a download link is issued."""

    __tablename__ = "download_audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    purchase_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    game_id: Mapped[str] = mapped_column(String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Comment(Base):
    """User submitted comment attached to a game listing."""

    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    game_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body_md: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    game: Mapped[Game] = relationship(back_populates="comments")
    user: Mapped[User] = relationship(back_populates="comments")


class Review(Base):
    """User submitted review containing optional rating and purchase verification."""

    __tablename__ = "reviews"

    __table_args__ = (
        CheckConstraint(
            "(rating BETWEEN 1 AND 5) OR rating IS NULL",
            name="ck_reviews_rating_range",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    game_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    body_md: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer)
    helpful_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0, server_default="0"
    )
    total_zap_msats: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )
    suspicious_zap_pattern: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_verified_purchase: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    game: Mapped[Game] = relationship(back_populates="reviews")
    user: Mapped[User] = relationship(back_populates="reviews")

    @property
    def author(self) -> User | None:
        """Expose the associated user for serialization helpers."""

        return self.user


class Zap(TimestampMixin, Base):
    """Recorded Lightning zap receipt associated with marketplace content."""

    __tablename__ = "zaps"

    __table_args__ = (
        CheckConstraint("amount_msats > 0", name="ck_zaps_amount_positive"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    target_type: Mapped[ZapTargetType] = mapped_column(
        SqlEnum(ZapTargetType, name="zap_target_type", native_enum=False),
        nullable=False,
    )
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    from_pubkey: Mapped[str] = mapped_column(String(128), nullable=False)
    to_pubkey: Mapped[str] = mapped_column(String(128), nullable=False)
    amount_msats: Mapped[int] = mapped_column(BigInteger, nullable=False)
    event_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ZapLedgerEvent(TimestampMixin, Base):
    """Deduplicated zap receipt representing a parsed Nostr event."""

    __tablename__ = "zap_ledger_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    event_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    sender_pubkey: Mapped[str] = mapped_column(String(128), nullable=False)
    total_msats: Mapped[int] = mapped_column(BigInteger, nullable=False)
    part_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    event_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ZapLedgerTotal(TimestampMixin, Base):
    """Aggregated zap totals grouped by target and source classification."""

    __tablename__ = "zap_ledger_totals"
    __table_args__ = (
        UniqueConstraint(
            "target_type",
            "target_id",
            "zap_source",
            name="ux_zap_ledger_target_source",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    target_type: Mapped[ZapTargetType] = mapped_column(
        SqlEnum(ZapTargetType, name="zap_target_type", native_enum=False), nullable=False
    )
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    zap_source: Mapped[ZapSource] = mapped_column(
        SqlEnum(ZapSource, name="zap_source", native_enum=False), nullable=False
    )
    total_msats: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0, server_default="0")
    zap_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_event_id: Mapped[str | None] = mapped_column(String(128))


class ReleaseNotePublishQueue(TimestampMixin, Base):
    """Durable queue entries for release notes awaiting relay publication."""

    __tablename__ = "release_note_publish_queue"
    __table_args__ = (
        UniqueConstraint("game_id", "relay_url", name="ux_release_note_queue_game_relay"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    game_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relay_url: Mapped[str] = mapped_column(String(500), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    last_error: Mapped[str | None] = mapped_column(Text)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReleaseNoteRelayCheckpoint(TimestampMixin, Base):
    """Per-relay high-water marks for release note reply ingestion."""

    __tablename__ = "release_note_relay_checkpoints"
    __table_args__ = (
        UniqueConstraint("relay_url", name="ux_release_note_relay_checkpoint_url"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    relay_url: Mapped[str] = mapped_column(String(500), nullable=False)
    last_event_created_at: Mapped[int | None] = mapped_column(BigInteger)
    last_event_id: Mapped[str | None] = mapped_column(String(128))


class ReleaseNoteReply(TimestampMixin, Base):
    """Replies to published release note events fetched from relays."""

    __tablename__ = "release_note_replies"
    __table_args__ = (
        UniqueConstraint("game_id", "event_id", name="ux_release_note_replies_game_event"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    game_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    release_note_event_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    relay_url: Mapped[str] = mapped_column(String(500), nullable=False)
    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    pubkey: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[int] = mapped_column(Integer, nullable=False)
    event_created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tags_json: Mapped[str] = mapped_column(Text, nullable=False)


class ModerationFlag(TimestampMixin, Base):
    """User submitted moderation flag for games, comments, or reviews."""

    __tablename__ = "moderation_flags"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    target_type: Mapped[ModerationTargetType] = mapped_column(
        SqlEnum(ModerationTargetType, name="moderation_target_type", native_enum=False),
        nullable=False,
    )
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[ModerationFlagReason] = mapped_column(
        SqlEnum(ModerationFlagReason, name="moderation_flag_reason", native_enum=False),
        nullable=False,
    )
    status: Mapped[ModerationFlagStatus] = mapped_column(
        SqlEnum(ModerationFlagStatus, name="moderation_flag_status", native_enum=False),
        nullable=False,
        default=ModerationFlagStatus.OPEN,
        server_default=ModerationFlagStatus.OPEN.value,
        index=True,
    )

    reporter: Mapped[User] = relationship()


__all__ = [
    "Comment",
    "Developer",
    "Game",
    "GameCategory",
    "GameStatus",
    "InvoiceStatus",
    "ModerationFlag",
    "ModerationFlagReason",
    "ModerationFlagStatus",
    "ModerationTargetType",
    "Purchase",
    "Review",
    "RefundStatus",
    "Zap",
    "ZapTargetType",
    "ZapLedgerEvent",
    "ZapLedgerTotal",
    "ZapSource",
    "TimestampMixin",
    "User",
    "DownloadAuditLog",
    "ReleaseNotePublishQueue",
    "ReleaseNoteRelayCheckpoint",
    "ReleaseNoteReply",
]
