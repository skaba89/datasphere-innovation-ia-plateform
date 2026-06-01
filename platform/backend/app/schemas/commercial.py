from datetime import datetime

from pydantic import BaseModel, ConfigDict


# ── Go/No-Go AI Recommendation ────────────────────────────────────────────────

class GoNoGoRiskItem(BaseModel):
    level: str       # high | medium | low
    category: str    # technique | commercial | délai | ressources | compétences
    description: str
    mitigation: str


class GoNoGoOpportunityItem(BaseModel):
    category: str    # différenciation | référence | partenariat | innovation
    description: str
    impact: str      # fort | moyen | faible


class GoNoGoRecommendation(BaseModel):
    tender_id: int
    decision: str                        # Go | No-Go | Go conditionnel
    confidence: int                      # 0–100
    score_global: float
    score_percentage: float
    summary: str                         # 2–3 phrases de synthèse
    reasoning: str                       # argumentation détaillée
    risks: list[GoNoGoRiskItem]
    opportunities: list[GoNoGoOpportunityItem]
    conditions: list[str]                # conditions pour un Go conditionnel
    recommended_actions: list[str]
    provider: str                        # llm provider used
    computed_at: datetime


# ── Sector Templates ──────────────────────────────────────────────────────────

class SectorTemplateRead(BaseModel):
    id: int
    sector_key: str
    sector_label: str
    deliverable_type: str
    title_template: str
    description: str
    tags: str
    is_builtin: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SectorTemplateApplyRequest(BaseModel):
    sector_key: str
    deliverable_type: str
    opportunity_id: int | None = None
    tender_id: int | None = None
    assignment_id: int | None = None
    language: str = "fr"
    audience: str | None = None


# ── Email Preview ────────────────────────────────────────────────────────────

class EmailPreview(BaseModel):
    deliverable_id: int
    subject: str
    to_name: str
    to_email: str
    from_name: str
    html_body: str
    text_body: str
    attachments_note: str
