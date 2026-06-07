from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.services.tender_watch import discover_tenders


class TenderScoreBreakdownRead(BaseModel):
    technical_fit: int = Field(ge=0, le=100)
    strategic_fit: int = Field(ge=0, le=100)
    commercial_fit: int = Field(ge=0, le=100)
    delivery_risk: int = Field(ge=0, le=100)
    reference_fit: int = Field(ge=0, le=100)
    global_score: int = Field(ge=0, le=100)
    recommendation: str
    rationale: list[str]


class TenderWatchCandidateRead(BaseModel):
    title: str
    reference: str
    buyer_name: str
    country: str
    sector: str
    source_name: str
    source_url: str
    summary: str
    estimated_value: float = Field(ge=0)
    deadline: str | None = None
    requirements: list[str]
    qualification_score: int = Field(ge=0, le=100)
    recommendation: str
    score_breakdown: TenderScoreBreakdownRead
    rationale: list[str]


router = APIRouter(
    prefix="/tender-watch",
    tags=["tender-watch"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/search", response_model=list[TenderWatchCandidateRead])
def search_tender_watch(
    q: str = Query(default="", description="Keywords used to filter opportunities"),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Discover normalized tender candidates from configured watch sources."""
    return discover_tenders(query=q, limit=limit)
