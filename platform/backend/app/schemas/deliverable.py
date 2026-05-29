from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeliverableBase(BaseModel):
    opportunity_id: int | None = None
    tender_id: int | None = None
    assignment_id: int | None = None
    action_id: int | None = None

    title: str = Field(..., min_length=3, max_length=255)
    deliverable_type: str = "note_cadrage"
    status: str = "draft"
    version: int = 1
    language: str = "fr"
    audience: str | None = None
    summary: str | None = None
    content_markdown: str = Field(..., min_length=10)
    tags: str | None = None

    generated_by: str | None = None
    reviewed_by: str | None = None
    approved_by: str | None = None


class DeliverableCreate(DeliverableBase):
    pass


class DeliverableUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    deliverable_type: str | None = None
    status: str | None = None
    version: int | None = None
    language: str | None = None
    audience: str | None = None
    summary: str | None = None
    content_markdown: str | None = Field(default=None, min_length=10)
    tags: str | None = None
    reviewed_by: str | None = None
    approved_by: str | None = None


class DeliverableRead(DeliverableBase):
    id: int
    reviewed_at: datetime | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
