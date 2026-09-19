import jwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Organization, OrganizationMembership, Role, User


def test_demo_login_valid_user_returns_jwt(client: TestClient, demo_admin: User) -> None:
    response = client.post("/auth/demo-login", json={"email": demo_admin.email})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]


def test_demo_login_unknown_email_returns_401(client: TestClient) -> None:
    response = client.post("/auth/demo-login", json={"email": "nobody@example.com"})

    assert response.status_code == 401


def test_me_with_valid_token_returns_user_and_organization(
    client: TestClient, demo_admin: User
) -> None:
    login = client.post("/auth/demo-login", json={"email": demo_admin.email})
    token = login.json()["access_token"]

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == demo_admin.email
    assert body["organization"]["name"] == "Northstar Mobility Advisory"
    assert body["role"] == "admin"


def test_me_without_token_returns_401(client: TestClient) -> None:
    response = client.get("/me")

    assert response.status_code == 401


def test_me_with_invalid_token_returns_401(client: TestClient) -> None:
    response = client.get("/me", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401


def test_me_with_malformed_claims_returns_401(client: TestClient) -> None:
    # Structurally valid, correctly-signed JWT that lacks the sub/org_id claims
    # decode_access_token expects.
    token = jwt.encode({"foo": "bar"}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    response = client.get("/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


def test_demo_login_with_multiple_memberships_returns_a_token(
    client: TestClient, db_session: Session
) -> None:
    org_a = Organization(name="Org A", slug="org-a")
    org_b = Organization(name="Org B", slug="org-b")
    user = User(email="multi@northstar.example", display_name="Multi Org")
    db_session.add_all([org_a, org_b, user])
    db_session.flush()
    db_session.add_all(
        [
            OrganizationMembership(user_id=user.id, organization_id=org_a.id, role=Role.ADMIN),
            OrganizationMembership(user_id=user.id, organization_id=org_b.id, role=Role.VIEWER),
        ]
    )
    db_session.commit()

    response = client.post("/auth/demo-login", json={"email": user.email})

    assert response.status_code == 200
    assert response.json()["access_token"]
