from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GoNoGoCriterionBase(BaseModel):
    tender_id: int | None = None  # Auto-injected from URL path
    name: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    score: int = Field(default=0, ge=0)
    weight: int = Field(default=1, ge=1)
    max_score: int = Field(default=5, ge=1)
    rationale: str | None = None
    recommendation: str | None = None


class GoNoGoCriterionCreate(GoNoGoCriterionBase):
    pass


class GoNoGoCriterionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    score: int | None = Field(default=None, ge=0)
    weight: int | None = Field(default=None, ge=1)
    max_score: int | None = Field(default=None, ge=1)
    rationale: str | None = None
    recommendation: str | None = None


class GoNoGoCriterionRead(GoNoGoCriterionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GoNoGoSummary(BaseModel):
    tender_id: int | None = None  # Auto-injected from URL path
    criteria_count: int
    weighted_score: float
    max_weighted_score: float
    percentage: float
    recommendation: str


class ComplianceMatrixItemBase(BaseModel):
    tender_id: int | None = None  # Auto-injected from URL path
    requirement_id: int | None = None
    requirement_code: str | None = None
    requirement_summary: str = Field(..., min_length=2)
    compliance_status: str = "to_review"
    response_location: str | None = None
    evidence: str | None = None
    gap: str | None = None
    action_plan: str | None = None
    owner_name: str | None = None
    due_date: datetime | None = None
    comments: str | None = None


class ComplianceMatrixItemCreate(ComplianceMatrixItemBase):
    pass


class ComplianceMatrixItemUpdate(BaseModel):
    requirement_id: int | None = None
    requirement_code: str | None = None
    requirement_summary: str | None = Field(default=None, min_length=2)
    compliance_status: str | None = None
    response_location: str | None = None
    evidence: str | None = None
    gap: str | None = None
    action_plan: str | None = None
    owner_name: str | None = None
    due_date: datetime | None = None
    comments: str | None = None


class ComplianceMatrixItemRead(ComplianceMatrixItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplianceSummary(BaseModel):
    tender_id: int | None = None  # Auto-injected from URL path
    total_items: int
    compliant: int
    partial: int
    gap: int
    to_review: int
    compliance_rate: float
