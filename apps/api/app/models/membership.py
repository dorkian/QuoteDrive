import enum

from sqlalchemy import Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Role(str, enum.Enum):
    ADMIN = "admin"
    PROPOSAL_MANAGER = "proposal_manager"
    APPROVER = "approver"
    VIEWER = "viewer"


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), primary_key=True)
    role: Mapped[Role] = mapped_column(
        Enum(
            Role, name="role", native_enum=False, values_callable=lambda cls: [e.value for e in cls]
        ),
        nullable=False,
    )
