from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    country: str | None = None
    sector: str | None = None
    organization_type: str | None = None
    website: str | None = None
    description: str | None = None
    # AI suggestion fields
    source: str = "manual"
    validation_status: str = "validated"
    confidence_score: float | None = None
    source_url: str | None = None
    ai_notes: str | None = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    country: str | None = None
    sector: str | None = None
    organization_type: str | None = None
    website: str | None = None
    description: str | None = None
    validation_status: str | None = None
    validated_by: str | None = None


class OrganizationRead(OrganizationBase):
    id: int
    validated_by: str | None = None
    validated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
