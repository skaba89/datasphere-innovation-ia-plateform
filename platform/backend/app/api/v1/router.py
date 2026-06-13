from fastapi import APIRouter

from app.api.v1.endpoints import (
    activity, agent_actions, agents, analytics, api_keys, audit_logs,
    csv_import,
    auth, billing, calculator, contact, contacts, data_mission, deliverables,
    cv_generator, email_api, linkedin_oauth, excel_export, export, reports,
    health_monitor, linkedin, notifications, opportunities, organizations, pdf_ao,
    providers, scheduler, search, sector_templates, sse,
    staffing, suggestions, team, tender_governance, tender_templates,
    setup, tender_watch, tenders, uploads, webhooks, workflow, workspaces,
)

router = APIRouter()

router.include_router(auth.router)
router.include_router(billing.router)
router.include_router(api_keys.router)
router.include_router(csv_import.router)
router.include_router(setup.router)
router.include_router(webhooks.router)
router.include_router(workflow.router)
router.include_router(calculator.router)
router.include_router(cv_generator.router)
router.include_router(linkedin_oauth.router)
router.include_router(reports.router)
router.include_router(email_api.router)
router.include_router(linkedin.router)
router.include_router(pdf_ao.router)
router.include_router(contact.router)
router.include_router(team.router)
router.include_router(organizations.router)
router.include_router(contacts.router)
router.include_router(opportunities.router)
router.include_router(tenders.router)
router.include_router(tender_governance.router)
router.include_router(tender_templates.router)
router.include_router(tender_watch.router)
router.include_router(staffing.router)
router.include_router(data_mission.router)
router.include_router(agents.router)
router.include_router(agent_actions.router)
router.include_router(deliverables.router)
router.include_router(scheduler.router)
router.include_router(analytics.router)
router.include_router(audit_logs.router)
router.include_router(export.router)
router.include_router(excel_export.router)
router.include_router(sector_templates.router)
router.include_router(search.router)
router.include_router(activity.router)
router.include_router(notifications.router)
router.include_router(sse.router)
router.include_router(suggestions.router)
router.include_router(health_monitor.router)
router.include_router(providers.router)
router.include_router(uploads.router)
router.include_router(workspaces.router)


@router.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "datasphere-platform-api"}


@router.get("/version", tags=["health"])
def version() -> dict[str, str]:
    return {"version": "1.8.0", "stage": "data-mission-studio"}
