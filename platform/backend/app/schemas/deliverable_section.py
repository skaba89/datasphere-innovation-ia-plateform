from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeliverableSectionBase(BaseModel):
    deliverable_id: int
    title: str = Field(..., min_length=3, max_length=255)
    section_key: str = Field(default="", min_length=0, max_length=120)
    position: int = 1
    status: str = "draft"
    content_markdown: str = ""
    version: int = 1
    owner_agent_id: int | None = None
    reviewed_by: str | None = None
    approved_by: str | None = None

    def model_post_init(self, __context) -> None:
        """Auto-generate section_key from title if not provided."""
        if not self.section_key:
            import re
            slug = re.sub(r'[^a-z0-9]+', '-', self.title.lower()).strip('-')[:80]
            object.__setattr__(self, 'section_key', slug or 'section')


class DeliverableSectionCreate(DeliverableSectionBase):
    pass


class DeliverableSectionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    section_key: str | None = Field(default=None, min_length=2, max_length=120)
    position: int | None = None
    status: str | None = None
    content_markdown: str | None = None
    owner_agent_id: int | None = None
    reviewed_by: str | None = None
    approved_by: str | None = None


class DeliverableSectionRead(DeliverableSectionBase):
    id: int
    reviewed_at: datetime | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentContributionBase(BaseModel):
    deliverable_id: int
    section_id: int | None = None
    agent_id: int | None = None
    action_id: int | None = None
    contribution_type: str = "section_draft"
    summary: str | None = None
    content_markdown: str = ""
    status: str = "proposed"
    created_by: str | None = None


class AgentContributionCreate(AgentContributionBase):
    pass


class AgentContributionUpdate(BaseModel):
    section_id: int | None = None
    agent_id: int | None = None
    action_id: int | None = None
    contribution_type: str | None = None
    summary: str | None = None
    content_markdown: str | None = None
    status: str | None = None
    created_by: str | None = None


class AgentContributionRead(AgentContributionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SectionReviewRequest(BaseModel):
    reviewer_name: str = Field(..., min_length=2)


class SectionApproveRequest(BaseModel):
    approver_name: str = Field(..., min_length=2)
