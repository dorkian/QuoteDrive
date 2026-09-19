"""Seed the demo tenant, demo users, and a few demo opportunities from
docs/product/demo-scenario.md.

Idempotent — safe to run multiple times. Run after `alembic upgrade head`:

    python -m scripts.seed_demo
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Opportunity, Organization, OrganizationMembership, Role, User
from app.services.audit import record_audit_event

ORG_NAME = "Northstar Mobility Advisory"
ORG_SLUG = "northstar-mobility-advisory"

DEMO_USERS = [
    ("admin@northstar.example", "Admin", Role.ADMIN),
    ("manager@northstar.example", "Proposal Manager", Role.PROPOSAL_MANAGER),
    ("approver@northstar.example", "Approver", Role.APPROVER),
    ("viewer@northstar.example", "Viewer", Role.VIEWER),
]

DEMO_OPPORTUNITIES = [
    "2026 Fleet Modernization & Mobility Services",
    "Downtown Campus Shuttle Expansion",
    "Executive Fleet Refresh",
]


def seed(db: Session) -> None:
    org = db.execute(select(Organization).where(Organization.slug == ORG_SLUG)).scalar_one_or_none()
    if org is None:
        org = Organization(name=ORG_NAME, slug=ORG_SLUG)
        db.add(org)
        db.flush()
        print(f"created organization: {org.name}")

    manager: User | None = None
    for email, display_name, role in DEMO_USERS:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if user is None:
            user = User(email=email, display_name=display_name)
            db.add(user)
            db.flush()
            print(f"created user: {email}")

        if role == Role.PROPOSAL_MANAGER:
            manager = user

        membership = db.get(OrganizationMembership, (user.id, org.id))
        if membership is None:
            db.add(OrganizationMembership(user_id=user.id, organization_id=org.id, role=role))
            print(f"created membership: {email} -> {org.name} ({role.value})")

    assert manager is not None  # DEMO_USERS always includes a Proposal Manager

    for title in DEMO_OPPORTUNITIES:
        existing = db.execute(
            select(Opportunity).where(
                Opportunity.organization_id == org.id, Opportunity.title == title
            )
        ).scalar_one_or_none()
        if existing is None:
            opportunity = Opportunity(organization_id=org.id, owner_id=manager.id, title=title)
            db.add(opportunity)
            db.flush()
            record_audit_event(
                db,
                organization_id=org.id,
                actor_id=manager.id,
                entity_type="opportunity",
                entity_id=opportunity.id,
                action="create",
                after={"title": opportunity.title, "status": opportunity.status},
            )
            print(f"created opportunity: {title}")

    db.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
