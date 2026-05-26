from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class OpportunityBase(BaseModel):
    organization_id: int
    title: str = Field(..., min_length=2, max_length=255)
    opportunity_type: str | None = None
    country: str | None = None
    sector: str | None = None
    status: str = "Prospect identifie"
    priority: str = "Moyenne"
    potential_value: Decimal | None = None
    probability: int = Field(default=20, ge=0, le=100)
    next_action: str | None = None
    next_action_date: datetime | None = None
    owner_name: str | None = None
    notes: str | None = None


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    opportunity_type: str | None = None
    country: str | None = None
    sector: str | None = None
    status: str | None = None
    priority: str | None = None
    potential_value: Decimal | None = None
    probability: int | None = Field(default=None, ge=0, le=100)
    next_action: str | None = None
    next_action_date: datetime | None = None
    owner_name: str | None = None
    notes: str | None = None


class OpportunityRead(OpportunityBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
