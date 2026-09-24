from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantOwnedMixin


def _utcnow() -> datetime:
    return datetime.now(UTC)


class GenerationLog(TenantOwnedMixin, Base):
    __tablename__ = "generation_logs"

    actor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Snapshotted at write time (see audit_event.py's actor_name for the same
    # rationale) so the log reflects the actor's name as of the attempt,
    # unaffected by later profile renames.
    actor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[int] = mapped_column(nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(64), nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_detail: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
