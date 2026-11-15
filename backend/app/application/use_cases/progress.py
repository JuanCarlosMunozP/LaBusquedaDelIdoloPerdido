"""Casos de uso del progreso del jugador (con firma de integridad y reglas anti-trampa)."""
from app.application.dtos import ProgressDTO
from app.core.security import (
    emit_structured_security_log,
    sign_progress,
    verify_progress_signature,
)
from app.domain.entities.audit_log import SecurityAuditLog
from app.domain.entities.progress import GameProgress
from app.domain.exceptions import (
    InvalidCredentialsError,
    TamperDetectedError,
)
from app.domain.repositories import (
    AbstractAuditRepository,
    AbstractProgressRepository,
    AbstractUserRepository,
)


class GetProgressUseCase:
    """CU-018 — Cargar progreso verificando integridad HMAC-SHA256 en servidor."""

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        progress_repo: AbstractProgressRepository,
        audit_repo: AbstractAuditRepository,
    ):
        self.user_repo = user_repo
        self.progress_repo = progress_repo
        self.audit_repo = audit_repo

    def execute(self, username: str, ip_address: str = "0.0.0.0", user_agent: str = "") -> ProgressDTO:
        user = self.user_repo.get_by_username(username.lower())
        if user is None:
            raise InvalidCredentialsError("Sesión inválida.")

        progress = self.progress_repo.get_by_user_id(user.id)
        if progress is None:
            fresh_hmac = sign_progress(user.username, 1, 0, 0)
            progress = GameProgress(
                user_id=user.id,
                username=user.username,
                current_level=1,
                best_time_seconds=0,
                victories=0,
                integrity_hmac=fresh_hmac,
            )
            self.progress_repo.save(progress)
            return ProgressDTO(nivel=1, mejor_tiempo=0, victorias=0)

        aviso = None
        if not verify_progress_signature(
            user.username,
            progress.current_level,
            progress.best_time_seconds,
            progress.victories,
            progress.integrity_hmac,
        ):
            fresh_hmac = sign_progress(user.username, 1, 0, 0)
            progress.reset_to_safe_default(fresh_hmac)
            self.progress_repo.save(progress)
            aviso = "Se detectó una modificación externa del progreso en base de datos; se restableció al nivel 1."
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type="DB_TAMPER_RESET",
                    user_id=user.id,
                    username=user.username,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            )
            emit_structured_security_log("DB_TAMPER_RESET", user.username, ip_address)

        return ProgressDTO(
            nivel=progress.current_level,
            mejor_tiempo=progress.best_time_seconds,
            victorias=progress.victories,
            aviso=aviso,
        )


class UpdateProgressUseCase:
    """CU-017 — Guardar progreso aplicando reglas anti-trampa y firma HMAC-SHA256 en servidor."""

    def __init__(
        self,
        user_repo: AbstractUserRepository,
        progress_repo: AbstractProgressRepository,
        audit_repo: AbstractAuditRepository,
    ):
        self.user_repo = user_repo
        self.progress_repo = progress_repo
        self.audit_repo = audit_repo

    def execute(
        self,
        username: str,
        requested_level: int | None,
        victory_seconds: int | None,
        ip_address: str,
        user_agent: str,
    ) -> ProgressDTO:
        user = self.user_repo.get_by_username(username.lower())
        if user is None:
            raise InvalidCredentialsError("Sesión inválida.")

        get_uc = GetProgressUseCase(self.user_repo, self.progress_repo, self.audit_repo)
        get_uc.execute(user.username, ip_address, user_agent)

        progress = self.progress_repo.get_by_user_id(user.id)
        assert progress is not None

        try:
            progress.apply_progress_update(
                requested_level=requested_level,
                victory_seconds=victory_seconds,
            )
        except TamperDetectedError as exc:
            details = {
                "current_level": progress.current_level,
                "requested_level": requested_level,
                "victory_seconds": victory_seconds,
                "reason": str(exc),
            }
            self.audit_repo.record(
                SecurityAuditLog(
                    event_type="TAMPER_BLOCKED",
                    user_id=user.id,
                    username=user.username,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details=details,
                )
            )
            emit_structured_security_log("TAMPER_BLOCKED", user.username, ip_address, details)
            raise

        progress.integrity_hmac = sign_progress(
            user.username,
            progress.current_level,
            progress.best_time_seconds,
            progress.victories,
        )
        self.progress_repo.save(progress)

        details = {
            "nivel": progress.current_level,
            "mejor_tiempo": progress.best_time_seconds,
            "victorias": progress.victories,
        }
        self.audit_repo.record(
            SecurityAuditLog(
                event_type="PROGRESS_UPDATED",
                user_id=user.id,
                username=user.username,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details,
            )
        )
        emit_structured_security_log("PROGRESS_UPDATED", user.username, ip_address, details)

        return ProgressDTO(
            nivel=progress.current_level,
            mejor_tiempo=progress.best_time_seconds,
            victorias=progress.victories,
        )
