from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_current_membership, require_role
from app.core.database import get_db
from app.models import Opportunity, ProposalVersion, ProposalVersionStatus, Role
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.proposal_version import (
    ProposalVersionCreate,
    ProposalVersionOut,
    ProposalVersionUpdate,
)
from app.services.audit import record_audit_event
from app.services.estimate_service import (
    calculate_proposal_total,
    resolve_line_estimate,
)

router = APIRouter(tags=["proposal-versions"])

_can_edit = require_role(Role.ADMIN, Role.PROPOSAL_MANAGER)


@router.post(
    "/opportunities/{opportunity_id}/versions", response_model=ProposalVersionOut, status_code=201
)
def create_proposal_version(
    opportunity_id: int,
    body: ProposalVersionCreate | None = None,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> ProposalVersion:
    opportunity = get_tenant_scoped_or_404(db, Opportunity, opportunity_id, current.organization.id)

    max_ver = (
        db.execute(
            select(func.max(ProposalVersion.version_number)).where(
                ProposalVersion.opportunity_id == opportunity.id,
                ProposalVersion.organization_id == current.organization.id,
            )
        ).scalar()
        or 0
    )
    version_number = max_ver + 1

    content_json: dict[str, Any] = {"lines": []}
    total_estimate = Decimal(0)

    if body and body.from_version_id is not None:
        source_version = get_tenant_scoped_or_404(
            db, ProposalVersion, body.from_version_id, current.organization.id
        )
        if source_version.opportunity_id != opportunity.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        content_json = source_version.content_json
        total_estimate = source_version.total_estimate

    version = ProposalVersion(
        organization_id=current.organization.id,
        opportunity_id=opportunity.id,
        version_number=version_number,
        status=ProposalVersionStatus.DRAFT,
        content_json=content_json,
        total_estimate=total_estimate,
        created_by=current.user.id,
    )
    db.add(version)
    db.flush()
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="proposal_version",
        entity_id=version.id,
        action="create",
        after={
            "opportunity_id": version.opportunity_id,
            "version_number": version.version_number,
            "status": version.status.value,
            "total_estimate": str(version.total_estimate),
        },
    )
    db.commit()
    db.refresh(version)
    return version


@router.get("/opportunities/{opportunity_id}/versions", response_model=list[ProposalVersionOut])
def list_proposal_versions(
    opportunity_id: int,
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> list[ProposalVersion]:
    opportunity = get_tenant_scoped_or_404(db, Opportunity, opportunity_id, current.organization.id)
    stmt = (
        select(ProposalVersion)
        .where(
            ProposalVersion.opportunity_id == opportunity.id,
            ProposalVersion.organization_id == current.organization.id,
        )
        .order_by(ProposalVersion.version_number.desc())
    )
    return list(db.execute(stmt).scalars().all())


@router.get("/proposal-versions/{version_id}", response_model=ProposalVersionOut)
def get_proposal_version(
    version_id: int,
    current: CurrentMembership = Depends(get_current_membership),
    db: Session = Depends(get_db),
) -> ProposalVersion:
    return get_tenant_scoped_or_404(db, ProposalVersion, version_id, current.organization.id)


@router.patch("/proposal-versions/{version_id}", response_model=ProposalVersionOut)
def update_proposal_version(
    version_id: int,
    body: ProposalVersionUpdate,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> ProposalVersion:
    version = get_tenant_scoped_or_404(db, ProposalVersion, version_id, current.organization.id)

    if version.status not in (ProposalVersionStatus.DRAFT, ProposalVersionStatus.CONFIGURED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Version is immutable")

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

    before = {
        "status": version.status.value,
        "total_estimate": str(version.total_estimate),
    }

    version.total_estimate = calculate_proposal_total(r.line_total for r in line_results)
    version.content_json = {
        "lines": [
            {**r.model_dump(mode="json"), "assumptions": line.assumptions}
            for line, r in zip(body.lines, line_results, strict=True)
        ]
    }

    if version.status == ProposalVersionStatus.DRAFT:
        version.status = ProposalVersionStatus.CONFIGURED

    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="proposal_version",
        entity_id=version.id,
        action="update",
        before=before,
        after={
            "status": version.status.value,
            "total_estimate": str(version.total_estimate),
        },
    )
    db.commit()
    db.refresh(version)
    return version


@router.post("/proposal-versions/{version_id}/finalize", response_model=ProposalVersionOut)
def finalize_proposal_version(
    version_id: int,
    current: CurrentMembership = Depends(_can_edit),
    db: Session = Depends(get_db),
) -> ProposalVersion:
    version = get_tenant_scoped_or_404(db, ProposalVersion, version_id, current.organization.id)

    if version.status not in (ProposalVersionStatus.DRAFT, ProposalVersionStatus.CONFIGURED):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Version is immutable")

    before = {"status": version.status.value}
    version.status = ProposalVersionStatus.PROPOSAL_DRAFTED

    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="proposal_version",
        entity_id=version.id,
        action="finalize",
        before=before,
        after={"status": version.status.value},
    )
    db.commit()
    db.refresh(version)
    return version
