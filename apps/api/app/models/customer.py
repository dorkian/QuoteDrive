from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantOwnedMixin


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Customer(TenantOwnedMixin, Base):
    __tablename__ = "customers"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    # Profile (all optional): what makes a proposal for this customer specific.
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hq_city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    hq_country: Mapped[str | None] = mapped_column(String(128), nullable=True)
    company_size: Mapped[str | None] = mapped_column(String(16), nullable=True)
    about: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry_tags: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    contact_title: Mapped[str | None] = mapped_column(String(128), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
