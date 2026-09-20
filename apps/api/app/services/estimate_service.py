from collections.abc import Iterable
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import CatalogueItem
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.estimate import EstimateLineResult

ILLUSTRATIVE_DISCLAIMER = "Illustrative planning estimate only."


def calculate_line_total(
    base_monthly_estimate: Decimal, add_on_total: Decimal, quantity: int
) -> Decimal:
    return (base_monthly_estimate + add_on_total) * quantity


def calculate_proposal_total(line_totals: Iterable[Decimal]) -> Decimal:
    return sum(line_totals, start=Decimal(0))


def resolve_line_estimate(
    db: Session,
    organization_id: int,
    catalogue_item_id: int,
    add_on_item_ids: list[int],
    quantity: int,
) -> EstimateLineResult:
    package = get_tenant_scoped_or_404(db, CatalogueItem, catalogue_item_id, organization_id)
    if not package.active or package.type != "package":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    add_on_total = Decimal(0)
    for add_on_id in add_on_item_ids:
        add_on = get_tenant_scoped_or_404(db, CatalogueItem, add_on_id, organization_id)
        if not add_on.active or add_on.type != "add_on":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        add_on_total += add_on.base_monthly_estimate

    unit_estimate = package.base_monthly_estimate + add_on_total
    line_total = calculate_line_total(package.base_monthly_estimate, add_on_total, quantity)

    return EstimateLineResult(
        catalogue_item_id=package.id,
        name=package.name,
        category=package.category,
        quantity=quantity,
        add_on_item_ids=add_on_item_ids,
        unit_estimate=unit_estimate,
        line_total=line_total,
    )
