import enum
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantOwnedMixin


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ProposalVersionStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIGURED = "configured"
    PROPOSAL_DRAFTED = "proposal_drafted"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    SHARED = "shared"
    WON = "won"
    LOST = "lost"
    EXPIRED = "expired"
    CHANGES_REQUESTED = "changes_requested"


class ProposalVersion(TenantOwnedMixin, Base):
    __tablename__ = "proposal_versions"

    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ProposalVersionStatus] = mapped_column(
        Enum(
            ProposalVersionStatus,
            name="proposal_version_status",
            native_enum=False,
            values_callable=lambda cls: [e.value for e in cls],
        ),
        nullable=False,
        default=ProposalVersionStatus.DRAFT,
    )
    content_json: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=lambda: {"lines": []}
    )
    narrative_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True, default=None)
    total_estimate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal(0)
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
