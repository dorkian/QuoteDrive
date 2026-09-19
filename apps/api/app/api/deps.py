from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import Organization, OrganizationMembership, Role, User

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentMembership:
    user: User
    organization: Organization
    role: Role


def get_current_membership(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentMembership:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        claims = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        raise unauthorized from None

    # Re-verify the membership still exists rather than trusting the JWT claim alone
    # (security-and-tenancy.md Control #1: derive active org from membership, not client input).
    membership = db.get(OrganizationMembership, (claims["user_id"], claims["org_id"]))
    if membership is None:
        raise unauthorized

    user = db.get(User, claims["user_id"])
    organization = db.get(Organization, claims["org_id"])
    if user is None or organization is None:
        raise unauthorized

    return CurrentMembership(user=user, organization=organization, role=membership.role)
