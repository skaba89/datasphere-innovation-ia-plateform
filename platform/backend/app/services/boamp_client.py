"""
Client BOAMP (Bulletin Officiel des Annonces des Marchés Publics)

API officielle : https://www.boamp.fr/api/explore/v2.1/
Documentation : https://www.boamp.fr/pages/api/

Endpoints utilisés :
  GET /catalog/datasets/boamp/records   — recherche dans les annonces
  GET /catalog/datasets/boamp/exports   — export des données

Champs BOAMP utilisés :
  idweb          — identifiant unique
  objet          — objet du marché
  nomacheteur    — nom de l'acheteur public
  dateparution   — date de parution
  datelimitereponse — date limite de réponse
  montant        — montant estimé
  code_cpv       — classification CPV (codes données / IT)
  descripteur    — catégories
  urllink        — lien vers l'annonce complète
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

log = logging.getLogger("datasphere.boamp")

# BOAMP API endpoint (open data, no API key required)
BOAMP_API = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records"

# CPV codes for Data / IT / Digital services
DATA_CPV_PREFIXES = [
    "48",  # Software
    "72",  # IT services
    "73",  # R&D services
    "30",  # IT equipment
    "64",  # Communication services
]

# Keywords for data/tech AO
DATA_KEYWORDS = [
    "data", "données", "datawarehouse", "entrepôt de données",
    "business intelligence", "analytique", "analytics",
    "intelligence artificielle", "machine learning",
    "plateforme numérique", "système d'information",
    "datalake", "data lake", "big data", "ETL",
    "Power BI", "Tableau", "Qlik", "Snowflake", "databricks",
]


@dataclass
class BOAMPAnnonce:
    """Représente une annonce BOAMP normalisée."""
    id:               str
    title:            str
    buyer_name:       str
    reference:        str
    published_date:   str
    deadline:         str | None
    estimated_value:  float | None
    url:              str
    summary:          str
    cpv_codes:        list[str] = field(default_factory=list)
    procedure:        str | None = None
    location:         str | None = None
    raw:              dict = field(default_factory=dict)


def fetch_boamp(
    query: str = "",
    limit: int = 20,
    cpv_filter: bool = True,
    timeout: int = 10,
) -> list[BOAMPAnnonce]:
    """
    Fetch recent tenders from BOAMP API.

    Args:
        query:      Free text search
        limit:      Max results (max 100)
        cpv_filter: Filter by data/IT CPV codes
        timeout:    HTTP timeout in seconds

    Returns:
        List of normalized BOAMPAnnonce objects.
    """
    import urllib.request
    import json

    # Build filters
    where_clauses = []

    # Text search
    if query:
        safe_query = query.replace('"', '').replace("'", "")
        where_clauses.append(f'search(objet, "{safe_query}")')

    # CPV filter: data/IT codes
    if cpv_filter and not query:
        # When no query: look for data-related keywords in the title
        kw_conditions = " OR ".join(
            f'search(objet, "{kw}")' for kw in DATA_KEYWORDS[:8]
        )
        where_clauses.append(f"({kw_conditions})")

    params: dict[str, Any] = {
        "limit":    min(limit, 100),
        "order_by": "dateparution DESC",
        "select":   "idweb,objet,nomacheteur,dateparution,datelimitereponse,"
                    "montant,urllink,descripteur,code_cpv,lieu,procedure",
    }
    if where_clauses:
        params["where"] = " AND ".join(where_clauses)

    url = f"{BOAMP_API}?{urlencode(params)}"
    log.info("BOAMP fetch: %s", url[:120])

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "DataSphere-Innovation/1.9 (contact@datasphere-innovation.fr)",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())

        records = data.get("results", [])
        log.info("BOAMP returned %d records", len(records))
        return [_normalize(r) for r in records]

    except Exception as e:
        log.error("BOAMP API error: %s", e)
        return []


def _normalize(rec: dict) -> BOAMPAnnonce:
    """Convert a raw BOAMP record to a normalized BOAMPAnnonce."""
    idweb = str(rec.get("idweb") or rec.get("id") or hashlib.md5(str(rec).encode()).hexdigest()[:12])

    # Title
    title = str(rec.get("objet") or "Marché sans titre").strip()[:500]

    # Buyer
    buyer = str(rec.get("nomacheteur") or "Acheteur public").strip()[:255]

    # Dates
    pub_date = rec.get("dateparution", "")
    if pub_date:
        try:
            pub_date = datetime.fromisoformat(pub_date[:10]).strftime("%d/%m/%Y")
        except Exception:
            pass

    deadline_raw = rec.get("datelimitereponse", "")
    deadline = None
    if deadline_raw:
        try:
            deadline = datetime.fromisoformat(deadline_raw[:10]).strftime("%d/%m/%Y")
        except Exception:
            deadline = str(deadline_raw)[:20]

    # Value
    montant = None
    if rec.get("montant"):
        try:
            montant = float(str(rec["montant"]).replace(" ", "").replace(",", "."))
        except Exception:
            pass

    # URL
    url = str(rec.get("urllink") or f"https://www.boamp.fr/avis/detail/{idweb}")

    # CPV codes
    cpv = []
    if rec.get("code_cpv"):
        cpv_raw = rec["code_cpv"]
        if isinstance(cpv_raw, list):
            cpv = [str(c) for c in cpv_raw]
        elif isinstance(cpv_raw, str):
            cpv = [cpv_raw]

    # Summary — build from available fields
    summary_parts = []
    if rec.get("descripteur"):
        summary_parts.append(str(rec["descripteur"])[:200])
    if rec.get("procedure"):
        summary_parts.append(f"Procédure : {rec['procedure']}")
    if montant:
        summary_parts.append(f"Montant estimé : {montant:,.0f} €")
    if deadline:
        summary_parts.append(f"Date limite : {deadline}")

    summary = " | ".join(summary_parts) if summary_parts else title[:300]

    return BOAMPAnnonce(
        id=idweb,
        title=title,
        buyer_name=buyer,
        reference=f"BOAMP-{idweb}",
        published_date=pub_date,
        deadline=deadline,
        estimated_value=montant,
        url=url,
        summary=summary,
        cpv_codes=cpv,
        procedure=str(rec.get("procedure", ""))[:100] or None,
        location=str(rec.get("lieu", ""))[:100] or None,
        raw=rec,
    )


def boamp_to_watch_candidate(a: BOAMPAnnonce) -> dict:
    """Convert a BOAMPAnnonce to the format expected by the tender_watch scoring."""
    return {
        "id":              a.id,
        "title":           a.title,
        "reference":       a.reference,
        "buyer_name":      a.buyer_name,
        "source_name":     "BOAMP",
        "source_url":      a.url,
        "country":         "France",
        "sector":          "Public",
        "summary":         a.summary,
        "estimated_value": a.estimated_value or 0,
        "deadline":        a.deadline,
        "published_date":  a.published_date,
        "requirements":    [],
        "cpv_codes":       a.cpv_codes,
        "procedure":       a.procedure,
        "location":        a.location,
    }
