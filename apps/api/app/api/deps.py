from collections.abc import Callable, Generator
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import Organization, OrganizationMembership, Role, User
from app.services.ai.providers import GenerationProvider, get_provider

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


def require_role(*allowed: Role) -> Callable[[CurrentMembership], CurrentMembership]:
    """Dependency factory: 403s unless the actor's role is one of `allowed`.

    Runs ahead of any tenant-scoped fetch, so a role failure is always 403 —
    never leaking whether the target row exists in another org (that's a 404,
    from app.repositories.base.get_tenant_scoped_or_404).
    """

    def checker(
        current: CurrentMembership = Depends(get_current_membership),
    ) -> CurrentMembership:
        if current.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role for this action",
            )
        return current

    return checker


def get_ai_provider(
    current: CurrentMembership = Depends(get_current_membership),
) -> Generator[GenerationProvider, None, None]:
    try:
        provider = get_provider(settings, allow_fallback=current.organization.ai_fallback_enabled)
    except ValueError as exc:
        # A misconfigured AI_PROVIDER (e.g. openrouter with no API key) is a
        # deployment error, not a per-request attempt — surface it as a clean
        # 500 here rather than letting it propagate as an opaque, unhandled
        # error from dependency resolution.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI provider misconfigured",
        ) from exc
    try:
        yield provider
    finally:
        provider.close()
