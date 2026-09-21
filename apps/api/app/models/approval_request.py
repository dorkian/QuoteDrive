import enum
from datetime import UTC, datetime

from sqlalchemy import DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantOwnedMixin


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ApprovalRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"


class ApprovalRequest(TenantOwnedMixin, Base):
    __tablename__ = "approval_requests"

    proposal_version_id: Mapped[int] = mapped_column(
        ForeignKey("proposal_versions.id"), nullable=False
    )
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_to: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[ApprovalRequestStatus] = mapped_column(
        Enum(
            ApprovalRequestStatus,
            name="approval_request_status",
            native_enum=False,
            values_callable=lambda cls: [e.value for e in cls],
        ),
        nullable=False,
        default=ApprovalRequestStatus.PENDING,
    )
    decision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
