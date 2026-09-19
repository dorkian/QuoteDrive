from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership
from app.core.database import get_db
from app.core.security import create_access_token
from app.models import OrganizationMembership, User
from app.schemas.auth import (
    DemoLoginRequest,
    MeResponse,
    OrganizationOut,
    TokenResponse,
    UserOut,
)

router = APIRouter()


@router.post("/auth/demo-login", response_model=TokenResponse)
def demo_login(body: DemoLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    invalid_login = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unknown demo user or no organization membership",
    )

    user = db.execute(select(User).where(User.email == body.email)).scalar_one_or_none()
    if user is None:
        raise invalid_login

    # .first() rather than .scalar_one_or_none(): a user with more than one membership
    # (not part of the current demo scenario, but not schema-prevented either) should
    # still get a usable token instead of a 500 from MultipleResultsFound.
    membership = (
        db.execute(select(OrganizationMembership).where(OrganizationMembership.user_id == user.id))
        .scalars()
        .first()
    )
    if membership is None:
        raise invalid_login

    token = create_access_token(user_id=user.id, organization_id=membership.organization_id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def read_me(current: CurrentMembership = Depends(get_current_membership)) -> MeResponse:
    return MeResponse(
        user=UserOut(
            id=current.user.id, email=current.user.email, display_name=current.user.display_name
        ),
        organization=OrganizationOut(
            id=current.organization.id,
            name=current.organization.name,
            slug=current.organization.slug,
        ),
        role=current.role,
    )
