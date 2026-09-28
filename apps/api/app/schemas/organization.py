from pydantic import BaseModel

from app.models import Role


class MemberOut(BaseModel):
    user_id: int
    email: str
    display_name: str
    role: Role


class MemberRoleUpdate(BaseModel):
    role: Role


class OrganizationSettingsOut(BaseModel):
    ai_fallback_enabled: bool
    # Whether this deployment has a fallback provider configured at all; the
    # tenant switch does nothing without one.
    ai_fallback_available: bool


class OrganizationSettingsUpdate(BaseModel):
    ai_fallback_enabled: bool
