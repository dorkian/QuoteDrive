"""Seed a second, fictional tenant for the E2E tenant-isolation test (QD-405).

Kept separate from seed_demo so the demo tenant stays clean. Idempotent — run
after `python -m scripts.seed_demo`:

    python -m scripts.seed_e2e
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Customer, Opportunity, Organization, OrganizationMembership, Role, User

ORG_NAME = "Harbor Mobility Partners"
ORG_SLUG = "harbor-mobility-partners"
MANAGER_EMAIL = "manager@harbor.example"
OPPORTUNITY_TITLE = "Harbor Port Shuttle Fleet"


def seed(db: Session) -> None:
    org = db.execute(select(Organization).where(Organization.slug == ORG_SLUG)).scalar_one_or_none()
    if org is None:
        org = Organization(name=ORG_NAME, slug=ORG_SLUG)
        db.add(org)
        db.flush()

    user = db.execute(select(User).where(User.email == MANAGER_EMAIL)).scalar_one_or_none()
    if user is None:
        user = User(email=MANAGER_EMAIL, display_name="Harbor Manager")
        db.add(user)
        db.flush()
    if db.get(OrganizationMembership, (user.id, org.id)) is None:
        db.add(
            OrganizationMembership(
                user_id=user.id, organization_id=org.id, role=Role.PROPOSAL_MANAGER
            )
        )

    customer = db.execute(
        select(Customer).where(Customer.organization_id == org.id)
    ).scalar_one_or_none()
    if customer is None:
        customer = Customer(organization_id=org.id, name="Harbor Logistics", status="active")
        db.add(customer)
        db.flush()

    exists = db.execute(
        select(Opportunity).where(
            Opportunity.organization_id == org.id, Opportunity.title == OPPORTUNITY_TITLE
        )
    ).scalar_one_or_none()
    if exists is None:
        db.add(
            Opportunity(
                organization_id=org.id,
                customer_id=customer.id,
                owner_id=user.id,
                title=OPPORTUNITY_TITLE,
            )
        )
    db.commit()
    print(f"seeded e2e tenant: {ORG_NAME}")


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
