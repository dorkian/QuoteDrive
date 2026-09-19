from sqlalchemy import ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TenantOwnedMixin:
    """Shared shape for every tenant-owned table (data-model.md's tenant rule).

    Repository helpers key off `organization_id` here so tenant scoping is
    enforced once, centrally, rather than re-implemented per query.
    """

    id: Mapped[int] = mapped_column(primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
