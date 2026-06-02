from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TenderBase(BaseModel):
    opportunity_id: int
    reference: str | None = None
    title: str = Field(..., min_length=2, max_length=255)
    buyer_name: str | None = None
    publication_date: datetime | None = None
    submission_deadline: datetime | None = None
    source_url: str | None = None
    summary: str | None = None
    go_no_go_score: int | None = Field(default=None, ge=0, le=100)
    go_no_go_decision: str | None = None
    status: str = "draft"



    # AI suggestion fields
    source: str = "manual"
    validation_status: str = "validated"
    confidence_score: float | None = None
    ai_notes: str | None = None

class TenderCreate(TenderBase):
    pass


class TenderUpdate(BaseModel):
    reference: str | None = None
    title: str | None = Field(default=None, min_length=2, max_length=255)
    buyer_name: str | None = None
    publication_date: datetime | None = None
    submission_deadline: datetime | None = None
    source_url: str | None = None
    summary: str | None = None
    go_no_go_score: int | None = Field(default=None, ge=0, le=100)
    go_no_go_decision: str | None = None
    status: str | None = None


class TenderRead(TenderBase):
    id: int
    created_at: datetime
    updated_at: datetime

    validated_by: str | None = None
    validated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TenderRequirementBase(BaseModel):
    tender_id: int
    requirement_code: str | None = None
    section: str | None = None
    description: str = Field(..., min_length=2)
    requirement_type: str | None = None
    response_strategy: str | None = None
    proof_or_deliverable: str | None = None
    owner_name: str | None = None
    status: str = "to_analyze"
    comments: str | None = None


class TenderRequirementCreate(TenderRequirementBase):
    pass


class TenderRequirementUpdate(BaseModel):
    requirement_code: str | None = None
    section: str | None = None
    description: str | None = Field(default=None, min_length=2)
    requirement_type: str | None = None
    response_strategy: str | None = None
    proof_or_deliverable: str | None = None
    owner_name: str | None = None
    status: str | None = None
    comments: str | None = None


class TenderRequirementRead(TenderRequirementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    validated_by: str | None = None
    validated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
