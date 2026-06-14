"""
Intelligence Engine — DataSphere Innovation

Ce module fait ce qu'Accenture, McKinsey et BCG font avec des équipes de 10 analystes.
Automatiquement, en temps réel.

Fonctions :
  forecast_revenue()       — Prédit le CA des 6 prochains mois
  compute_win_rate()       — Taux de conversion Go → Gagné
  competitive_positioning()— Analyse du positionnement concurrentiel
  pipeline_health()        — Santé globale du pipeline commercial
  strategic_recommendations() — Top 3 recommandations IA pour le CEO
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

log = logging.getLogger("datasphere.intelligence")


def forecast_revenue(db: Session) -> dict:
    """Prédit le CA des 6 prochains mois basé sur le pipeline actuel."""
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender

    # Probabilités par stade pipeline
    WIN_PROB = {
        "Prospect identifié":        0.05,
        "Analyse en cours":          0.15,
        "GO — En cours de réponse":  0.35,
        "Réponse soumise":           0.55,
        "Mission gagnée":            1.00,
        "NO GO — Écarté":            0.00,
    }

    opps = db.query(Opportunity).all()
    won_opps = [o for o in opps if o.status == "Mission gagnée"]

    # Historical win rate
    total_decided = len([o for o in opps if o.status in ("Mission gagnée", "NO GO — Écarté")])
    win_rate = len(won_opps) / max(total_decided, 1)

    # Pipeline pondéré
    weighted_pipeline = sum(
        (o.potential_value or 0) * WIN_PROB.get(o.status, 0.1)
        for o in opps if o.status not in ("Mission gagnée", "NO GO — Écarté")
    )

    # Revenue confirmed
    confirmed_revenue = sum(o.potential_value or 0 for o in won_opps)

    # Monthly forecast (spread over 6 months)
    monthly_forecast = []
    today = date.today()
    for i in range(6):
        month = today + timedelta(days=30 * i)
        base = weighted_pipeline / 6
        # Optimistic/pessimistic bounds
        monthly_forecast.append({
            "month": month.strftime("%b %Y"),
            "pessimistic": round(base * 0.6),
            "base": round(base),
            "optimistic": round(base * 1.4),
        })

    return {
        "confirmed_revenue_eur": round(confirmed_revenue),
        "weighted_pipeline_eur": round(weighted_pipeline),
        "total_pipeline_eur":    round(sum(o.potential_value or 0 for o in opps if o.status not in ("NO GO — Écarté",))),
        "win_rate_pct":          round(win_rate * 100, 1),
        "monthly_forecast":      monthly_forecast,
        "total_opportunities":   len(opps),
        "active_opportunities":  len([o for o in opps if o.status not in ("Mission gagnée", "NO GO — Écarté")]),
    }


def compute_win_rate(db: Session) -> dict:
    """Calcule les taux de conversion détaillés par stade."""
    from app.models.opportunity import Opportunity

    opps = db.query(Opportunity).all()
    stages = defaultdict(int)
    for o in opps:
        stages[o.status or "Inconnu"] += 1

    total = len(opps)
    won = stages.get("Mission gagnée", 0)
    lost = stages.get("NO GO — Écarté", 0)
    in_progress = total - won - lost

    return {
        "total": total,
        "won": won,
        "lost": lost,
        "in_progress": in_progress,
        "win_rate_overall": round(won / max(total, 1) * 100, 1),
        "win_rate_decided": round(won / max(won + lost, 1) * 100, 1),
        "stages": dict(stages),
        "conversion_funnel": [
            {"stage": "Prospects",    "count": stages.get("Prospect identifié", 0),       "rate": None},
            {"stage": "En analyse",   "count": stages.get("Analyse en cours", 0),           "rate": round(stages.get("Analyse en cours", 0) / max(stages.get("Prospect identifié", 1), 1) * 100)},
            {"stage": "GO soumis",    "count": stages.get("Réponse soumise", 0),            "rate": round(stages.get("Réponse soumise", 0) / max(stages.get("GO — En cours de réponse", 1), 1) * 100)},
            {"stage": "Gagnées",      "count": won,                                         "rate": round(won / max(stages.get("Réponse soumise", 1), 1) * 100)},
        ]
    }


def pipeline_health(db: Session) -> dict:
    """Score de santé du pipeline 0-100."""
    from app.models.opportunity import Opportunity
    from app.models.tender import Tender

    opps  = db.query(Opportunity).all()
    tenders = db.query(Tender).all()

    scores = {}

    # Score 1 : Volume pipeline (max 25 pts)
    total_val = sum(o.potential_value or 0 for o in opps if o.status not in ("NO GO — Écarté",))
    scores["volume"] = min(25, int(total_val / 20000))  # 25 pts si 500k€+

    # Score 2 : Diversité des stades (max 25 pts)
    stages_present = len(set(o.status for o in opps if o.status not in ("NO GO — Écarté", None)))
    scores["stage_diversity"] = min(25, stages_present * 6)

    # Score 3 : Taux Go/No-Go (max 25 pts)
    go_count  = len([t for t in tenders if t.status == "go"])
    nogo_count = len([t for t in tenders if t.status == "no_go"])
    if go_count + nogo_count > 0:
        go_rate = go_count / (go_count + nogo_count)
        scores["gonogo_balance"] = int(go_rate * 25)
    else:
        scores["gonogo_balance"] = 10  # Neutral if no decisions yet

    # Score 4 : Activité récente (max 25 pts)
    recent_tenders = len([t for t in tenders if t.created_at and
                         (datetime.utcnow() - t.created_at).days < 30])
    scores["recent_activity"] = min(25, recent_tenders * 5)

    total_score = sum(scores.values())

    if total_score >= 80:
        status = "Excellent 🟢"
        advice = "Pipeline en excellente santé. Focalisez sur la qualité des propositions."
    elif total_score >= 60:
        status = "Bon 🟡"
        advice = "Bonne dynamique. Renforcez les stades avancés (Go / Soumis)."
    elif total_score >= 40:
        status = "À améliorer 🟠"
        advice = "Volume insuffisant ou taux de conversion faible. Intensifiez la prospection BOAMP."
    else:
        status = "Critique 🔴"
        advice = "Pipeline très faible. Lancez un scan BOAMP immédiat et assignez des agents sur les AOs détectés."

    return {
        "score": total_score,
        "status": status,
        "advice": advice,
        "breakdown": scores,
        "tenders_total": len(tenders),
        "tenders_go": go_count,
        "opps_active": len([o for o in opps if o.status not in ("Mission gagnée", "NO GO — Écarté", None)]),
    }


def strategic_recommendations(db: Session) -> list[dict]:
    """Top 3 recommandations stratégiques générées par l'IA."""
    from app.services.llm_service import complete

    health = pipeline_health(db)
    win_data = compute_win_rate(db)
    forecast = forecast_revenue(db)

    prompt = f"""En tant que directeur associé d'un cabinet de conseil data, analyse ces KPIs :

Pipeline :
  - Score santé : {health['score']}/100 ({health['status']})
  - Valeur totale : {forecast['total_pipeline_eur']:,}€
  - Revenue confirmé : {forecast['confirmed_revenue_eur']:,}€
  - Taux de conversion : {win_data['win_rate_decided']}%
  - Appels d'offres en Go : {health['tenders_go']}
  - Opportunités actives : {win_data['in_progress']}

Génère exactement 3 recommandations stratégiques CONCRÈTES et ACTIONNABLES pour les 30 prochains jours.
Chaque recommandation doit être spécifique, mesurable et réalisable.

Réponds en JSON strict :
[
  {{"priority": 1, "action": "Action concrète courte", "rationale": "Pourquoi c'est urgent", "impact": "Impact attendu mesuré", "timeline": "Délai"}},
  {{"priority": 2, "action": "...", "rationale": "...", "impact": "...", "timeline": "..."}},
  {{"priority": 3, "action": "...", "rationale": "...", "impact": "...", "timeline": "..."}}
]

UNIQUEMENT le JSON, sans markdown."""

    try:
        raw, _ = complete(prompt, system="Tu es un expert en stratégie commerciale pour cabinets de conseil.", action_type="context_analysis")
        clean = raw.strip().lstrip("```json").rstrip("```").strip()
        recs = json.loads(clean)
        return recs if isinstance(recs, list) else []
    except Exception as e:
        log.warning("Strategic recs LLM failed: %s", e)
        return [
            {"priority": 1, "action": "Lancer un scan BOAMP", "rationale": "Détecter de nouveaux AOs", "impact": "+5 opportunités", "timeline": "Immédiat"},
            {"priority": 2, "action": "Compléter les profils consultants", "rationale": "Améliorer le matching", "impact": "CVs plus pertinents", "timeline": "Cette semaine"},
            {"priority": 3, "action": "Configurer le SMTP email", "rationale": "Recevoir les alertes BOAMP", "impact": "Zéro AO manqué", "timeline": "Aujourd'hui"},
        ]


import json  # noqa: E402 — needed for strategic_recommendations
