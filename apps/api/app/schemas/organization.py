from pydantic import BaseModel

from app.models import Role


class MemberOut(BaseModel):
    user_id: int
    email: str
    display_name: str
    role: Role


class MemberRoleUpdate(BaseModel):
    role: Role
