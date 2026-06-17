"""
CRM Auto-Extract — Agent d'extraction automatique depuis les AOs

Quand un AO est créé ou importé (BOAMP, TED, PLACE, PDF, manuel) :
1. Extraire l'acheteur → Organisation CRM
2. Extraire le contact (si disponible) → Contact CRM
3. Créer l'opportunité liée → Opportunité CRM

Fonctionne de manière idempotente (pas de doublons si même acheteur).
"""
from __future__ import annotations
import logging
import re
from typing import Optional

from sqlalchemy.orm import Session

log = logging.getLogger("datasphere.crm_auto_extract")


# ── Normalisation des noms ────────────────────────────────────────────────────

_ABBREV = {
    "DINUM": "Direction Interministérielle du Numérique",
    "DINSIC": "Direction Interministérielle des Systèmes d'Information",
    "DGFIP": "Direction Générale des Finances Publiques",
    "ANSSI": "Agence Nationale de la Sécurité des Systèmes d'Information",
    "CNRS": "Centre National de la Recherche Scientifique",
    "CHU": "Centre Hospitalier Universitaire",
    "CHS": "Centre Hospitalier Spécialisé",
    "EPIC": "Établissement Public à Caractère Industriel et Commercial",
    "EPA": "Établissement Public Administratif",
    "MAIRIE DE": "Mairie de",
    "CD": "Conseil Départemental",
    "CR": "Conseil Régional",
}

def normalize_org_name(name: str) -> str:
    """Normalise le nom d'acheteur pour éviter les doublons."""
    if not name:
        return ""
    name = name.strip()
    # Supprimer parenthèses redondantes
    name = re.sub(r'\s*\([^)]*\)\s*$', '', name).strip()
    # Truncate à 255 chars
    return name[:255]


def guess_org_type(name: str, sector: str | None = None) -> str:
    """Devine le type d'organisation depuis le nom."""
    n = (name or "").lower()
    if any(w in n for w in ["ministère", "ministry", "ministre"]):
        return "Ministère"
    if any(w in n for w in ["mairie", "commune", "ville de", "city"]):
        return "Collectivité locale"
    if any(w in n for w in ["conseil départemental", "conseil régional", "métropole", "intercommunalité"]):
        return "Collectivité territoriale"
    if any(w in n for w in ["chu", "ch ", "hôpital", "hospital", "aphp", "chs"]):
        return "Établissement de santé"
    if any(w in n for w in ["université", "univ.", "cnrs", "inria", "inserm", "école "]):
        return "Établissement public / Recherche"
    if any(w in n for w in ["sncf", "ratp", "edf", "engie", "orange", "la poste"]):
        return "Entreprise publique / OPE"
    if any(w in n for w in ["etat", "état", "république", "préfecture", "dinum", "dgfip", "anssi"]):
        return "Administration centrale"
    if sector and "défense" in sector.lower():
        return "Défense / Sécurité"
    return "Organisme public"


def guess_sector(title: str, summary: str | None = None) -> str:
    """Devine le secteur depuis le titre + résumé de l'AO."""
    text = f"{title or ''} {summary or ''}".lower()
    sectors = [
        ("Data / IA / Numérique", ["data", "ia", "intelligence artificielle", "numérique", "digital", "informatique", "logiciel", "système d'information", "si ", "erp", "crm"]),
        ("Cybersécurité", ["cybersécurité", "sécurité informatique", "pentest", "soc", "anssi"]),
        ("Cloud / Infrastructure", ["cloud", "infrastructure", "hébergement", "serveur", "datacenter", "azure", "aws", "gcp"]),
        ("Santé", ["santé", "médical", "hôpital", "patient", "ehpad", "chu"]),
        ("Éducation / Formation", ["formation", "éducation", "enseignement", "université", "école"]),
        ("Mobilité / Transport", ["transport", "mobilité", "sncf", "ratp", "ferroviaire", "routier"]),
        ("Énergie / Environnement", ["énergie", "environnement", "eau", "déchets", "développement durable"]),
        ("Finance / Comptabilité", ["finance", "comptabilité", "audit", "trésorerie", "budget", "dgfip"]),
        ("RH / SIRH", ["rh", "ressources humaines", "sirh", "paie", "recrutement"]),
        ("Conseil / Assistance", ["conseil", "assistance à maîtrise", "amo", "amoa", "expertise"]),
    ]
    for sector_name, keywords in sectors:
        if any(kw in text for kw in keywords):
            return sector_name
    return "Services publics / Administration"


def extract_contact_from_text(text: str) -> dict | None:
    """Tente d'extraire un contact depuis le texte d'un AO."""
    if not text:
        return None
    # Email
    email_m = re.search(r'[\w.+-]+@[\w-]+\.[a-z]{2,6}', text, re.I)
    # Téléphone FR
    phone_m = re.search(r'(?:0|\+33)[1-9](?:[\s.-]?\d{2}){4}', text)
    # Nom (Prénom NOM ou Monsieur/Madame Prénom NOM)
    name_m = re.search(
        r'(?:contact\s*:?\s*|responsable\s*:?\s*|M\.\s+|Mme\s+|M\s+)([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][A-ZÀ-Üa-zà-ü]+){1,2})',
        text, re.I
    )
    # Titre
    title_m = re.search(
        r'(?:directeur|directrice|responsable|chef de|chargé[e]? de|DSI|DAF|DRH|acheteur|acheteure)\b[^,\n]{0,50}',
        text, re.I
    )

    if not email_m and not name_m:
        return None

    result: dict = {}
    if name_m:
        parts = name_m.group(1).strip().split()
        result["first_name"] = parts[0] if parts else ""
        result["last_name"] = " ".join(parts[1:]) if len(parts) > 1 else ""
    if email_m:
        result["professional_email"] = email_m.group(0)
    if phone_m:
        result["phone"] = phone_m.group(0)
    if title_m:
        result["job_title"] = title_m.group(0).strip()[:100]

    return result if result else None


# ── Agent principal ───────────────────────────────────────────────────────────

def auto_extract_crm_from_tender(
    db: Session,
    tender,
    current_user_email: str | None = None,
    force: bool = False,
) -> dict:
    """
    Point d'entrée principal : extrait et crée les entités CRM depuis un AO.

    Returns:
        {
            "organization": OrganizationRead | None,
            "contact": ContactRead | None,
            "opportunity": OpportunityRead | None,
            "created": {"org": bool, "contact": bool, "opp": bool},
            "message": str,
        }
    """
    from app.crud.organization import get_organization_by_name, create_organization
    from app.crud.contact import get_contact_by_email, create_contact
    from app.crud.opportunity import create_opportunity
    from app.schemas.organization import OrganizationCreate
    from app.schemas.contact import ContactCreate
    from app.schemas.opportunity import OpportunityCreate

    result = {"organization": None, "contact": None, "opportunity": None,
              "created": {"org": False, "contact": False, "opp": False},
              "message": ""}

    buyer_raw = getattr(tender, "buyer_name", None) or ""
    buyer = normalize_org_name(buyer_raw)

    if not buyer:
        result["message"] = "Aucun acheteur renseigné — extraction impossible"
        return result

    # ── 1. Organisation ───────────────────────────────────────────────────────
    org = get_organization_by_name(db, buyer)
    if org and not force:
        result["organization"] = org
        log.info("CRM: org '%s' déjà existante (id=%d)", buyer, org.id)
    else:
        sector  = guess_sector(tender.title or "", getattr(tender, "summary", None))
        org_type = guess_org_type(buyer, sector)
        source_url = getattr(tender, "source_url", None)

        org = create_organization(db, OrganizationCreate(
            name=buyer,
            sector=sector,
            organization_type=org_type,
            country="France",
            source="agent_tender",
            source_url=source_url,
            confidence_score=0.85,
            ai_notes=(
                f"Extrait automatiquement depuis l'AO #{tender.id}: {tender.title[:80]}\n"
                f"Source: {getattr(tender, 'source', 'manual')}"
            ),
        ))
        result["created"]["org"] = True
        log.info("CRM: nouvelle org créée '%s' (id=%d)", buyer, org.id)

    result["organization"] = org

    # ── 2. Contact ────────────────────────────────────────────────────────────
    contact_data = extract_contact_from_text(
        f"{getattr(tender, 'summary', '') or ''} "
        f"{getattr(tender, 'ai_notes', '') or ''}"
    )

    if contact_data and contact_data.get("professional_email"):
        existing_contact = get_contact_by_email(db, contact_data["professional_email"])
        if not existing_contact:
            contact = create_contact(db, ContactCreate(
                organization_id=org.id,
                first_name=contact_data.get("first_name", ""),
                last_name=contact_data.get("last_name", ""),
                job_title=contact_data.get("job_title", "Responsable achat"),
                professional_email=contact_data["professional_email"],
                source="agent_tender",
                notes=f"Extrait auto depuis AO #{tender.id}",
            ))
            result["contact"] = contact
            result["created"]["contact"] = True
            log.info("CRM: contact créé '%s' pour org '%s'",
                     contact_data.get("professional_email"), buyer)

    # ── 3. Opportunité ────────────────────────────────────────────────────────
    # Vérifier si une opportunité liée à cet AO existe déjà
    try:
        from sqlalchemy import text as sql_text
        existing_opp = db.execute(sql_text(
            "SELECT id FROM opportunities WHERE organization_id=:oid "
            "AND title LIKE :title LIMIT 1"
        ), {"oid": org.id, "title": f"%{(tender.title or '')[:50]}%"}).fetchone()
    except Exception:
        existing_opp = None

    if not existing_opp:
        sector = guess_sector(tender.title or "", getattr(tender, "summary", None))
        budget = getattr(tender, "estimated_budget", None)
        deadline = getattr(tender, "submission_deadline", None)

        opp = create_opportunity(db, OpportunityCreate(
            organization_id=org.id,
            title=f"{tender.title[:200] if tender.title else 'Opportunité'} — AO #{tender.id}",
            opportunity_type="Appel d'offres public",
            country="France",
            sector=sector,
            status="Prospect identifie",
            priority="Haute" if getattr(tender, "go_no_go_score", 0) and tender.go_no_go_score >= 70 else "Moyenne",
            probability=max(10, min(80, (tender.go_no_go_score or 50))),
            potential_value=budget,
            next_action="Analyser le cahier des charges",
            next_action_date=deadline,
            owner_name=current_user_email,
            notes=(
                f"AO #{tender.id} — Source: {getattr(tender, 'source', 'manual')}\n"
                f"Score Go/No-Go: {tender.go_no_go_score or 'N/A'}/100\n"
                f"URL: {getattr(tender, 'source_url', 'N/A')}"
            ),
            source="agent_tender",
            source_url=getattr(tender, "source_url", None),
            confidence_score=0.9,
            ai_notes=f"Créé automatiquement depuis l'AO #{tender.id}",
        ))
        result["opportunity"] = opp
        result["created"]["opp"] = True
        log.info("CRM: opportunité créée '%s' (id=%d)", opp.title[:60], opp.id)

    created = result["created"]
    parts = []
    if created["org"]:  parts.append("1 organisation")
    if created["contact"]: parts.append("1 contact")
    if created["opp"]:  parts.append("1 opportunité")

    if parts:
        result["message"] = f"✅ CRM enrichi : {', '.join(parts)} créé(s)"
    else:
        result["message"] = "ℹ️ CRM déjà à jour (entités existantes)"

    return result


# ── Extraction en masse ────────────────────────────────────────────────────────

def bulk_extract_crm_from_tenders(
    db: Session,
    limit: int = 50,
    source_filter: str | None = None,
    current_user_email: str | None = None,
) -> dict:
    """
    Lance l'extraction CRM sur tous les AOs récents (ceux sans organisation CRM liée).
    """
    from app.models.tender import Tender
    query = db.query(Tender).filter(Tender.buyer_name.isnot(None))
    if source_filter:
        query = query.filter(Tender.source == source_filter)
    query = query.order_by(Tender.created_at.desc()).limit(limit)
    tenders = query.all()

    totals = {"processed": 0, "org_created": 0, "contact_created": 0, "opp_created": 0, "errors": 0}

    for t in tenders:
        try:
            r = auto_extract_crm_from_tender(db, t, current_user_email)
            totals["processed"] += 1
            if r["created"]["org"]:     totals["org_created"] += 1
            if r["created"]["contact"]: totals["contact_created"] += 1
            if r["created"]["opp"]:     totals["opp_created"] += 1
        except Exception as e:
            log.warning("bulk_extract: AO #%d failed: %s", t.id, e)
            totals["errors"] += 1

    log.info("bulk_extract_crm: %s", totals)
    return totals
