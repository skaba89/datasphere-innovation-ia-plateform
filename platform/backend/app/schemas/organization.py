from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    country: str | None = None
    sector: str | None = None
    organization_type: str | None = None
    website: str | None = None
    description: str | None = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    country: str | None = None
    sector: str | None = None
    organization_type: str | None = None
    website: str | None = None
    description: str | None = None


class OrganizationRead(OrganizationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
