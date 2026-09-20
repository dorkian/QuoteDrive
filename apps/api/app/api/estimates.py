from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, require_role
from app.core.database import get_db
from app.models import CatalogueItem, Role
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.estimate import (
    EstimateCalculateRequest,
    EstimateCalculateResponse,
    EstimateLineResult,
)
from app.services.estimate_service import (
    ILLUSTRATIVE_DISCLAIMER,
    calculate_line_total,
    calculate_proposal_total,
)

router = APIRouter(prefix="/estimates", tags=["estimates"])

_can_configure = require_role(Role.ADMIN, Role.PROPOSAL_MANAGER)


@router.post("/calculate", response_model=EstimateCalculateResponse)
def calculate_estimate(
    body: EstimateCalculateRequest,
    current: CurrentMembership = Depends(_can_configure),
    db: Session = Depends(get_db),
) -> EstimateCalculateResponse:
    line_results: list[EstimateLineResult] = []

    for line in body.lines:
        package = get_tenant_scoped_or_404(
            db, CatalogueItem, line.catalogue_item_id, current.organization.id
        )
        if not package.active or package.type != "package":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

        add_on_total = Decimal("0")
        for add_on_id in line.add_on_item_ids:
            add_on = get_tenant_scoped_or_404(
                db, CatalogueItem, add_on_id, current.organization.id
            )
            if not add_on.active or add_on.type != "add_on":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
            add_on_total += add_on.base_monthly_estimate

        unit_estimate = package.base_monthly_estimate + add_on_total
        line_total = calculate_line_total(
            package.base_monthly_estimate, add_on_total, line.quantity
        )

        line_results.append(
            EstimateLineResult(
                catalogue_item_id=package.id,
                name=package.name,
                category=package.category,
                quantity=line.quantity,
                unit_estimate=unit_estimate,
                line_total=line_total,
            )
        )

    total_estimate = calculate_proposal_total(r.line_total for r in line_results)

    return EstimateCalculateResponse(
        lines=line_results,
        total_estimate=total_estimate,
        disclaimer=ILLUSTRATIVE_DISCLAIMER,
    )

