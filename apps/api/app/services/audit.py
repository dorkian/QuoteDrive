from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent


def record_audit_event(
    db: Session,
    *,
    organization_id: int,
    actor_id: int,
    actor_name: str,
    entity_type: str,
    entity_id: int,
    action: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditEvent(
            organization_id=organization_id,
            actor_id=actor_id,
            actor_name=actor_name,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before_json=before,
            after_json=after,
        )
    )
