from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, require_role
from app.core.database import get_db
from app.models import OrganizationMembership, Role, User
from app.schemas.organization import MemberOut, MemberRoleUpdate
from app.services.audit import record_audit_event

router = APIRouter(prefix="/organization", tags=["organization"])

_admin_only = require_role(Role.ADMIN)


def _member_out(membership: OrganizationMembership, user: User) -> MemberOut:
    return MemberOut(
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=membership.role,
    )


@router.get("/members", response_model=list[MemberOut])
def list_members(
    current: CurrentMembership = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    rows = db.execute(
        select(OrganizationMembership, User)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(OrganizationMembership.organization_id == current.organization.id)
        .order_by(User.display_name, User.id)
    ).all()
    return [_member_out(membership, user) for membership, user in rows]


@router.patch("/members/{user_id}", response_model=MemberOut)
def update_member_role(
    user_id: int,
    body: MemberRoleUpdate,
    current: CurrentMembership = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> MemberOut:
    org_id = current.organization.id
    # Lock every Admin membership in the org (plus the target) before counting,
    # so two concurrent demotions can't each see "another Admin remains".
    admins = (
        db.execute(
            select(OrganizationMembership)
            .where(
                OrganizationMembership.organization_id == org_id,
                OrganizationMembership.role == Role.ADMIN,
            )
            .with_for_update()
        )
        .scalars()
        .all()
    )
    membership = db.execute(
        select(OrganizationMembership)
        .where(
            OrganizationMembership.organization_id == org_id,
            OrganizationMembership.user_id == user_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    user = db.get(User, user_id)
    if membership is None or user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    before = membership.role
    if before == body.role:
        return _member_out(membership, user)
    if before == Role.ADMIN and len(admins) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last Admin of the organization",
        )

    membership.role = body.role
    record_audit_event(
        db,
        organization_id=org_id,
        actor_id=current.user.id,
        actor_name=current.user.display_name,
        entity_type="membership",
        entity_id=user.id,
        action="role_change",
        before={"display_name": user.display_name, "role": before.value},
        after={"display_name": user.display_name, "role": body.role.value},
    )
    db.commit()
    return _member_out(membership, user)
