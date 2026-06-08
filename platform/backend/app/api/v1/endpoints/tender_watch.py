from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.services.tender_watch import discover_tenders

log = logging.getLogger("datasphere.tender_watch")


class TenderScoreBreakdownRead(BaseModel):
    technical_fit:  int = Field(ge=0, le=100)
    strategic_fit:  int = Field(ge=0, le=100)
    commercial_fit: int = Field(ge=0, le=100)
    delivery_risk:  int = Field(ge=0, le=100)
    reference_fit:  int = Field(ge=0, le=100)
    global_score:   int = Field(ge=0, le=100)
    recommendation: str
    rationale:      list[str]


class TenderWatchCandidateRead(BaseModel):
    title:               str
    reference:           str
    buyer_name:          str
    country:             str
    sector:              str
    source_name:         str
    source_url:          str
    summary:             str
    estimated_value:     float = Field(ge=0)
    deadline:            str | None = None
    requirements:        list[str]
    qualification_score: int = Field(ge=0, le=100)
    recommendation:      str
    score_breakdown:     TenderScoreBreakdownRead
    rationale:           list[str]
    published_date:      str | None = None
    cpv_codes:           list[str] = []
    procedure:           str | None = None
    location:            str | None = None


router = APIRouter(
    prefix="/tender-watch",
    tags=["tender-watch"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/search", response_model=list[TenderWatchCandidateRead])
def search_tender_watch(
    q:      str = Query(default="", description="Mots-cles AO"),
    limit:  int = Query(default=20, ge=1, le=50),
    source: str = Query(default="all", description="all | boamp | local"),
):
    """
    Decouvrir des appels d offres pertinents.
    Sources : boamp (API officielle France) | local (Guinee / Afrique) | all
    """
    candidates = []

    # BOAMP real API
    if source in ("all", "boamp"):
        try:
            from app.services.boamp_client import fetch_boamp, boamp_to_watch_candidate
            from app.services.tender_watch.scoring import score_tender_candidate
            from app.services.tender_watch_service import TenderWatchCandidate

            boamp_results = fetch_boamp(query=q, limit=min(limit, 30), cpv_filter=not q)

            for a in boamp_results:
                raw = boamp_to_watch_candidate(a)
                candidate = TenderWatchCandidate(
                    title=raw["title"], reference=raw["reference"],
                    buyer_name=raw["buyer_name"], country=raw["country"],
                    sector=raw["sector"], source_name="BOAMP",
                    source_url=raw["source_url"], summary=raw["summary"],
                    estimated_value=raw["estimated_value"],
                    deadline=raw["deadline"], requirements=[],
                )
                scored = score_tender_candidate(candidate)
                sb = scored.score_breakdown
                candidates.append({
                    "title": scored.title, "reference": scored.reference,
                    "buyer_name": scored.buyer_name, "country": scored.country,
                    "sector": scored.sector, "source_name": "BOAMP",
                    "source_url": raw["source_url"], "summary": scored.summary,
                    "estimated_value": scored.estimated_value,
                    "deadline": scored.deadline, "requirements": [],
                    "qualification_score": scored.qualification_score,
                    "recommendation": sb.recommendation,
                    "score_breakdown": {
                        "technical_fit": sb.technical_fit, "strategic_fit": sb.strategic_fit,
                        "commercial_fit": sb.commercial_fit, "delivery_risk": sb.delivery_risk,
                        "reference_fit": sb.reference_fit, "global_score": sb.global_score,
                        "recommendation": sb.recommendation, "rationale": sb.rationale,
                    },
                    "rationale": sb.rationale,
                    "published_date": raw.get("published_date"),
                    "cpv_codes": raw.get("cpv_codes", []),
                    "procedure": raw.get("procedure"),
                    "location": raw.get("location"),
                })
        except Exception as e:
            log.warning("BOAMP fetch failed (fallback): %s", e)

    # Local / demo
    if source in ("all", "local") or not candidates:
        for item in discover_tenders(query=q, limit=limit):
            d = item if isinstance(item, dict) else item.__dict__
            d.setdefault("published_date", None)
            d.setdefault("cpv_codes", [])
            d.setdefault("procedure", None)
            d.setdefault("location", None)
            candidates.append(d)

    # Deduplicate + sort
    seen: set[str] = set()
    result = []
    for c in sorted(candidates, key=lambda x: x.get("qualification_score", 0), reverse=True):
        ref = c.get("reference", "")
        if ref not in seen:
            seen.add(ref)
            result.append(c)

    return result[:limit]


@router.get("/sources", dependencies=[Depends(get_current_user)])
def list_sources():
    """Lister les sources de veille disponibles et leur statut."""
    return {
        "sources": [
            {
                "id": "boamp", "name": "BOAMP — Marchés publics France",
                "country": "France", "type": "official_api",
                "url": "https://www.boamp.fr", "status": "active",
                "description": "API officielle BOAMP en temps reel",
                "requires_key": False,
            },
            {
                "id": "local", "name": "DataSphere Watch (Guinee / Afrique)",
                "country": "Guinee", "type": "curated",
                "url": None, "status": "active",
                "description": "Veille manuelle marches publics africains",
                "requires_key": False,
            },
        ],
        "total": 2,
    }
