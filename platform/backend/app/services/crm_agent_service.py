"""
CRM Automation Service — DataSphere Innovation

Remplit automatiquement le CRM depuis les AOs BOAMP + agents IA :

1. sync_organizations_from_tenders()
   → Chaque buyer_name d'un tender → Organisation (si pas déjà présente)

2. sync_opportunities_from_tenders()
   → Chaque tender GO/en cours → Opportunité commerciale liée

3. enrich_organization_with_ai()
   → Appel LLM pour deviner : secteur, site web, description

4. update_pipeline_from_workflow()
   → Statut du workflow AO → Stade du pipeline CRM

Appelé automatiquement par le scheduler (lundi 08h05) et via API.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.organization import Organization
from app.models.opportunity import Opportunity
from app.models.tender import Tender

log = logging.getLogger("datasphere.crm_agent")


# ── Mapping workflow → pipeline commercial ─────────────────────────────────────

WORKFLOW_TO_PIPELINE: dict[str, str] = {
    "draft":       "Prospect identifié",
    "analyzing":   "Analyse en cours",
    "go":          "GO — En cours de réponse",
    "no_go":       "NO GO — Écarté",
    "submitted":   "Réponse soumise",
    "won":         "Mission gagnée",
    "lost":        "Mission perdue",
    "in_progress": "Mission en cours",
}

# Secteurs détectés par mots-clés dans le nom de l'acheteur
SECTOR_KEYWORDS: dict[str, list[str]] = {
    "Public — État":         ["ministère", "dgnum", "dinum", "sgdsn", "premier ministre", "préfecture", "sous-préfecture"],
    "Public — Collectivité": ["mairie", "commune", "département", "région", "métropole", "agglo", "intercommunalité", "syndicat"],
    "Public — Santé":        ["chu", "chru", "ch ", "hôpital", "ars", "cpam", "cnam", "ap-hp", "ehpad"],
    "Public — Défense":      ["ministère des armées", "defense", "armée", "gendarmerie", "dga", "thales", "airbus defense"],
    "Public — Éducation":    ["université", "école", "rectorat", "académie", "crous", "cnrs", "inria", "cea"],
    "Public — Transport":    ["sncf", "ratp", "aéroport", "port", "voie navigable", "autoroute"],
    "Public — Énergie":      ["edf", "enedis", "rte", "grdf", "grt gaz", "cea"],
    "Privé — Banque/Finance":["banque", "crédit", "assurance", "mutuelle", "caisse", "société générale", "bnp", "axa"],
    "Privé — Telecom":       ["orange", "sfr", "bouygues telecom", "free", "iliad"],
    "Privé — Industrie":     ["saur", "veolia", "suez", "total", "engie", "safran", "dassault"],
    "Privé — Conseil IT":    ["accenture", "capgemini", "sopra", "atos", "ibm", "microsoft", "oracle"],
}


def _detect_sector(org_name: str) -> str:
    """Devine le secteur depuis le nom de l'organisation."""
    name_lower = org_name.lower()
    for sector, keywords in SECTOR_KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            return sector
    # Heuristique fallback
    if any(w in name_lower for w in ["sa ", "sas", "sarl", "sasu", " group", " holding"]):
        return "Privé — Entreprise"
    return "Public — Autre"


def _guess_website(org_name: str) -> str | None:
    """Génère une URL probable depuis le nom."""
    import re
    clean = re.sub(r"[^a-z0-9\s-]", "", org_name.lower())
    clean = re.sub(r"\s+", "-", clean.strip())
    # Remove common suffixes
    for suffix in ["-sa", "-sas", "-sarl", "-sasu", "-ministere", "-des", "-de-la", "-du"]:
        clean = clean.replace(suffix, "")
    if len(clean) < 3:
        return None
    return f"https://www.{clean[:40]}.fr"


# ── Core sync functions ────────────────────────────────────────────────────────

def sync_organizations_from_tenders(db: Session) -> dict[str, Any]:
    """
    Crée une Organisation pour chaque buyer_name unique dans les tenders.
    Safe: ne duplique pas si l'orga existe déjà (case-insensitive).
    """
    tenders = db.query(Tender).filter(
        Tender.buyer_name.isnot(None),
        Tender.buyer_name != "",
    ).all()

    created = 0
    skipped = 0
    updated = 0

    for tender in tenders:
        buyer = (tender.buyer_name or "").strip()
        if not buyer:
            continue

        # Check existing (case insensitive)
        existing = db.query(Organization).filter(
            func.lower(Organization.name) == buyer.lower()
        ).first()

        if existing:
            # Update source_url si on a une URL AO
            if not existing.source_url and getattr(tender, "source_url", None):
                existing.source_url = tender.source_url
                db.add(existing)
                updated += 1
            else:
                skipped += 1
            continue

        # Create new organization
        org = Organization(
            name=buyer,
            sector=_detect_sector(buyer),
            website=_guess_website(buyer),
            source="boamp_auto",
            source_url=getattr(tender, "source_url", None),
            description=f"Organisation détectée automatiquement via BOAMP ({tender.source or 'scan'}). À compléter.",
        )
        db.add(org)
        db.flush()  # Get ID
        created += 1

    db.commit()
    log.info("CRM sync: %d created, %d updated, %d skipped", created, updated, skipped)
    return {"created": created, "updated": updated, "skipped": skipped}


def sync_opportunities_from_tenders(db: Session) -> dict[str, Any]:
    """
    Crée une Opportunité pour chaque tender GO/actif sans opportunité.
    Lie l'opportunité à l'organisation (buyer).
    """
    # Tenders éligibles : pas NO GO, pas draft
    tenders = db.query(Tender).filter(
        Tender.buyer_name.isnot(None),
        Tender.status.notin_(["no_go", "draft"]),
    ).all()

    created = 0
    skipped = 0

    for tender in tenders:
        buyer = (tender.buyer_name or "").strip()
        if not buyer:
            continue

        # Trouver l'organisation
        org = db.query(Organization).filter(
            func.lower(Organization.name) == buyer.lower()
        ).first()

        if not org:
            # Créer à la volée
            org = Organization(
                name=buyer,
                sector=_detect_sector(buyer),
                website=_guess_website(buyer),
                source="boamp_auto",
            )
            db.add(org)
            db.flush()

        # Vérifier si une opportunité liée à ce tender existe déjà
        existing_opp = db.query(Opportunity).filter(
            Opportunity.organization_id == org.id,
            Opportunity.title.contains(tender.title[:30] if tender.title else ""),
        ).first()

        if existing_opp:
            # Mettre à jour le statut pipeline si workflow avancé
            pipeline_status = WORKFLOW_TO_PIPELINE.get(
                tender.status or "draft", "Prospect identifié"
            )
            if existing_opp.status != pipeline_status:
                existing_opp.status = pipeline_status
                db.add(existing_opp)
            skipped += 1
            continue

        # Valeur estimée depuis le budget AO
        potential_value = None
        if hasattr(tender, "estimated_budget") and tender.estimated_budget:
            try:
                potential_value = float(tender.estimated_budget)
            except (ValueError, TypeError):
                pass

        # Statut pipeline depuis le workflow
        pipeline_status = WORKFLOW_TO_PIPELINE.get(
            tender.status or "draft", "Prospect identifié"
        )

        opp = Opportunity(
            organization_id=org.id,
            title=f"AO — {tender.title[:120] if tender.title else 'Mission Data'}",
            status=pipeline_status,
            potential_value=potential_value,
            source="boamp_auto",
            source_url=getattr(tender, "source_url", None),
            opportunity_type="Mission conseil Data / IT / IA",
            notes=(
                f"Opportunité créée automatiquement depuis l'appel d'offres : {tender.title}. "
                f"Acheteur : {buyer}. Source : BOAMP."
            ),
            ai_notes="Créé par agent CRM automatisé depuis scan BOAMP.",
            probability=30,
        )
        db.add(opp)
        created += 1

    db.commit()
    log.info("Opportunities sync: %d created, %d skipped/updated", created, skipped)
    return {"created": created, "updated": skipped}


def update_pipeline_from_workflow(db: Session, tender_id: int, new_status: str) -> bool:
    """
    Appelé après chaque changement de statut workflow d'un AO.
    Met à jour le pipeline commercial de l'opportunité liée.
    """
    tender = db.query(Tender).filter(Tender.id == tender_id).first()
    if not tender or not tender.buyer_name:
        return False

    org = db.query(Organization).filter(
        func.lower(Organization.name) == (tender.buyer_name or "").lower()
    ).first()

    if not org:
        return False

    opp = db.query(Opportunity).filter(
        Opportunity.organization_id == org.id,
        Opportunity.source == "boamp_auto",
        Opportunity.organization_id == org.id,
    ).first()

    if not opp:
        return False

    pipeline_status = WORKFLOW_TO_PIPELINE.get(new_status, "En cours")
    opp.status = pipeline_status
    db.add(opp)
    db.commit()
    log.info("Pipeline updated: tender %d → %s → opp %d", tender_id, pipeline_status, opp.id)
    return True


def get_crm_stats(db: Session) -> dict[str, Any]:
    """Stats pour le dashboard CRM automatisation."""
    total_orgs  = db.query(Organization).count()
    auto_orgs   = db.query(Organization).filter(Organization.source == "boamp_auto").count()
    total_opps  = db.query(Opportunity).count()
    auto_opps   = db.query(Opportunity).filter(Opportunity.source == "boamp_auto").count()
    go_opps     = db.query(Opportunity).filter(Opportunity.status.contains("GO")).count()
    won_opps    = db.query(Opportunity).filter(Opportunity.status == "Mission gagnée").count()

    return {
        "organizations": {"total": total_orgs, "auto": auto_orgs, "manual": total_orgs - auto_orgs},
        "opportunities":  {"total": total_opps,  "auto": auto_opps,  "go": go_opps, "won": won_opps},
        "automation_rate": round(auto_orgs / max(total_orgs, 1) * 100),
    }
