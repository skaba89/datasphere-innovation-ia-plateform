"""
AI Suggestion Service — automatic discovery and suggestion of:
  - Appels d'offres (from BOAMP API, TED, configured sources)
  - Organizations (from AO buyer analysis)
  - Opportunities (from detected AO relevance)

All suggestions are created with:
  - source = "ai_suggested" | "boamp" | "ted"
  - validation_status = "pending"
  - confidence_score ∈ [0.0, 1.0]

They appear ONLY in the validation queue and are invisible in normal CRM views
until a human validates them.

Uses:
  - BOAMP API (free, no auth) for French public tenders
  - LLM service for relevance scoring and enrichment
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.llm_service import complete

logger = logging.getLogger(__name__)

# ── BOAMP API ─────────────────────────────────────────────────────────────────
BOAMP_API = "https://www.boamp.fr/api/search"
BOAMP_PAGE_SIZE = 10

# Keywords that flag an AO as potentially relevant for DataSphere
RELEVANCE_KEYWORDS = [
    "data", "données", "numérique", "digital", "SI", "système d'information",
    "architecture", "plateforme", "cloud", "IA", "intelligence artificielle",
    "transformation digitale", "informatique", "développement logiciel",
    "infrastructure", "cybersécurité", "analytics", "business intelligence",
    "gouvernance", "interopérabilité", "dématérialisation", "e-gouvernement",
    "GIS", "SIG", "cartographie", "blockchain", "IoT",
]

# DataSphere context for LLM relevance scoring
DATASPHERE_PROFILE = """
DataSphere Innovation est un cabinet de conseil spécialisé en :
- Data Engineering (Snowflake, dbt, Airflow, PySpark)
- Architecture Data & Lakehouse
- IA générative et agents IA
- Business Intelligence (Superset, Power BI)
- Transformation digitale et GovTech
- Appels d'offres publics IT/Data en France et Afrique francophone
TJM : 650-800€. Équipe : 2-5 consultants seniors.
"""


# ── BOAMP scraper ─────────────────────────────────────────────────────────────

def _fetch_boamp(
    days_back: int = 3,
    max_results: int = 20,
) -> list[dict]:
    """
    Fetch recent BOAMP notices via the public search API.
    Returns raw notice dicts.
    """
    since = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    params = {
        "q": " OR ".join(RELEVANCE_KEYWORDS[:8]),
        "rows": max_results,
        "sort": "dateparution desc",
        "fl": "id,objet,acheteur,dateparution,datelimitereponse,urlboamp,nature,lieu",
        "fq": f"dateparution:[{since}T00:00:00Z TO NOW]",
    }
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(BOAMP_API, params=params)
            resp.raise_for_status()
            data = resp.json()
            return data.get("docs", []) or []
    except Exception as exc:
        logger.warning("BOAMP fetch failed: %s", exc)
        return []


def _score_boamp_notice(notice: dict) -> float:
    """
    Quick keyword-based relevance score (0.0–1.0) without LLM.
    Used to pre-filter before expensive LLM calls.
    """
    text = " ".join([
        str(notice.get("objet", "")),
        str(notice.get("nature", "")),
    ]).lower()
    hits = sum(1 for kw in RELEVANCE_KEYWORDS if kw.lower() in text)
    return min(hits / 4, 1.0)


def _llm_score_and_enrich(notice: dict) -> dict:
    """
    Ask LLM to score relevance and extract structured fields.
    Returns enriched dict with confidence, sector, rationale.
    Falls back to keyword score if LLM unavailable.
    """
    objet = notice.get("objet", "N/A")[:500]
    acheteur = notice.get("acheteur", {})
    acheteur_name = acheteur.get("nom", "N/A") if isinstance(acheteur, dict) else str(acheteur)

    prompt = f"""Tu es un expert en business development pour un cabinet de conseil Data/IA.

Profil du cabinet :
{DATASPHERE_PROFILE}

Analyse cet appel d'offres BOAMP :
Objet : {objet}
Acheteur : {acheteur_name}
Nature : {notice.get("nature", "N/A")}
Lieu : {notice.get("lieu", "N/A")}

Réponds UNIQUEMENT en JSON valide (sans markdown) avec cette structure :
{{
  "relevance_score": 0.85,
  "sector": "IT / Data",
  "rationale": "Explication courte en 1 phrase",
  "estimated_budget_range": "50K-200K€",
  "key_requirements": ["req1", "req2"],
  "recommendation": "go" | "no_go" | "watch"
}}

Critères : score 0.8+ si le cabinet peut répondre compétitivement, 0.5-0.8 si partiel, <0.5 si hors périmètre."""

    raw, _ = complete(prompt, action_type="context_analysis")

    import json
    try:
        # Strip possible markdown fences
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(clean)
        return result
    except Exception:
        return {
            "relevance_score": _score_boamp_notice(notice),
            "sector": "IT / Numérique",
            "rationale": "Score basé sur les mots-clés (LLM indisponible)",
            "recommendation": "watch",
        }


# ── Main suggestion functions ─────────────────────────────────────────────────

def suggest_from_boamp(
    db,
    days_back: int = 3,
    max_results: int = 20,
    min_score: float = 0.4,
) -> dict:
    """
    Fetch BOAMP notices, score them, and create pending suggestions
    in the database. Returns a summary dict.
    """
    from datetime import datetime

    from app.crud.organization import create_organization, get_organization_by_name
    from app.crud.opportunity import create_opportunity
    from app.crud.tender import create_tender, get_tender_by_reference
    from app.schemas.organization import OrganizationCreate
    from app.schemas.opportunity import OpportunityCreate
    from app.schemas.tender import TenderCreate

    notices = _fetch_boamp(days_back=days_back, max_results=max_results)
    logger.info("BOAMP: fetched %d notices", len(notices))

    created_orgs = 0
    created_opps = 0
    created_tenders = 0
    skipped = 0

    for notice in notices:
        quick_score = _score_boamp_notice(notice)
        if quick_score < 0.2:
            skipped += 1
            continue

        # Enrich with LLM
        enriched = _llm_score_and_enrich(notice)
        score = float(enriched.get("relevance_score", quick_score))

        if score < min_score:
            skipped += 1
            continue

        acheteur = notice.get("acheteur", {})
        acheteur_name = (acheteur.get("nom", "Acheteur inconnu")
                         if isinstance(acheteur, dict) else str(acheteur))
        reference = str(notice.get("id", ""))[:120]
        objet = str(notice.get("objet", "Appel d'offres"))[:254]
        source_url = notice.get("urlboamp", "")

        # Skip if AO already exists
        if reference and get_tender_by_reference(db, reference):
            skipped += 1
            continue

        # 1. Org (buyer) — create if unknown
        org = get_organization_by_name(db, acheteur_name)
        if org is None:
            org = create_organization(db, OrganizationCreate(
                name=acheteur_name,
                sector=enriched.get("sector", "Public"),
                organization_type="Institution publique",
                source="boamp",
                validation_status="pending",
                confidence_score=score,
                source_url=source_url,
                ai_notes=enriched.get("rationale", ""),
            ))
            created_orgs += 1

        # 2. Opportunity
        opp = create_opportunity(db, OpportunityCreate(
            organization_id=org.id,
            title=f"[BOAMP] {objet[:120]}",
            opportunity_type="Appel d'offres public",
            sector=enriched.get("sector", "IT / Numérique"),
            probability=int(score * 70),
            priority="Haute" if score >= 0.7 else "Moyenne",
            source="boamp",
            validation_status="pending",
            confidence_score=score,
            source_url=source_url,
            ai_notes=enriched.get("rationale", ""),
        ))
        created_opps += 1

        # 3. Tender
        deadline_raw = notice.get("datelimitereponse")
        deadline = None
        if deadline_raw:
            try:
                deadline = datetime.fromisoformat(deadline_raw.replace("Z", "+00:00"))
            except Exception:
                pass

        create_tender(db, TenderCreate(
            opportunity_id=opp.id,
            reference=reference,
            title=objet,
            buyer_name=acheteur_name,
            submission_deadline=deadline,
            source_url=source_url,
            summary=enriched.get("rationale", ""),
            status="draft",
            source="boamp",
            validation_status="pending",
            confidence_score=score,
            ai_notes=enriched.get("rationale", ""),
        ))
        created_tenders += 1

    result = {
        "fetched": len(notices),
        "created_orgs": created_orgs,
        "created_opportunities": created_opps,
        "created_tenders": created_tenders,
        "skipped": skipped,
        "source": "boamp",
        "run_at": datetime.utcnow().isoformat(),
    }
    logger.info("BOAMP suggestions: %s", result)
    return result


def suggest_from_text(
    db,
    text: str,
    source_label: str = "manual_import",
    source_url: str = "",
) -> dict:
    """
    Given a raw text (pasted AO description, scraped page, email…),
    extract structured AO info and create a pending suggestion.
    """
    from app.crud.organization import create_organization
    from app.crud.opportunity import create_opportunity
    from app.crud.tender import create_tender
    from app.schemas.organization import OrganizationCreate
    from app.schemas.opportunity import OpportunityCreate
    from app.schemas.tender import TenderCreate

    prompt = f"""Analyse ce texte qui décrit probablement un appel d'offres ou une opportunité commerciale.

{DATASPHERE_PROFILE}

TEXTE :
{text[:2000]}

Réponds UNIQUEMENT en JSON valide (sans markdown) :
{{
  "is_ao": true,
  "title": "Titre court de l'AO",
  "buyer_name": "Nom de l'acheteur/donneur d'ordre",
  "buyer_sector": "Secteur de l'acheteur",
  "buyer_country": "FR",
  "summary": "Résumé en 2 phrases",
  "relevance_score": 0.75,
  "rationale": "Pourquoi c'est pertinent pour DataSphere",
  "estimated_value": "100K€",
  "key_skills": ["Data Engineering", "Python"]
}}"""

    import json
    raw, _ = complete(prompt, action_type="context_analysis")
    try:
        clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        extracted = json.loads(clean)
    except Exception:
        return {"error": "LLM extraction failed", "raw": raw[:200]}

    score = float(extracted.get("relevance_score", 0.5))

    from app.crud.organization import create_organization
    org = create_organization(db, OrganizationCreate(
        name=extracted.get("buyer_name", "Acheteur inconnu"),
        sector=extracted.get("buyer_sector", ""),
        country=extracted.get("buyer_country", "FR"),
        source=source_label,
        validation_status="pending",
        confidence_score=score,
        source_url=source_url,
        ai_notes=extracted.get("rationale", ""),
    ))

    opp = create_opportunity(db, OpportunityCreate(
        organization_id=org.id,
        title=extracted.get("title", "Opportunité détectée"),
        sector=extracted.get("buyer_sector", ""),
        probability=int(score * 70),
        source=source_label,
        validation_status="pending",
        confidence_score=score,
        source_url=source_url,
        ai_notes=extracted.get("summary", ""),
    ))

    create_tender(db, TenderCreate(
        opportunity_id=opp.id,
        title=extracted.get("title", "Appel d'offres"),
        buyer_name=extracted.get("buyer_name", ""),
        summary=extracted.get("summary", ""),
        status="draft",
        source=source_label,
        validation_status="pending",
        confidence_score=score,
        ai_notes=extracted.get("rationale", ""),
    ))

    return {
        "created": True,
        "title": extracted.get("title"),
        "score": score,
        "buyer": extracted.get("buyer_name"),
        "validation_status": "pending",
    }


def count_pending_suggestions(db) -> dict:
    """Return count of pending suggestions across all entity types."""
    from app.models.organization import Organization
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender

    return {
        "organizations": db.query(Organization).filter(
            Organization.validation_status == "pending"
        ).count(),
        "opportunities": db.query(Opportunity).filter(
            Opportunity.validation_status == "pending"
        ).count(),
        "tenders": db.query(Tender).filter(
            Tender.validation_status == "pending"
        ).count(),
    }
