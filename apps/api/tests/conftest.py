from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.main import app
from app.models import Base, Organization, OrganizationMembership, Role, User


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
