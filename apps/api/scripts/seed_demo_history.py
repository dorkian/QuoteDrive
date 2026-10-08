"""Seed ~10 weeks of fictional proposal history for the Northstar demo tenant.

Fifteen customer "case studies" with different endings (won, lost, expired,
stuck in approval, still drafting) so the dashboard charts have real shape.
All names are fictional and the figures come from the demo catalogue.

Idempotent: it does nothing if its marker customer already exists. Run after
`seed_demo`:

    python -m scripts.seed_demo_history
"""

import random
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import (
    ApprovalRequest,
    ApprovalRequestStatus,
    AuditEvent,
    CatalogueItem,
    Customer,
    GenerationLog,
    Opportunity,
    Organization,
    OrganizationMembership,
    ProposalVersion,
    ProposalVersionStatus,
    Role,
    User,
)
from scripts.seed_demo import ORG_SLUG
from scripts.seed_demo import seed as seed_demo

MARKER = "Cedar & Pine Logistics"
S = ProposalVersionStatus

# (package, quantity, add-ons)
Line = tuple[str, int, tuple[str, ...]]


@dataclass
class Case:
    customer: str
    industry: str
    title: str
    age: int  # days since the opportunity was created
    end: ProposalVersionStatus  # where the latest version ends up
    lines: list[Line]
    revised: bool = False  # first version came back with "changes requested"
    ai: list[tuple[str, str, int, str | None]] = field(
        default_factory=list
    )  # provider, status, ms, fallback


CASES = [
    Case(
        "Cedar & Pine Logistics",
        "Logistics",
        "Last-Mile EV Pilot",
        68,
        S.WON,
        [("Electric City", 6, ("Maintenance",))],
        ai=[("ollama", "success", 21000, None)],
    ),
    Case(
        "Harbor Freight Cooperative",
        "Maritime",
        "Port Shuttle Renewal",
        61,
        S.WON,
        [("Long Distance", 4, ("Roadside Assistance",)), ("Hybrid Account Manager", 2, ())],
        ai=[("openrouter", "success", 3800, None)],
    ),
    Case(
        "Alder Health Network",
        "Healthcare",
        "Clinic Staff Mobility Programme",
        54,
        S.WON,
        [("Hybrid Account Manager", 8, ("Maintenance", "Tyres"))],
        revised=True,
        ai=[("ollama", "error", 30000, None), ("ollama", "success", 24000, None)],
    ),
    Case(
        "Brightwater Utilities",
        "Utilities",
        "Field Crew Fleet Refresh",
        52,
        S.LOST,
        [("Long Distance", 10, ("Maintenance",)), ("Electric City", 4, ())],
        ai=[("openrouter", "success", 4100, None)],
    ),
    Case(
        "Kestrel Biotech Campus",
        "Life Sciences",
        "Campus Shuttle Phase 2",
        44,
        S.WON,
        [("Electric City", 7, ("Home Charging Advisory",)), ("Hybrid Account Manager", 3, ())],
        ai=[
            ("openrouter", "success", 3500, None),
            ("ollama", "success", 19000, "openrouter timeout"),
        ],
    ),
    Case(
        "Meridian Law Partners",
        "Professional Services",
        "Executive Pool Cars",
        41,
        S.LOST,
        [("Hybrid Account Manager", 5, ("Roadside Assistance",))],
        ai=[("openrouter", "success", 3900, None)],
    ),
    Case(
        "Solace Hospitality Group",
        "Hospitality",
        "Hotel Airport Transfers",
        38,
        S.EXPIRED,
        [("Long Distance", 6, ("Tyres",))],
        ai=[("ollama", "success", 26000, None)],
    ),
    Case(
        "Tidewater Insurance Services",
        "Insurance",
        "Claims Adjuster Fleet",
        30,
        S.SHARED,
        [("Hybrid Account Manager", 9, ("Maintenance",))],
        ai=[("openrouter", "success", 3300, None)],
    ),
    Case(
        "Skyline Aviation Services",
        "Aviation",
        "Ground Crew Shuttles",
        27,
        S.WON,
        [("Electric City", 5, ("Roadside Assistance",)), ("Long Distance", 2, ())],
        ai=[("ollama", "success", 22000, None)],
    ),
    Case(
        "Vantage Media Studios",
        "Media",
        "Production Crew Transport",
        24,
        S.CONFIGURED,
        [("Long Distance", 3, ("Tyres",))],
        revised=True,
        ai=[("ollama", "error", 30000, None)],
    ),
    Case(
        "Peregrine Outdoor Co",
        "Retail",
        "Event Logistics Fleet",
        20,
        S.LOST,
        [("Long Distance", 5, ("Maintenance",))],
        ai=[("openrouter", "success", 4400, None)],
    ),
    Case(
        "Northgate University",
        "Education",
        "Student Mobility Pilot",
        17,
        S.APPROVED,
        [("Electric City", 8, ("Home Charging Advisory", "Roadside Assistance"))],
        ai=[("openrouter", "success", 3600, None)],
    ),
    Case(
        "Orchard Retail Collective",
        "Retail",
        "Regional Delivery Fleet",
        12,
        S.AWAITING_APPROVAL,
        [("Hybrid Account Manager", 6, ("Maintenance",)), ("Long Distance", 3, ())],
        ai=[("ollama", "success", 25000, None)],
    ),
    Case(
        "Quarry & Co",
        "Construction",
        "Depot Electrification Study",
        9,
        S.PROPOSAL_DRAFTED,
        [("Electric City", 4, ())],
        ai=[("openrouter", "success", 3700, None)],
    ),
    Case("Fernhill Council Services", "Public Sector", "Municipal Pool Vehicles", 6, S.DRAFT, []),
]

NARRATIVE = {
    "executive_summary": "A phased mobility programme sized from the discovery notes.",
    "recommended_approach": "Start with a pilot group, review usage monthly, then scale.",
    "scope": "The packages and add-ons listed in the proposal table.",
    "assumptions_exclusions": ["Start date to be confirmed.", "Charging access is not included."],
    "next_steps": ["Confirm start date.", "Agree the pilot group."],
    "email_draft": "Hello, please find the proposal attached. Figures are illustrative.",
    "provider": "fake",
    "model": "seed",
    "fallback_reason": None,
}


def _items(db: Session, org_id: int) -> dict[str, CatalogueItem]:
    rows = db.execute(select(CatalogueItem).where(CatalogueItem.organization_id == org_id))
    return {item.name: item for item in rows.scalars()}


def seed(db: Session) -> None:
    org = db.execute(select(Organization).where(Organization.slug == ORG_SLUG)).scalar_one_or_none()
    if org is None:
        seed_demo(db)
        org = db.execute(select(Organization).where(Organization.slug == ORG_SLUG)).scalar_one()
    if db.execute(
        select(Customer).where(Customer.organization_id == org.id, Customer.name == MARKER)
    ).scalar_one_or_none():
        print("demo history already seeded; nothing to do")
        return

    def user(role: Role) -> User:
        found = (
            db.execute(
                select(User)
                .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
                .where(
                    OrganizationMembership.organization_id == org.id,
                    OrganizationMembership.role == role,
                )
            )
            .scalars()
            .first()
        )
        assert found is not None, "run scripts.seed_demo first"
        return found

    manager, approver = user(Role.PROPOSAL_MANAGER), user(Role.APPROVER)
    catalogue = _items(db, org.id)
    rng = random.Random(2026)
    now = datetime.now(UTC)

    def at(day: float) -> datetime:
        """`day` days after nothing in particular, clamped so history never lies in the future."""
        return min(now - timedelta(days=day), now - timedelta(hours=1))

    def event(
        entity: str,
        entity_id: int,
        action: str,
        when: datetime,
        actor: User,
        after: dict[str, object] | None = None,
    ) -> None:
        db.add(
            AuditEvent(
                organization_id=org.id,
                actor_id=actor.id,
                actor_name=actor.display_name,
                entity_type=entity,
                entity_id=entity_id,
                action=action,
                after_json=after,
                created_at=when,
            )
        )

    for case in CASES:
        customer = Customer(
            organization_id=org.id,
            name=case.customer,
            industry=case.industry,
            created_at=at(case.age + 1),
        )
        db.add(customer)
        db.flush()
        opp_status = {S.WON: "won", S.LOST: "lost"}.get(case.end, "open")
        opp = Opportunity(
            organization_id=org.id,
            customer_id=customer.id,
            owner_id=manager.id,
            title=case.title,
            status=opp_status,
            created_at=at(case.age),
        )
        db.add(opp)
        db.flush()
        event("opportunity", opp.id, "create", at(case.age), manager, {"title": case.title})

        lines, total = [], Decimal(0)
        for name, qty, addons in case.lines:
            package = catalogue[name]
            extra = sum((catalogue[a].base_monthly_estimate for a in addons), Decimal(0))
            line_total = (package.base_monthly_estimate + extra) * qty
            total += line_total
            lines.append(
                {
                    "catalogue_item_id": package.id,
                    "name": name,
                    "category": package.category,
                    "quantity": qty,
                    "add_on_item_ids": [catalogue[a].id for a in addons],
                    "unit_estimate": str(package.base_monthly_estimate + extra),
                    "line_total": str(line_total),
                    "assumptions": None,
                }
            )

        # Timeline in "days since opportunity creation", then converted to absolute dates.
        step = case.age - 1  # first version one day after the opportunity
        plan: list[tuple[int, S, Decimal]] = []
        if case.revised:
            plan.append(
                (1, S.CHANGES_REQUESTED, total - total / 10)
            )  # v1 priced 10% lower, reworked in v2
        plan.append((len(plan) + 1, case.end, total))

        for number, status, version_total in plan:
            created = at(step)
            version = ProposalVersion(
                organization_id=org.id,
                opportunity_id=opp.id,
                version_number=number,
                status=status,
                total_estimate=version_total,
                content_json={"lines": lines},
                created_by=manager.id,
                created_at=created,
                narrative_json=NARRATIVE if status.value not in {"draft", "configured"} else None,
            )
            db.add(version)
            db.flush()
            event("proposal_version", version.id, "create", created, manager, {"status": "draft"})

            reviewed = status in {
                S.CHANGES_REQUESTED,
                S.APPROVED,
                S.SHARED,
                S.WON,
                S.LOST,
                S.EXPIRED,
                S.AWAITING_APPROVAL,
            }
            if reviewed:
                submitted = created + timedelta(days=1)
                request = ApprovalRequest(
                    organization_id=org.id,
                    proposal_version_id=version.id,
                    requested_by=manager.id,
                    assigned_to=approver.id,
                    status=ApprovalRequestStatus.PENDING,
                    created_at=submitted,
                )
                db.add(request)
                db.flush()
                event("proposal_version", version.id, "submit", submitted, manager)
                if status != S.AWAITING_APPROVAL:
                    decided = submitted + timedelta(hours=rng.randint(3, 52))
                    request.decision_at = min(decided, now - timedelta(minutes=30))
                    request.status = (
                        ApprovalRequestStatus.CHANGES_REQUESTED
                        if status == S.CHANGES_REQUESTED
                        else ApprovalRequestStatus.APPROVED
                    )
                    event(
                        "approval_request",
                        request.id,
                        "decide",
                        request.decision_at,
                        approver,
                        {"status": request.status.value},
                    )
            if status in {S.SHARED, S.WON, S.LOST, S.EXPIRED}:
                event("proposal_version", version.id, "share", created + timedelta(days=3), manager)
            if status in {S.WON, S.LOST, S.EXPIRED}:
                event(
                    "proposal_version",
                    version.id,
                    "outcome",
                    created + timedelta(days=rng.randint(6, 16)),
                    manager,
                    {"outcome": status.value},
                )
            step -= 2 if case.revised else 0
            step = max(step, 1)

        for provider, ai_status, latency, fallback in case.ai:
            db.add(
                GenerationLog(
                    organization_id=org.id,
                    actor_id=manager.id,
                    actor_name=manager.display_name,
                    entity_type="proposal_version",
                    entity_id=version.id,
                    provider=provider,
                    model="qwen2.5:7b" if provider == "ollama" else "openai/gpt-4o-mini",
                    prompt_version="narrative-v1",
                    latency_ms=latency,
                    status=ai_status,
                    error_detail="timeout" if ai_status == "error" else None,
                    fallback_reason=fallback,
                    created_at=at(max(step - 1, 1)),
                )
            )
        print(f"seeded case study: {case.customer} - {case.title} ({case.end.value})")

    db.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
