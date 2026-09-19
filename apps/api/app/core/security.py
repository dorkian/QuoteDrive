from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings


def create_access_token(user_id: int, organization_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "org_id": organization_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, int]:
    """Decode a JWT and return {"user_id": ..., "org_id": ...}.

    Raises jwt.PyJWTError (or a subclass) on any invalid/expired/malformed token —
    callers are expected to catch that and respond 401.
    """
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    try:
        return {"user_id": int(payload["sub"]), "org_id": int(payload["org_id"])}
    except (KeyError, ValueError) as err:
        raise jwt.InvalidTokenError("Missing or malformed subject/org claim") from err
