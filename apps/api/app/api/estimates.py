from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, require_role
from app.core.database import get_db
from app.models import Role
from app.schemas.estimate import (
    EstimateCalculateRequest,
    EstimateCalculateResponse,
)
from app.services.estimate_service import (
    ILLUSTRATIVE_DISCLAIMER,
    calculate_proposal_total,
    resolve_line_estimate,
)

router = APIRouter(prefix="/estimates", tags=["estimates"])

_can_configure = require_role(Role.ADMIN, Role.PROPOSAL_MANAGER)


@router.post("/calculate", response_model=EstimateCalculateResponse)
def calculate_estimate(
    body: EstimateCalculateRequest,
    current: CurrentMembership = Depends(_can_configure),
    db: Session = Depends(get_db),
) -> EstimateCalculateResponse:
    line_results = [
        resolve_line_estimate(
            db,
            current.organization.id,
            line.catalogue_item_id,
            line.add_on_item_ids,
            line.quantity,
        )
        for line in body.lines
    ]
    total_estimate = calculate_proposal_total(r.line_total for r in line_results)

    return EstimateCalculateResponse(
        lines=line_results,
        total_estimate=total_estimate,
        disclaimer=ILLUSTRATIVE_DISCLAIMER,
    )
