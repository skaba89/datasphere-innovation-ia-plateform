from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.schemas.analytics import PipelineAnalytics
from app.services.analytics_service import get_pipeline_analytics

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/pipeline", response_model=PipelineAnalytics)
def pipeline_analytics(db: Session = Depends(get_db)):
    """
    Return comprehensive pipeline KPIs in a single call:
    opportunities, tenders, agents, deliverables, scheduler stats + notifications.
    """
    return get_pipeline_analytics(db)
