from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class ContactBase(BaseModel):
    organization_id: int
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None
    professional_email: str | None = None
    linkedin_url: str | None = None
    source: str | None = None
    notes: str | None = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    job_title: str | None = None
    professional_email: str | None = None
    linkedin_url: str | None = None
    source: str | None = None
    notes: str | None = None


class ContactRead(ContactBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
