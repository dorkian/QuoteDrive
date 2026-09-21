from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, require_role
from app.core.database import get_db
from app.models import (
    ApprovalComment,
    ApprovalRequest,
    ApprovalRequestStatus,
    ProposalVersion,
    ProposalVersionStatus,
    Role,
)
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.approval_request import (
    ApprovalRequestOut,
    ApproveRequest,
    RequestChangesRequest,
)
from app.services.audit import record_audit_event

router = APIRouter(tags=["approval-requests"])

_can_decide = require_role(Role.ADMIN, Role.APPROVER)


def _get_approval_request_or_404(
    db: Session, request_id: int, organization_id: int
) -> ApprovalRequest:
    return get_tenant_scoped_or_404(db, ApprovalRequest, request_id, organization_id)


@router.post("/approval-requests/{request_id}/approve", response_model=ApprovalRequestOut)
def approve_request(
    request_id: int,
    body: ApproveRequest,
    current: CurrentMembership = Depends(_can_decide),
    db: Session = Depends(get_db),
) -> ApprovalRequest:
    approval_request = _get_approval_request_or_404(db, request_id, current.organization.id)
    version = get_tenant_scoped_or_404(
        db, ProposalVersion, approval_request.proposal_version_id, current.organization.id
    )

    if approval_request.status != ApprovalRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Request already decided"
        )
    if version.status != ProposalVersionStatus.AWAITING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal version is not awaiting approval",
        )
    if current.user.id == version.created_by:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Cannot approve your own version"
        )

    now = datetime.now(UTC)
    request_before = {"status": approval_request.status.value}
    version_before = {"status": version.status.value}

    approval_request.status = ApprovalRequestStatus.APPROVED
    approval_request.decision_at = now
    version.status = ProposalVersionStatus.APPROVED

    if body.comment:
        db.add(
            ApprovalComment(
                approval_request_id=approval_request.id,
                author_id=current.user.id,
                body=body.comment,
            )
        )

    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="approval_request",
        entity_id=approval_request.id,
        action="approve",
        before=request_before,
        after={"status": approval_request.status.value},
    )
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="proposal_version",
        entity_id=version.id,
        action="approve",
        before=version_before,
        after={"status": version.status.value},
    )
    db.commit()
    db.refresh(approval_request)
    return approval_request


@router.post("/approval-requests/{request_id}/request-changes", response_model=ApprovalRequestOut)
def request_changes(
    request_id: int,
    body: RequestChangesRequest,
    current: CurrentMembership = Depends(_can_decide),
    db: Session = Depends(get_db),
) -> ApprovalRequest:
    approval_request = _get_approval_request_or_404(db, request_id, current.organization.id)
    version = get_tenant_scoped_or_404(
        db, ProposalVersion, approval_request.proposal_version_id, current.organization.id
    )

    if approval_request.status != ApprovalRequestStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Request already decided"
        )
    if version.status != ProposalVersionStatus.AWAITING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Proposal version is not awaiting approval",
        )
    if current.user.id == version.created_by:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot request changes on your own version",
        )

    now = datetime.now(UTC)
    request_before = {"status": approval_request.status.value}
    version_before = {"status": version.status.value}

    approval_request.status = ApprovalRequestStatus.CHANGES_REQUESTED
    approval_request.decision_at = now
    version.status = ProposalVersionStatus.CHANGES_REQUESTED

    db.add(
        ApprovalComment(
            approval_request_id=approval_request.id,
            author_id=current.user.id,
            body=body.comment,
        )
    )

    max_ver = db.execute(
        select(func.max(ProposalVersion.version_number)).where(
            ProposalVersion.opportunity_id == version.opportunity_id,
            ProposalVersion.organization_id == current.organization.id,
        )
    ).scalar_one()

    new_version = ProposalVersion(
        organization_id=current.organization.id,
        opportunity_id=version.opportunity_id,
        version_number=max_ver + 1,
        status=ProposalVersionStatus.DRAFT,
        content_json=version.content_json,
        total_estimate=version.total_estimate,
        created_by=version.created_by,
    )
    db.add(new_version)
    db.flush()

    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="approval_request",
        entity_id=approval_request.id,
        action="request_changes",
        before=request_before,
        after={"status": approval_request.status.value},
    )
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="proposal_version",
        entity_id=version.id,
        action="changes_requested",
        before=version_before,
        after={"status": version.status.value},
    )
    record_audit_event(
        db,
        organization_id=current.organization.id,
        actor_id=current.user.id,
        entity_type="proposal_version",
        entity_id=new_version.id,
        action="create",
        after={
            "opportunity_id": new_version.opportunity_id,
            "version_number": new_version.version_number,
            "status": new_version.status.value,
            "total_estimate": str(new_version.total_estimate),
        },
    )
    db.commit()
    db.refresh(approval_request)
    return approval_request
