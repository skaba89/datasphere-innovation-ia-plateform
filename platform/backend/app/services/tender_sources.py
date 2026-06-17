"""
Tender Sources — Sources multiples pour la veille AO

Sources supportées:
  - boamp      : BOAMP (Bulletin Officiel des Annonces des Marchés Publics) — France
  - ted        : TED (Tenders Electronic Daily) — Europe / OJEU
  - place      : PLACE (Plateforme des achats de l'État) — France centrale
  - maximilien : Maximilien — Île-de-France
  - megalis    : Mégalis — Bretagne
  - pdf        : Import PDF manuel (extraction par LLM)
  - manual     : Saisie manuelle
  - linkedin   : Détection via LinkedIn / réseaux sociaux
  - ai_web     : Crawl web IA (Perplexity / search)
"""
from __future__ import annotations
import logging
import re
from datetime import datetime, timedelta
from typing import Any
import httpx

log = logging.getLogger("datasphere.tender_sources")

# ── Configuration des sources ─────────────────────────────────────────────────

SOURCES = {
    "boamp": {
        "name": "BOAMP",
        "label": "BOAMP (France)",
        "description": "Bulletin Officiel des Annonces des Marchés Publics",
        "icon": "🇫🇷",
        "url": "https://www.boamp.fr",
        "api_url": "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records",
        "active": True,
        "region": "France",
        "categories": ["Travaux", "Fournitures", "Services"],
    },
    "ted": {
        "name": "TED",
        "label": "TED / JOUE (Europe)",
        "description": "Tenders Electronic Daily — Journal Officiel de l'UE",
        "icon": "🇪🇺",
        "url": "https://ted.europa.eu",
        "api_url": "https://ted.europa.eu/api/v3.0/notices/search",
        "active": True,
        "region": "Europe",
        "categories": ["Tous secteurs"],
    },
    "place": {
        "name": "PLACE",
        "label": "PLACE (État français)",
        "description": "Plateforme des achats de l'État — marchés ministériels",
        "icon": "🏛️",
        "url": "https://www.marches-publics.gouv.fr",
        "api_url": None,  # scraping
        "active": True,
        "region": "France",
        "categories": ["Services", "Informatique", "Conseil"],
    },
    "maximilien": {
        "name": "Maximilien",
        "label": "Maximilien (Île-de-France)",
        "description": "Plateforme des marchés publics d'Île-de-France",
        "icon": "🗼",
        "url": "https://www.maximilien.fr",
        "api_url": "https://www.maximilien.fr/api/",
        "active": True,
        "region": "Île-de-France",
        "categories": ["Tous secteurs"],
    },
    "megalis": {
        "name": "Mégalis",
        "label": "Mégalis (Bretagne)",
        "description": "Plateforme Marchés Publics Bretagne",
        "icon": "⛵",
        "url": "https://marches.megalisbretagne.org",
        "api_url": None,
        "active": True,
        "region": "Bretagne",
        "categories": ["Tous secteurs"],
    },
    "pdf": {
        "name": "PDF",
        "label": "Import PDF / DCEAO",
        "description": "Import d'un cahier des charges ou DCEAO au format PDF",
        "icon": "📄",
        "url": None,
        "api_url": None,
        "active": True,
        "region": "Manuel",
        "categories": ["Tous secteurs"],
    },
    "ai_web": {
        "name": "AI Web",
        "label": "Veille IA Web",
        "description": "Recherche automatique via IA sur le web (DuckDuckGo + LLM)",
        "icon": "🤖",
        "url": None,
        "api_url": None,
        "active": True,
        "region": "Mondial",
        "categories": ["Tous secteurs"],
    },
    "manual": {
        "name": "Manuel",
        "label": "Saisie manuelle",
        "description": "Saisie directe d'un AO",
        "icon": "✏️",
        "url": None,
        "api_url": None,
        "active": True,
        "region": "Manuel",
        "categories": ["Tous secteurs"],
    },
}


def get_all_sources() -> list[dict]:
    return [{"id": k, **v} for k, v in SOURCES.items()]


def get_active_sources() -> list[dict]:
    return [{"id": k, **v} for k, v in SOURCES.items() if v.get("active")]


# ── BOAMP ─────────────────────────────────────────────────────────────────────

def fetch_boamp(
    keywords: str,
    limit: int = 20,
    days_back: int = 30,
) -> list[dict]:
    """Recherche sur BOAMP via l'API Open Data."""
    since = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    params = {
        "select": "idweb,objet,acheteur,dateparution,datelimitereponse,montantestime,url,famille",
        "where": f"objet like '%{keywords}%' AND dateparution >= '{since}'",
        "order_by": "dateparution DESC",
        "limit": min(limit, 100),
    }
    try:
        resp = httpx.get(
            SOURCES["boamp"]["api_url"],
            params=params,
            timeout=15,
            follow_redirects=True,
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        return [_normalize_boamp_record(r) for r in results if r.get("objet")]
    except Exception as e:
        log.warning("BOAMP fetch error: %s", e)
        return []


def _normalize_boamp_record(r: dict) -> dict:
    acheteur = r.get("acheteur", {})
    if isinstance(acheteur, str):
        buyer_name = acheteur
    elif isinstance(acheteur, dict):
        buyer_name = acheteur.get("denomination", "") or acheteur.get("nom", "")
    else:
        buyer_name = ""

    deadline = r.get("datelimitereponse")
    pub_date  = r.get("dateparution")

    return {
        "source": "boamp",
        "source_id": r.get("idweb", ""),
        "title": (r.get("objet", "") or "")[:255],
        "buyer_name": buyer_name[:255] if buyer_name else "",
        "publication_date": _parse_date(pub_date),
        "submission_deadline": _parse_date(deadline),
        "source_url": r.get("url") or f"https://www.boamp.fr/avis/detail/{r.get('idweb', '')}",
        "estimated_budget": _parse_amount(r.get("montantestime")),
        "category": r.get("famille", ""),
        "summary": "",
        "status": "draft",
    }


# ── TED (Europe) ──────────────────────────────────────────────────────────────

def fetch_ted(
    keywords: str,
    limit: int = 20,
    country: str = "FR",
) -> list[dict]:
    """Recherche sur TED via l'API REST."""
    payload = {
        "query": keywords,
        "scope": 3,
        "fields": ["ND", "TI", "CA_CE_NAM", "DT_DISPATCH", "DT_DEADLINE", "ACA_CE_NAME"],
        "paginationMode": "PAGE",
        "page": 1,
        "pageSize": min(limit, 50),
        "reverseOrder": False,
        "queryLanguage": "fr",
    }
    if country:
        payload["countryCode"] = [country]
    try:
        resp = httpx.post(
            SOURCES["ted"]["api_url"],
            json=payload,
            timeout=15,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        notices = data.get("notices", [])
        return [_normalize_ted_record(n) for n in notices if n.get("TI")]
    except Exception as e:
        log.warning("TED fetch error: %s", e)
        return []


def _normalize_ted_record(n: dict) -> dict:
    return {
        "source": "ted",
        "source_id": n.get("ND", ""),
        "title": (n.get("TI", [""]) or [""])[0][:255],
        "buyer_name": (n.get("CA_CE_NAM", [""]) or [""])[0][:255],
        "publication_date": _parse_date(n.get("DT_DISPATCH")),
        "submission_deadline": _parse_date(n.get("DT_DEADLINE")),
        "source_url": f"https://ted.europa.eu/udl?uri=TED:NOTICE:{n.get('ND', '')}:TEXT:FR:HTML",
        "estimated_budget": None,
        "category": "Europe",
        "summary": "",
        "status": "draft",
    }


# ── Veille IA Web (DuckDuckGo + extraction) ───────────────────────────────────

def fetch_ai_web(keywords: str, limit: int = 10) -> list[dict]:
    """
    Recherche d'AOs via DuckDuckGo Instant Answer API.
    Complète avec extraction LLM si disponible.
    """
    search_query = f"appel d'offres {keywords} marchés publics 2025 2026"
    results = []
    try:
        resp = httpx.get(
            "https://api.duckduckgo.com/",
            params={"q": search_query, "format": "json", "no_html": 1, "skip_disambig": 1},
            timeout=10,
        )
        data = resp.json()
        # Extraire les résultats organiques
        related = data.get("RelatedTopics", [])
        for item in related[:limit]:
            text = item.get("Text", "")
            url  = item.get("FirstURL", "")
            if text and url:
                results.append({
                    "source": "ai_web",
                    "source_id": url,
                    "title": text[:200],
                    "buyer_name": _extract_buyer_from_text(text),
                    "publication_date": None,
                    "submission_deadline": None,
                    "source_url": url,
                    "estimated_budget": None,
                    "category": "Web",
                    "summary": text,
                    "status": "draft",
                })
    except Exception as e:
        log.warning("AI web fetch error: %s", e)
    return results


def _extract_buyer_from_text(text: str) -> str:
    """Extrait le nom de l'acheteur depuis un texte libre."""
    patterns = [
        r'(?:par|publié par|lancé par|émis par)\s+([A-ZÀÉÈÊËÎÏÔÙÛÜÇ][^,\.\n]{5,60})',
        r'([A-ZÀÉÈÊËÎÏÔÙÛÜÇ][^,\.\n]{5,60})\s+(?:recherche|recrute|lance)',
        r'acheteur\s*:?\s*([A-ZÀÉÈÊËÎÏÔÙÛÜÇ][^,\.\n]{5,60})',
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            return m.group(1).strip()[:255]
    return ""


# ── Maximilien (Île-de-France) ────────────────────────────────────────────────

def fetch_maximilien(keywords: str, limit: int = 20) -> list[dict]:
    """Recherche sur Maximilien (marchés IDF)."""
    try:
        resp = httpx.get(
            "https://www.maximilien.fr/api/marches",
            params={"q": keywords, "limit": limit, "format": "json"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return [_normalize_maximilien(r) for r in data.get("results", [])[:limit]]
    except Exception as e:
        log.warning("Maximilien fetch error: %s", e)
    return []


def _normalize_maximilien(r: dict) -> dict:
    return {
        "source": "maximilien",
        "source_id": r.get("id", ""),
        "title": (r.get("intitule") or r.get("objet", ""))[:255],
        "buyer_name": (r.get("acheteur") or r.get("organisme", ""))[:255],
        "publication_date": _parse_date(r.get("datePublication")),
        "submission_deadline": _parse_date(r.get("dateLimiteDepot")),
        "source_url": r.get("url") or f"https://www.maximilien.fr/marches/{r.get('id', '')}",
        "estimated_budget": _parse_amount(r.get("montant")),
        "category": r.get("typeMarche", ""),
        "summary": r.get("description", "")[:500],
        "status": "draft",
    }


# ── Unified search across all sources ────────────────────────────────────────

def search_all_sources(
    keywords: str,
    sources: list[str] | None = None,
    limit_per_source: int = 10,
) -> dict[str, list[dict]]:
    """
    Lance la recherche sur plusieurs sources en parallèle.
    Returns: {source_id: [normalized_results]}
    """
    import concurrent.futures

    active = sources or [k for k, v in SOURCES.items() if v.get("active") and k not in ("pdf", "manual")]
    fetchers = {
        "boamp":      lambda: fetch_boamp(keywords, limit_per_source),
        "ted":        lambda: fetch_ted(keywords, limit_per_source),
        "ai_web":     lambda: fetch_ai_web(keywords, limit_per_source),
        "maximilien": lambda: fetch_maximilien(keywords, limit_per_source),
        "megalis":    lambda: [],  # pas d'API publique stable
        "place":      lambda: [],  # pas d'API publique stable
    }

    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            source_id: executor.submit(fetchers[source_id])
            for source_id in active
            if source_id in fetchers
        }
        for source_id, future in futures.items():
            try:
                results[source_id] = future.result(timeout=20)
                log.info("Source %s: %d résultats", source_id, len(results[source_id]))
            except Exception as e:
                log.warning("Source %s timeout/error: %s", source_id, e)
                results[source_id] = []

    return results


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_date(s: Any) -> datetime | None:
    if not s:
        return None
    if isinstance(s, datetime):
        return s
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(s)[:19], fmt)
        except ValueError:
            continue
    return None


def _parse_amount(s: Any) -> float | None:
    if not s:
        return None
    try:
        return float(str(s).replace(" ", "").replace(",", ".").replace("€", ""))
    except (ValueError, TypeError):
        return None
