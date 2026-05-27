from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AgentProfileBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=120)
    domain: str = Field(..., min_length=2, max_length=120)
    seniority: str = "senior"
    languages: str = "fr,en"
    mission_types: str | None = None
    description: str | None = None
    instruction_template: str = Field(..., min_length=20)
    tools: str | None = None
    governance_rules: str | None = None
    is_active: bool = True


class AgentProfileCreate(AgentProfileBase):
    pass


class AgentProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    domain: str | None = Field(default=None, min_length=2, max_length=120)
    seniority: str | None = None
    languages: str | None = None
    mission_types: str | None = None
    description: str | None = None
    instruction_template: str | None = Field(default=None, min_length=20)
    tools: str | None = None
    governance_rules: str | None = None
    is_active: bool | None = None


class AgentProfileRead(AgentProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentAssignmentBase(BaseModel):
    agent_id: int
    opportunity_id: int | None = None
    tender_id: int | None = None
    assignment_type: str = "analysis"
    objective: str = Field(..., min_length=10)
    expected_deliverable: str | None = None
    priority: str = "Moyenne"
    status: str = "planned"
    human_reviewer: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_target(self):
        if self.opportunity_id is None and self.tender_id is None:
            raise ValueError("Either opportunity_id or tender_id must be provided")
        return self


class AgentAssignmentCreate(AgentAssignmentBase):
    pass


class AgentAssignmentUpdate(BaseModel):
    assignment_type: str | None = None
    objective: str | None = Field(default=None, min_length=10)
    expected_deliverable: str | None = None
    priority: str | None = None
    status: str | None = None
    human_reviewer: str | None = None
    notes: str | None = None


class AgentAssignmentRead(AgentAssignmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
