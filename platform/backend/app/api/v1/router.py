from fastapi import APIRouter

from app.api.v1.endpoints import auth, opportunities, organizations, tender_governance, tenders

router = APIRouter()

router.include_router(auth.router)
router.include_router(organizations.router)
router.include_router(opportunities.router)
router.include_router(tenders.router)
router.include_router(tender_governance.router)


@router.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "datasphere-platform-api"}


@router.get("/version", tags=["health"])
def version() -> dict[str, str]:
    return {"version": "0.5.0", "stage": "go-no-go-compliance-foundation"}
