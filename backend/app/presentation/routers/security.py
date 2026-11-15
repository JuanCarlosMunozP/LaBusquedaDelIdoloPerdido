"""Auditoria de seguridad (solo administracion)."""
from fastapi import Depends, Query, APIRouter
from app.domain.entities.session import UserSession
from app.presentation.dependencies import get_repositories, require_admin_access
from app.presentation.schemas import AuditLogEntryResponse

router = APIRouter()


@router.get(
    "/security/audit-logs",
    response_model=list[AuditLogEntryResponse],
    tags=["Security Audit & Pentest Evidence"],
)
def list_security_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    _admin_session: UserSession = Depends(require_admin_access),
    repos=Depends(get_repositories),
) -> list[AuditLogEntryResponse]:
    _, _, _, audit_repo = repos
    logs = audit_repo.list_recent(limit=limit)
    return [
        AuditLogEntryResponse(
            id=item.id,
            event_type=item.event_type,
            username=item.username,
            ip_address=item.ip_address,
            user_agent=item.user_agent,
            details=item.details,
            created_at=item.created_at,
        )
        for item in logs
    ]
