"""Seed the demo tenant and demo users from docs/product/demo-scenario.md.

Idempotent — safe to run multiple times. Run after `alembic upgrade head`:

    python -m scripts.seed_demo
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Organization, OrganizationMembership, Role, User

ORG_NAME = "Northstar Mobility Advisory"
ORG_SLUG = "northstar-mobility-advisory"

DEMO_USERS = [
    ("admin@northstar.example", "Admin", Role.ADMIN),
    ("manager@northstar.example", "Proposal Manager", Role.PROPOSAL_MANAGER),
    ("approver@northstar.example", "Approver", Role.APPROVER),
    ("viewer@northstar.example", "Viewer", Role.VIEWER),
]


def seed(db: Session) -> None:
    org = db.execute(select(Organization).where(Organization.slug == ORG_SLUG)).scalar_one_or_none()
    if org is None:
        org = Organization(name=ORG_NAME, slug=ORG_SLUG)
        db.add(org)
        db.flush()
        print(f"created organization: {org.name}")

    for email, display_name, role in DEMO_USERS:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            user = User(email=email, display_name=display_name)
            db.add(user)
            db.flush()
            print(f"created user: {email}")

        membership = db.get(OrganizationMembership, (user.id, org.id))
        if membership is None:
            db.add(OrganizationMembership(user_id=user.id, organization_id=org.id, role=role))
            print(f"created membership: {email} -> {org.name} ({role.value})")

    db.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
