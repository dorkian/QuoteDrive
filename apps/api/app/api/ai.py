from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentMembership, get_ai_provider, require_role
from app.core.database import get_db
from app.models.membership import Role
from app.schemas.ai import (
    DiscoveryBriefRequest,
    DiscoveryBriefResponse,
    ProposalNarrativeRequest,
    ProposalNarrativeResponse,
)
from app.services.ai.discovery_service import generate_discovery_brief
from app.services.ai.narrative_service import (
    EmptyProposalError,
    NarrativeParsingError,
    generate_narrative,
)
from app.services.ai.providers.base import (
    GenerationProvider,
    ProviderAuthenticationError,
    ProviderResponseError,
    ProviderTimeoutError,
)

router = APIRouter(prefix="/ai", tags=["AI"])

_can_edit = require_role(Role.ADMIN, Role.PROPOSAL_MANAGER)


@router.post("/proposal-narrative", response_model=ProposalNarrativeResponse)
def create_proposal_narrative(
    request: ProposalNarrativeRequest,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(_can_edit),
    provider: GenerationProvider = Depends(get_ai_provider),
) -> ProposalNarrativeResponse:
    try:
        return generate_narrative(
            db=db,
            current=current,
            provider=provider,
            proposal_version_id=request.proposal_version_id,
            timeline=request.timeline,
        )
    except EmptyProposalError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Proposal has no lines")
    except ProviderAuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server misconfiguration"
        )
    except ProviderTimeoutError:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Provider timeout")
    except (ProviderResponseError, NarrativeParsingError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Bad response from provider"
        )


@router.post("/discovery-brief", response_model=DiscoveryBriefResponse)
def create_discovery_brief(
    request: DiscoveryBriefRequest,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(_can_edit),
    provider: GenerationProvider = Depends(get_ai_provider),
) -> DiscoveryBriefResponse:
    try:
        return generate_discovery_brief(
            db=db,
            current=current,
            provider=provider,
            opportunity_id=request.opportunity_id,
            notes=request.notes,
        )
    except ProviderAuthenticationError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server misconfiguration"
        )
    except ProviderTimeoutError:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Provider timeout")
    except (ProviderResponseError, NarrativeParsingError):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail="Bad response from provider"
        )
