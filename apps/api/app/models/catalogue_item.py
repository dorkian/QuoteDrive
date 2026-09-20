from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantOwnedMixin


def _utcnow() -> datetime:
    return datetime.now(UTC)


class CatalogueItem(TenantOwnedMixin, Base):
    __tablename__ = "catalogue_items"

    type: Mapped[str] = mapped_column(String(32), nullable=False)  # "package" | "add_on"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    base_monthly_estimate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
