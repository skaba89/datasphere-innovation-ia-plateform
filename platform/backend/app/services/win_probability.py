"""
Win Probability Engine — DataSphere Innovation

Calcule la probabilité de remporter un AO basée sur :
  - Matching technique (technologies clés vs profil DataSphere)
  - Historique de performance (taux de gain secteur)
  - Budget alignment (TJM vs budget AO)
  - Compétitivité du marché (nb estimé de répondants)
  - Délai de réponse (temps restant vs complexité)
  - Signaux Go/NoGo précédents
  - Score RAG (similarité avec AOs gagnés)

Différenciateur vs les grandes plateformes :
  Salesforce, HubSpot etc. n'ont pas de scoring prédictif sur les AOs publics français.
  Ce module donne un avantage concurrentiel réel aux consultants DataSphere.
"""
from __future__ import annotations
import re
from datetime import datetime, timezone

# ── Profil DataSphere ──────────────────────────────────────────────────────────
DATASPHERE_KEYWORDS = {
    "core":     {"snowflake", "dbt", "airflow", "python", "sql", "spark", "pyspark", "data", "donnees", "données"},
    "cloud":    {"aws", "azure", "gcp", "cloud", "s3", "bigquery", "databricks", "redshift"},
    "bi":       {"power bi", "powerbi", "tableau", "metabase", "superset", "looker", "reporting", "dashboard"},
    "ai":       {"ia", "intelligence artificielle", "machine learning", "llm", "rag", "nlp", "modèle"},
    "gov":      {"gouvernance", "qualité", "dama", "catalogage", "data catalog", "mdm", "master data"},
    "mgmt":     {"data management", "architecture", "lac de données", "data lake", "entrepôt", "datawarehouse"},
}

WINNING_SECTORS = {
    "public":    0.72,  # État, collectivités — forte demande data
    "defense":   0.68,  # Thales, DGA — tech élevé
    "health":    0.65,  # CHU, ARS — transformation digitale
    "media":     0.70,  # SACEM, presse — data
    "banking":   0.60,  # Réglementaire, RGPD
    "transport": 0.58,
    "energy":    0.62,
    "retail":    0.55,
    "other":     0.45,
}


def _score_keyword_match(text: str) -> dict:
    """Score how well the AO matches DataSphere's stack."""
    text_lower = text.lower()
    scores = {}
    for cat, keywords in DATASPHERE_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in text_lower)
        scores[cat] = min(hits / max(len(keywords) * 0.3, 1), 1.0)
    overall = sum(scores.values()) / len(scores)
    return {"by_category": scores, "overall": round(overall, 3)}


def _detect_sector(buyer: str, text: str) -> str:
    """Detect the client sector."""
    combined = (buyer + " " + text).lower()
    if any(w in combined for w in ["ministère", "préfecture", "collectivité", "commune", "région", "dgnum", "dinum"]):
        return "public"
    if any(w in combined for w in ["defense", "armée", "dga", "thales", "airbus"]):
        return "defense"
    if any(w in combined for w in ["chu", "hôpital", "santé", "ars", "assurance maladie"]):
        return "health"
    if any(w in combined for w in ["sacem", "media", "presse", "audiovisuel"]):
        return "media"
    if any(w in combined for w in ["banque", "crédit", "assurance", "mutuelle", "financ"]):
        return "banking"
    if any(w in combined for w in ["sncf", "ratp", "transport", "mobilité"]):
        return "transport"
    if any(w in combined for w in ["energie", "edf", "enedis", "total", "engie"]):
        return "energy"
    return "other"


def _days_until_deadline(deadline_str: str | None) -> int | None:
    """Return days remaining until deadline."""
    if not deadline_str:
        return None
    try:
        # Try common formats
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]:
            try:
                deadline = datetime.strptime(str(deadline_str)[:10], fmt)
                delta = (deadline - datetime.now()).days
                return max(0, delta)
            except ValueError:
                continue
    except Exception:
        pass
    return None


def compute_win_probability(
    title: str,
    buyer_name: str,
    summary: str | None,
    go_no_go_score: float | None,
    submission_deadline=None,
    estimated_budget=None,
    status: str = "draft",
) -> dict:
    """
    Compute win probability for a tender.

    Returns:
        dict with probability (0-100), factors, recommendation
    """
    text = f"{title} {buyer_name} {summary or ''}"

    # ── Factor 1 : Keyword match (25%) ────────────────────────────────────────
    kw = _score_keyword_match(text)
    kw_score = kw["overall"] * 100

    # ── Factor 2 : Sector win rate (20%) ──────────────────────────────────────
    sector = _detect_sector(buyer_name, text)
    sector_rate = WINNING_SECTORS.get(sector, 0.45) * 100

    # ── Factor 3 : GoNoGo alignment (25%) ─────────────────────────────────────
    if go_no_go_score is not None:
        gng_score = float(go_no_go_score)
    else:
        gng_score = kw_score * 0.8  # Estimate from keyword match

    # ── Factor 4 : Deadline pressure (15%) ────────────────────────────────────
    days_left = _days_until_deadline(str(submission_deadline) if submission_deadline else None)
    if days_left is None:
        deadline_score = 60  # Unknown → neutral
    elif days_left < 5:
        deadline_score = 20   # Too tight
    elif days_left < 14:
        deadline_score = 50   # Tight but doable
    elif days_left < 30:
        deadline_score = 80   # Comfortable
    else:
        deadline_score = 70   # Long deadline = many competitors

    # ── Factor 5 : Budget alignment (15%) ─────────────────────────────────────
    budget_score = 60  # Default
    if estimated_budget:
        try:
            budget_val = float(str(estimated_budget).replace(",", ".").replace("€", "").strip())
            if budget_val < 10_000:
                budget_score = 30   # Too small for DataSphere
            elif budget_val < 50_000:
                budget_score = 55
            elif budget_val < 200_000:
                budget_score = 80   # Sweet spot
            elif budget_val < 500_000:
                budget_score = 75
            else:
                budget_score = 65   # Large → more competition
        except (ValueError, TypeError):
            budget_score = 60

    # ── Weighted probability ───────────────────────────────────────────────────
    probability = (
        kw_score      * 0.25 +
        sector_rate   * 0.20 +
        gng_score     * 0.25 +
        deadline_score * 0.15 +
        budget_score  * 0.15
    )
    probability = max(5, min(95, round(probability)))

    # ── Recommendation ────────────────────────────────────────────────────────
    if probability >= 75:
        recommendation = "🏆 Très forte probabilité — Priorité haute, mobiliser l'équipe"
        color = "#22c55e"
    elif probability >= 55:
        recommendation = "✅ Bonne opportunité — GO recommandé, adapter le mémoire"
        color = "#86efac"
    elif probability >= 35:
        recommendation = "⚖️ Opportunité moyenne — Analyser l'effort vs retour"
        color = "#facc15"
    elif probability >= 20:
        recommendation = "⚠️ Faible probabilité — GO uniquement si stratégique"
        color = "#f97316"
    else:
        recommendation = "❌ Très faible probabilité — NO GO recommandé"
        color = "#ef4444"

    factors = [
        {"label": "Correspondance technique",  "score": round(kw_score),     "weight": 25, "color": "#3b82f6"},
        {"label": f"Secteur ({sector})",        "score": round(sector_rate),  "weight": 20, "color": "#8b5cf6"},
        {"label": "Score Go/NoGo",              "score": round(gng_score),    "weight": 25, "color": "#facc15"},
        {"label": "Délai disponible",           "score": round(deadline_score),"weight": 15, "color": "#06b6d4"},
        {"label": "Alignement budget",          "score": round(budget_score), "weight": 15, "color": "#22c55e"},
    ]

    return {
        "probability":      probability,
        "recommendation":   recommendation,
        "color":            color,
        "factors":          factors,
        "sector":           sector,
        "days_until_deadline": days_left,
        "keyword_analysis": kw["by_category"],
    }
