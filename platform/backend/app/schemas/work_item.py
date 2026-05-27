from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkItemBase(BaseModel):
    agent_id: int | None = None
    assignment_id: int | None = None
    opportunity_id: int | None = None
    tender_id: int | None = None
    title: str = Field(..., min_length=3, max_length=255)
    category: str = "analysis"
    objective: str = Field(..., min_length=10)
    input_context: str | None = None
    expected_output: str | None = None
    recommended_next_step: str | None = None
    result_summary: str | None = None
    priority: str = "Moyenne"
    status: str = "draft"
    needs_review: bool = True
    reviewed_by: str | None = None
    due_at: datetime | None = None
    created_by: str | None = None

    @model_validator(mode="after")
    def validate_scope(self):
        if self.opportunity_id is None and self.tender_id is None:
            raise ValueError("Either opportunity_id or tender_id must be provided")
        return self


class WorkItemCreate(WorkItemBase):
    pass


class WorkItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    category: str | None = None
    objective: str | None = Field(default=None, min_length=10)
    input_context: str | None = None
    expected_output: str | None = None
    recommended_next_step: str | None = None
    result_summary: str | None = None
    priority: str | None = None
    status: str | None = None
    needs_review: bool | None = None
    reviewed_by: str | None = None
    due_at: datetime | None = None


class WorkItemRead(WorkItemBase):
    id: int
    reviewed_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
