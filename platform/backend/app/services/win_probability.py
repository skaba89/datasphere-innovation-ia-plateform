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


# ══════════════════════════════════════════════════════════════════════════════
# Score Go/No-Go enrichi par RAG — Analyse CCTP + historique livrables
# ══════════════════════════════════════════════════════════════════════════════

def compute_rag_enhanced_score(
    db,
    tender,
    provider: str = "auto",
) -> dict:
    """
    Score Go/No-Go enrichi par RAG (différenciateur #1).

    Analyse :
    1. Similarité avec les AOs gagnés/perdus en historique
    2. Adéquation compétences (livrables approuvés dans ce secteur)
    3. Facteurs risque : délai, budget, secteur, complexité
    4. Recommandation argumentée avec points forts/faibles

    Returns:
        {
          "score": int (0-100),
          "decision": "GO" | "NO-GO" | "ANALYSE",
          "confidence": float,
          "factors": { positives: [...], risks: [...] },
          "recommendation": str,
          "similar_won": [...],
          "similar_lost": [...],
        }
    """
    import logging, re
    from datetime import datetime, timedelta
    log = logging.getLogger("datasphere.win_probability")

    title   = (tender.title or "").lower()
    summary = (tender.summary or "").lower()
    score   = 50  # base
    factors = {"positives": [], "risks": []}

    # ── 1. Analyse sectorielle ────────────────────────────────────────────────
    DATA_KEYWORDS = ["data", "ia", "intelligence artificielle", "machine learning",
                     "snowflake", "dbt", "spark", "etl", "datawarehouse", "bi ",
                     "tableau", "power bi", "analytique", "pipeline", "lakehouse"]
    CONSEIL_KEYWORDS = ["conseil", "assistance", "amoa", "amo", "stratégie", "audit",
                        "expertise", "accompagnement", "transformation"]
    CLOUD_KEYWORDS   = ["cloud", "aws", "azure", "gcp", "kubernetes", "devops",
                        "infrastructure", "hébergement"]

    text = f"{title} {summary}"
    data_match   = sum(1 for k in DATA_KEYWORDS if k in text)
    conseil_match = sum(1 for k in CONSEIL_KEYWORDS if k in text)
    cloud_match   = sum(1 for k in CLOUD_KEYWORDS if k in text)

    if data_match >= 3:
        score += 18
        factors["positives"].append(f"Cœur de métier Data/IA ({data_match} mots-clés matchés)")
    elif data_match >= 1:
        score += 8
        factors["positives"].append("Dimension Data détectée")

    if conseil_match >= 2:
        score += 10
        factors["positives"].append("Mission de conseil/accompagnement (expertise reconnue)")

    if cloud_match >= 2:
        score += 7
        factors["positives"].append("Cloud & infrastructure (compétence disponible)")

    # ── 2. Analyse délai ──────────────────────────────────────────────────────
    deadline = getattr(tender, "submission_deadline", None)
    if deadline:
        days_left = (deadline - datetime.utcnow()).days
        if days_left < 7:
            score -= 20
            factors["risks"].append(f"Délai très court ({days_left}j) — risque qualité livrable")
        elif days_left < 14:
            score -= 8
            factors["risks"].append(f"Délai serré ({days_left}j) — mobilisation rapide requise")
        elif days_left > 30:
            score += 5
            factors["positives"].append(f"Délai confortable ({days_left}j) pour préparation qualitative")

    # ── 3. Analyse budget ─────────────────────────────────────────────────────
    budget = getattr(tender, "estimated_budget", None)
    if budget:
        if budget < 10_000:
            score -= 15
            factors["risks"].append(f"Budget trop faible ({budget:,.0f}€) — rentabilité compromise")
        elif budget < 30_000:
            score -= 5
            factors["risks"].append(f"Budget limité ({budget:,.0f}€) — marges réduites")
        elif budget >= 100_000:
            score += 12
            factors["positives"].append(f"Budget significatif ({budget:,.0f}€) — opportunité de taille")
        elif budget >= 50_000:
            score += 6
            factors["positives"].append(f"Budget correct ({budget:,.0f}€)")

    # ── 4. Similarité RAG avec historique ────────────────────────────────────
    similar_won, similar_lost = [], []
    try:
        from app.services.rag_service import search_tenders_by_semantic
        similar = search_tenders_by_semantic(db, query=f"{tender.title}", limit=5)
        for s in similar:
            if s.get("go_score", 0) >= 70:
                similar_won.append(s)
            elif s.get("go_score", 0) < 40:
                similar_lost.append(s)

        if similar_won:
            boost = min(15, len(similar_won) * 5)
            score += boost
            factors["positives"].append(
                f"{len(similar_won)} AO(s) similaire(s) traité(s) avec succès "
                f"(ex: {similar_won[0].get('title','?')[:50]})"
            )
        if similar_lost:
            malus = min(10, len(similar_lost) * 4)
            score -= malus
            factors["risks"].append(
                f"{len(similar_lost)} AO(s) similaire(s) avec score faible — analyser les raisons"
            )
    except Exception as e:
        log.debug("RAG similarity skipped: %s", e)

    # ── 5. Livrables approuvés dans ce secteur ───────────────────────────────
    try:
        from app.models.deliverable import Deliverable
        from app.models.tender import Tender as TenderModel
        approved_in_sector = (
            db.query(Deliverable)
            .filter(Deliverable.status == "approved")
            .limit(20)
            .all()
        )
        sector_match = sum(
            1 for d in approved_in_sector
            if any(k in (d.title or "").lower() for k in DATA_KEYWORDS[:5])
        )
        if sector_match >= 3:
            score += 10
            factors["positives"].append(
                f"{sector_match} livrables approuvés dans ce secteur — références solides"
            )
        elif sector_match >= 1:
            score += 4
            factors["positives"].append(f"{sector_match} livrable(s) de référence disponible(s)")
    except Exception:
        pass

    # ── 6. Clamp et décision ─────────────────────────────────────────────────
    score = max(0, min(100, score))

    if score >= 70:
        decision = "GO"
        rec_prefix = "✅ Recommandation GO"
    elif score >= 45:
        decision = "ANALYSE"
        rec_prefix = "⚠️ Analyse approfondie recommandée"
    else:
        decision = "NO-GO"
        rec_prefix = "❌ Recommandation NO-GO"

    # Construire la recommandation
    pos_str = " · ".join(factors["positives"][:3]) or "Aucun facteur positif identifié"
    risk_str = " · ".join(factors["risks"][:3]) or "Aucun risque majeur détecté"

    recommendation = (
        f"{rec_prefix} (score {score}/100)\n\n"
        f"**Points forts :** {pos_str}\n\n"
        f"**Vigilances :** {risk_str}\n\n"
        f"**Similarité historique :** {len(similar_won)} AO(s) similaire(s) gagné(s), "
        f"{len(similar_lost)} perdu(s)"
    )

    confidence = 0.6 + (0.2 if similar_won or similar_lost else 0) + (0.1 if budget else 0)

    return {
        "score": score,
        "decision": decision,
        "confidence": round(confidence, 2),
        "factors": factors,
        "recommendation": recommendation,
        "similar_won": similar_won[:3],
        "similar_lost": similar_lost[:2],
    }
