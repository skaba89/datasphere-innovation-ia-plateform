from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.services.data_expert_agents_service import (
    run_data_analyst_agent,
    run_data_engineer_agent,
    run_data_expert_agents,
)


class DataMissionRequest(BaseModel):
    project_title: str = Field(min_length=3, max_length=250)
    context: str = Field(min_length=10)
    requirements: list[str] = Field(default_factory=list)


class DataMissionAgentResponse(BaseModel):
    agent: str
    project_title: str
    generated_at: str
    detected_keywords: list[str]
    summary: str
    deliverables: list[dict]


class DataMissionCombinedResponse(BaseModel):
    project_title: str
    generated_at: str
    agents: list[DataMissionAgentResponse]
    combined_recommendations: list[str]


router = APIRouter(
    prefix="/data-mission",
    tags=["data-mission"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/analyze", response_model=DataMissionCombinedResponse)
def analyze_data_mission(payload: DataMissionRequest):
    """Run Data Engineer and Data Analyst agents on a project context or specification."""
    return run_data_expert_agents(
        project_title=payload.project_title,
        context=payload.context,
        requirements=payload.requirements,
    )


@router.post("/agents/data-engineer", response_model=DataMissionAgentResponse)
def analyze_with_data_engineer(payload: DataMissionRequest):
    """Run only the Data Engineer agent."""
    return run_data_engineer_agent(
        project_title=payload.project_title,
        context=payload.context,
        requirements=payload.requirements,
    )


@router.post("/agents/data-analyst", response_model=DataMissionAgentResponse)
def analyze_with_data_analyst(payload: DataMissionRequest):
    """Run only the Data Analyst agent."""
    return run_data_analyst_agent(
        project_title=payload.project_title,
        context=payload.context,
        requirements=payload.requirements,
    )
