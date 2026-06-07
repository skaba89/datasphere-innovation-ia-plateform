from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.crud.tender import get_tender, list_tender_requirements
from app.db.session import get_db
from app.services.staffing_matching_service import build_staffing_recommendation


class ConsultantProfileRead(BaseModel):
    id: int
    full_name: str
    role: str
    seniority: str
    daily_rate: float
    availability_percent: int = Field(ge=0, le=100)
    location: str
    skills: list[str]
    certifications: list[str]
    languages: list[str]
    references: list[str]


class ConsultantMatchRead(BaseModel):
    consultant: ConsultantProfileRead
    match_score: int = Field(ge=0, le=100)
    matched_terms: list[str]
    recommendation: str
    rationale: list[str]


class StaffingGapAnalysisRead(BaseModel):
    required_skills: list[str]
    covered_skills: list[str]
    missing_skills: list[str]
    coverage_rate: int = Field(ge=0, le=100)
    recommended_actions: list[str]


class TenderStaffingRecommendationRead(BaseModel):
    tender_id: int
    tender_title: str
    recommended_team: list[ConsultantMatchRead]
    global_team_score: int = Field(ge=0, le=100)
    summary: str
    gap_analysis: StaffingGapAnalysisRead


router = APIRouter(
    prefix="/staffing",
    tags=["staffing"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/tenders/{tender_id}/match", response_model=TenderStaffingRecommendationRead)
def match_tender_staffing(
    tender_id: int,
    max_results: int = Query(default=5, ge=1, le=10),
    db: Session = Depends(get_db),
):
    tender = get_tender(db, tender_id)
    if tender is None:
        raise HTTPException(status_code=404, detail="Tender not found")

    requirements = list_tender_requirements(db, tender_id=tender_id, skip=0, limit=500)
    requirement_texts = [requirement.description for requirement in requirements]
    recommendation = build_staffing_recommendation(
        title=tender.title,
        sector=getattr(tender, "buyer_name", "") or "",
        summary=getattr(tender, "summary", "") or "",
        requirements=requirement_texts,
        max_results=max_results,
    )

    return {
        "tender_id": tender.id,
        "tender_title": tender.title,
        **recommendation,
    }
