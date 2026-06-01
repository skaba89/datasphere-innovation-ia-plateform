from fastapi import APIRouter

from app.api.v1.endpoints import (
    agent_actions,
    agents,
    analytics,
    audit_logs,
    auth,
    contacts,
    deliverables,
    export,
    opportunities,
    organizations,
    scheduler,
    sector_templates,
    tender_governance,
    tender_templates,
    tenders,
)

router = APIRouter()

router.include_router(auth.router)
router.include_router(organizations.router)
router.include_router(contacts.router)
router.include_router(opportunities.router)
router.include_router(tenders.router)
router.include_router(tender_governance.router)
router.include_router(tender_templates.router)
router.include_router(agents.router)
router.include_router(agent_actions.router)
router.include_router(deliverables.router)
router.include_router(scheduler.router)
router.include_router(analytics.router)
router.include_router(audit_logs.router)
router.include_router(export.router)
router.include_router(sector_templates.router)


@router.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "datasphere-platform-api"}


@router.get("/version", tags=["health"])
def version() -> dict[str, str]:
    return {"version": "1.3.0", "stage": "crm-pipeline-advanced"}
