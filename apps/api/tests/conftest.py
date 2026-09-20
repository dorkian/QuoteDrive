from collections.abc import Callable, Generator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models import Base, Customer, Organization, OrganizationMembership, Role, User


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def demo_admin(db_session: Session) -> User:
    org = Organization(name="Northstar Mobility Advisory", slug="northstar-mobility-advisory")
    user = User(email="admin@northstar.example", display_name="Admin")
    db_session.add_all([org, user])
    db_session.flush()
    db_session.add(OrganizationMembership(user_id=user.id, organization_id=org.id, role=Role.ADMIN))
    db_session.commit()
    db_session.refresh(user)
    return user


@dataclass
class TwoOrgs:
    org_a_id: int
    org_b_id: int
    customer_a_id: int
    customer_b_id: int
    admin_a: str
    manager_a: str
    approver_a: str
    viewer_a: str
    admin_b: str


@pytest.fixture()
def two_orgs(db_session: Session) -> TwoOrgs:
    """Org A gets one user per role; org B gets a single admin — enough to prove
    tenant scoping (org A vs org B) and RBAC (each role in org A) independently."""
    org_a = Organization(name="Org A", slug="org-a")
    org_b = Organization(name="Org B", slug="org-b")
    db_session.add_all([org_a, org_b])
    db_session.flush()

    customer_a = Customer(name="Customer A", organization_id=org_a.id, status="active")
    customer_b = Customer(name="Customer B", organization_id=org_b.id, status="active")
    db_session.add_all([customer_a, customer_b])
    db_session.flush()

    users = {
        "admin_a": ("admin-a@example.com", org_a, Role.ADMIN),
        "manager_a": ("manager-a@example.com", org_a, Role.PROPOSAL_MANAGER),
        "approver_a": ("approver-a@example.com", org_a, Role.APPROVER),
        "viewer_a": ("viewer-a@example.com", org_a, Role.VIEWER),
        "admin_b": ("admin-b@example.com", org_b, Role.ADMIN),
    }
    for email, org, role in users.values():
        user = User(email=email, display_name=email)
        db_session.add(user)
        db_session.flush()
        db_session.add(OrganizationMembership(user_id=user.id, organization_id=org.id, role=role))
    db_session.commit()

    return TwoOrgs(
        org_a_id=org_a.id,
        org_b_id=org_b.id,
        customer_a_id=customer_a.id,
        customer_b_id=customer_b.id,
        admin_a=users["admin_a"][0],
        manager_a=users["manager_a"][0],
        approver_a=users["approver_a"][0],
        viewer_a=users["viewer_a"][0],
        admin_b=users["admin_b"][0],
    )


@pytest.fixture()
def login(client: TestClient) -> Callable[[str], str]:
    def _login(email: str) -> str:
        response = client.post("/auth/demo-login", json={"email": email})
        token: str = response.json()["access_token"]
        return token

    return _login
