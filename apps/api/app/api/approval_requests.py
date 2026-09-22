from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, aliased

from app.api.deps import CurrentMembership, require_role
from app.core.database import get_db
from app.models import (
    ApprovalComment,
    ApprovalRequest,
    ApprovalRequestStatus,
    Opportunity,
    ProposalVersion,
    ProposalVersionStatus,
    Role,
    User,
)
from app.repositories.base import get_tenant_scoped_or_404
from app.schemas.approval_request import (
    ApprovalRequestListItem,
    ApproveRequest,
    RequestChangesRequest,
)
from app.services.audit import record_audit_event

router = APIRouter(tags=["approval-requests"])

_can_decide = require_role(Role.ADMIN, Role.APPROVER)

requester_alias = aliased(User, name="requester")
assignee_alias = aliased(User, name="assignee")


def _approval_request_list_item_from_row(
    req: ApprovalRequest,
    opp_id: int,
    opp_title: str,
    ver_num: int,
    req_name: str,
    asg_name: str,
) -> ApprovalRequestListItem:
    return ApprovalRequestListItem(
        id=req.id,
        organization_id=req.organization_id,
        proposal_version_id=req.proposal_version_id,
        requested_by=req.requested_by,
        assigned_to=req.assigned_to,
        status=req.status,
        decision_at=req.decision_at,
        created_at=req.created_at,
        opportunity_id=opp_id,
        opportunity_title=opp_title,
        version_number=ver_num,
        requested_by_name=req_name,
        assigned_to_name=asg_name,
    )


def _base_approval_request_query() -> Select[Any]:
    return (
        select(
            ApprovalRequest,
            Opportunity.id.label("opportunity_id"),
            Opportunity.title.label("opportunity_title"),
            ProposalVersion.version_number.label("version_number"),
            requester_alias.display_name.label("requested_by_name"),
            assignee_alias.display_name.label("assigned_to_name"),
        )
        .join(ProposalVersion, ApprovalRequest.proposal_version_id == ProposalVersion.id)
        .join(Opportunity, ProposalVersion.opportunity_id == Opportunity.id)
        .join(requester_alias, ApprovalRequest.requested_by == requester_alias.id)
        .join(assignee_alias, ApprovalRequest.assigned_to == assignee_alias.id)
    )


@router.get("/approval-requests", response_model=list[ApprovalRequestListItem])
def list_approval_requests(
    status_filter: ApprovalRequestStatus | None = Query(default=None, alias="status"),
    current: CurrentMembership = Depends(_can_decide),
    db: Session = Depends(get_db),
) -> list[ApprovalRequestListItem]:
    stmt = (
        _base_approval_request_query()
        .where(ApprovalRequest.organization_id == current.organization.id)
        .order_by(ApprovalRequest.created_at.desc())
    )
    if status_filter is not None:
        stmt = stmt.where(ApprovalRequest.status == status_filter)

    rows = db.execute(stmt).all()
    return [_approval_request_list_item_from_row(*row) for row in rows]


def _get_approval_request_item(
    db: Session, request_id: int, organization_id: int
) -> ApprovalRequestListItem:
    stmt = _base_approval_request_query().where(
        ApprovalRequest.id == request_id,
        ApprovalRequest.organization_id == organization_id,
    )
    row = db.execute(stmt).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _approval_request_list_item_from_row(*row)


@router.get("/approval-requests/{request_id}", response_model=ApprovalRequestListItem)
def get_approval_request(
    request_id: int,
    current: CurrentMembership = Depends(_can_decide),
    db: Session = Depends(get_db),
) -> ApprovalRequestListItem:
    return _get_approval_request_item(db, request_id, current.organization.id)


@router.post("/approval-requests/{request_id}/approve", response_model=ApprovalRequestListItem)
def approve_request(
    request_id: int,
    body: ApproveRequest,
    current: CurrentMembership = Depends(_can_decide),
    db: Session = Depends(get_db),
) -> ApprovalRequestListItem:
    # Row-locked: a concurrent approve/request-changes call on the same request
    # must block here rather than both reading PENDING and racing to commit.
    approval_request = get_tenant_scoped_or_404(
        db, ApprovalRequest, request_id, current.organization.id, for_update=True
    )
    version = get_tenant_scoped_or_404(
        db,
        ProposalVersion,
        approval_request.proposal_version_id,
        current.organization.id,
        for_update=True,
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
    return _get_approval_request_item(db, approval_request.id, current.organization.id)


@router.post(
    "/approval-requests/{request_id}/request-changes",
    response_model=ApprovalRequestListItem,
)
def request_changes(
    request_id: int,
    body: RequestChangesRequest,
    current: CurrentMembership = Depends(_can_decide),
    db: Session = Depends(get_db),
) -> ApprovalRequestListItem:
    # Row-locked: a concurrent approve/request-changes call on the same request
    # must block here rather than both reading PENDING and racing to commit.
    approval_request = get_tenant_scoped_or_404(
        db, ApprovalRequest, request_id, current.organization.id, for_update=True
    )
    version = get_tenant_scoped_or_404(
        db,
        ProposalVersion,
        approval_request.proposal_version_id,
        current.organization.id,
        for_update=True,
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

    # Lock the opportunity row so version-number allocation for it is serialized
    # against any concurrent version creation (this fork, or a fresh draft via
    # POST /opportunities/{id}/versions) — otherwise two concurrent inserts can
    # each compute the same max(version_number) and collide.
    get_tenant_scoped_or_404(
        db, Opportunity, version.opportunity_id, current.organization.id, for_update=True
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
    return _get_approval_request_item(db, approval_request.id, current.organization.id)
