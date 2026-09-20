"""Seed the demo tenant, demo users, and a few demo opportunities from
docs/product/demo-scenario.md.

Idempotent — safe to run multiple times. Run after `alembic upgrade head`:

    python -m scripts.seed_demo
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import (
    CatalogueItem,
    Customer,
    Opportunity,
    Organization,
    OrganizationMembership,
    Role,
    User,
)
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

CATALOGUE_ITEMS = [
    # Packages
    ("package", "Electric City", "electric_city", Decimal("649.00")),
    ("package", "Hybrid Account Manager", "hybrid", Decimal("549.00")),
    ("package", "Long Distance", "long_distance", Decimal("729.00")),
    # Add-ons
    ("add_on", "Maintenance", "maintenance", Decimal("89.00")),
    ("add_on", "Tyres", "tyres", Decimal("35.00")),
    ("add_on", "Roadside Assistance", "roadside_assistance", Decimal("19.00")),
    ("add_on", "Home Charging Advisory", "home_charging_advisory", Decimal("59.00")),
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

    customer = db.execute(
        select(Customer).where(
            Customer.organization_id == org.id, Customer.name == "Lombarda Studio Group"
        )
    ).scalar_one_or_none()
    if customer is None:
        customer = Customer(
            organization_id=org.id,
            name="Lombarda Studio Group",
            industry="Professional Services",
        )
        db.add(customer)
        db.flush()
        record_audit_event(
            db,
            organization_id=org.id,
            actor_id=manager.id,
            entity_type="customer",
            entity_id=customer.id,
            action="create",
            after={
                "name": customer.name,
                "industry": customer.industry,
                "status": customer.status,
            },
        )
        print(f"created customer: {customer.name}")

    for title in DEMO_OPPORTUNITIES:
        existing = db.execute(
            select(Opportunity).where(
                Opportunity.organization_id == org.id, Opportunity.title == title
            )
        ).scalar_one_or_none()
        if existing is None:
            opportunity = Opportunity(
                organization_id=org.id,
                customer_id=customer.id,
                owner_id=manager.id,
                title=title,
            )
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

    for type_, name, category, price in CATALOGUE_ITEMS:
        existing_item = db.execute(
            select(CatalogueItem).where(
                CatalogueItem.organization_id == org.id,
                CatalogueItem.type == type_,
                CatalogueItem.name == name,
            )
        ).scalar_one_or_none()
        if existing_item is None:
            item = CatalogueItem(
                organization_id=org.id,
                type=type_,
                name=name,
                category=category,
                base_monthly_estimate=price,
                active=True,
            )
            db.add(item)
            print(f"created catalogue item: {name} (${price})")

    db.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
