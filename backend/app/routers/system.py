from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.config import get_settings

router = APIRouter(tags=["system"])
settings = get_settings()


@router.get("/health")
def health() -> dict[str, str]:
    """Return a lightweight liveness response without dependency checks."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "phase": "phase-4",
        "profile": settings.app_profile,
        "provider": settings.ai_chat_provider,
    }


@router.get("/ready")
def ready(request: Request):
    """Return readiness state based on startup dependency checks."""
    checks = getattr(request.app.state, "startup_checks", {})
    startup_error = getattr(request.app.state, "startup_error", "")
    is_ready = checks and all(checks.values()) and not startup_error

    payload = {
        "status": "ready" if is_ready else "not-ready",
        "checks": checks,
        "error": startup_error,
    }

    if is_ready:
        return payload

    return JSONResponse(status_code=503, content=payload)
