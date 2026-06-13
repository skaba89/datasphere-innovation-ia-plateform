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
    instruction_template: str = Field(
        ...,
        min_length=10,
        description="System prompt envoyé au LLM. Obligatoire.",
    )
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
    instruction_template: str = Field(..., min_length=10, description="System prompt envoyé au LLM. Obligatoire.")
    tools: str | None = None
    governance_rules: str | None = None
    is_active: bool | None = None


class AgentProfileRead(AgentProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def map_system_prompt(cls, data):
        """Map ORM system_prompt → instruction_template before Pydantic validation."""
        if hasattr(data, "__dict__"):
            if hasattr(data, "system_prompt") and not hasattr(data, "instruction_template"):

                object.__setattr__(data, "instruction_template", data.system_prompt or "")
        elif isinstance(data, dict):
            if "system_prompt" in data and "instruction_template" not in data:
                data["instruction_template"] = data["system_prompt"]
        return data

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


class AgentActionBase(BaseModel):
    assignment_id: int
    action_type: str = "analysis"
    title: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    priority: str = "Moyenne"
    status: str = "suggested"
    requires_human_approval: bool = True
    result_summary: str | None = None
    next_step: str | None = None


class AgentActionCreate(AgentActionBase):
    pass


class AgentActionUpdate(BaseModel):
    action_type: str | None = None
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    requires_human_approval: bool | None = None
    approved_by: str | None = None
    result_summary: str | None = None
    next_step: str | None = None


class AgentActionRead(AgentActionBase):
    id: int
    approved_by: str | None = None
    approved_at: datetime | None = None
    executed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentPlanRequest(BaseModel):
    assignment_id: int
    mode: str = "safe_auto"


class AgentRunRequest(BaseModel):
    action_id: int
    actor_name: str = "system"
    force: bool = False