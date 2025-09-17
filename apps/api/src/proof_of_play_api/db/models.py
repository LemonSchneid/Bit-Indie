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
    ForeignKey,
    Integer,
    String,
    Text,
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


class User(TimestampMixin, Base):
    """A registered Nostr user in the marketplace."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_generate_uuid)
    pubkey_hex: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    nip05: Mapped[str | None] = mapped_column(String(255))
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

    game: Mapped[Game] = relationship(back_populates="comments")
    user: Mapped[User] = relationship(back_populates="comments")


__all__ = [
    "Comment",
    "Developer",
    "Game",
    "GameCategory",
    "GameStatus",
    "InvoiceStatus",
    "Purchase",
    "RefundStatus",
    "TimestampMixin",
    "User",
    "DownloadAuditLog",
]
