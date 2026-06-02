"""
Providers endpoint — list all LLM providers and their recommendations.

GET /providers                     — all providers sorted by cost (free first)
GET /providers/recommendations     — full strategy + tips
GET /providers/recommendations?task_type=<type> — per-task recommendation
GET /providers/active              — only configured/active providers
"""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user
from app.models.user import User
from app.services.llm_service import (
    list_providers,
    get_recommendations,
    provider_label,
    _DEFAULT_ORDER,
    TIER_ORDER,
)

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("")
def get_providers(current_user: User = Depends(get_current_user)) -> dict:
    """
    Return all LLM providers sorted by cost (free → near-free → budget → standard → premium).
    Shows which providers are configured (API key set) and their active model.
    """
    providers = list_providers()
    configured = [p for p in providers if p["configured"]]
    unconfigured = [p for p in providers if not p["configured"]]

    return {
        "providers": providers,
        "summary": {
            "total": len(providers),
            "configured": len(configured),
            "unconfigured": len(unconfigured),
            "active_provider": provider_label(),
            "priority_order": _DEFAULT_ORDER,
            "free_providers_configured": [
                p["name"] for p in providers
                if p["configured"] and p["tier"] in ("free", "near-free")
            ],
        },
    }


@router.get("/active")
def get_active_providers(current_user: User = Depends(get_current_user)) -> dict:
    """Return only configured providers in active priority order."""
    all_providers = list_providers()
    active = [p for p in all_providers if p["configured"]]
    return {
        "active_providers": active,
        "count": len(active),
        "current": provider_label(),
        "fallback_chain": [p["name"] for p in active],
    }


@router.get("/recommendations")
def get_provider_recommendations(
    task_type: str | None = Query(default=None, description="Filter by task type"),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Return provider recommendations.

    Without task_type: full strategy (priority order, tier breakdown, tips).
    With task_type: recommendation for a specific task (best providers, cost hint).

    Available task types:
    - context_analysis
    - go_no_go_recommendation
    - tender_requirements_review
    - deliverable_plan
    - compliance_matrix
    - commercial_proposal
    - sector_analysis
    """
    return get_recommendations(task_type)
