"""
Calculateur de rentabilité — endpoint REST.

GET  /calculator/presets       — tarifs de référence par rôle (no auth)
POST /calculator/simulate      — simulation financière complète
POST /calculator/scenarios     — comparer 2-3 scenarios (missions différentes)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user

router = APIRouter(prefix="/calculator", tags=["calculator"])


# ── Reference data ────────────────────────────────────────────────────────────

ROLE_PRESETS = {
    "data_engineer_junior":    {"label": "Data Engineer Junior",    "tjm_min": 350, "tjm_max": 500,  "days_typical": 100},
    "data_engineer_senior":    {"label": "Data Engineer Senior",    "tjm_min": 550, "tjm_max": 800,  "days_typical": 120},
    "data_architect":          {"label": "Data Architect",          "tjm_min": 650, "tjm_max": 950,  "days_typical": 110},
    "data_analyst":            {"label": "Data Analyst",            "tjm_min": 300, "tjm_max": 500,  "days_typical": 100},
    "bi_developer":            {"label": "Développeur BI",          "tjm_min": 350, "tjm_max": 550,  "days_typical": 100},
    "ml_engineer":             {"label": "ML Engineer",             "tjm_min": 500, "tjm_max": 850,  "days_typical": 100},
    "tech_lead_data":          {"label": "Tech Lead Data",          "tjm_min": 700, "tjm_max": 1000, "days_typical": 120},
    "cto_freelance":           {"label": "CTO / DSI Freelance",     "tjm_min": 900, "tjm_max": 1500, "days_typical": 80},
}

PORTAGE_RATES = {
    "itg":        {"label": "ITG",        "rate_pct": 8.5},
    "embarq":     {"label": "Embarq",     "rate_pct": 7.5},
    "freelance":  {"label": "Freelance direct", "rate_pct": 0},
    "sasu":       {"label": "SASU / EURL",      "rate_pct": 0},
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class SimulationInput(BaseModel):
    # Revenue inputs
    tjm_ht: float = Field(..., gt=0, description="Taux journalier moyen HT (€)")
    days_billed: int = Field(..., ge=1, le=365, description="Jours facturés / an")

    # Cost inputs
    portage_pct: float = Field(0.0, ge=0, le=30, description="% frais portage ou charges SASU")
    overhead_monthly: float = Field(200.0, ge=0, description="Frais fixes / mois (outils, déplacements…)")
    non_billed_days: int = Field(30, ge=0, le=365, description="Jours non facturés (congés, prospection…)")

    # Context
    vat_regime: str = Field("normal", description="normal | franchise")
    include_cfe: bool = Field(True, description="Inclure la CFE (~600€/an)")
    include_mutuelle: bool = Field(True, description="Inclure mutuelle (~150€/mois)")


class ScenarioInput(BaseModel):
    label: str
    simulation: SimulationInput


class ScenariosRequest(BaseModel):
    scenarios: list[ScenarioInput] = Field(..., min_length=2, max_length=4)


# ── Calculation logic ─────────────────────────────────────────────────────────

def _simulate(inp: SimulationInput) -> dict:
    # Revenue
    gross_revenue = inp.tjm_ht * inp.days_billed

    # Deductions
    portage_fee      = gross_revenue * (inp.portage_pct / 100)
    net_after_portage = gross_revenue - portage_fee
    overhead_annual  = inp.overhead_monthly * 12
    cfe              = 600 if inp.include_cfe else 0
    mutuelle         = 1800 if inp.include_mutuelle else 0   # 150 × 12

    total_costs = portage_fee + overhead_annual + cfe + mutuelle
    net_income  = gross_revenue - total_costs

    # Daily and monthly equivalents
    total_days       = inp.days_billed + inp.non_billed_days
    working_days_yr  = 218   # French standard
    effective_rate   = (inp.days_billed / working_days_yr) * 100

    daily_net        = net_income / inp.days_billed if inp.days_billed > 0 else 0
    monthly_net      = net_income / 12

    # Breakeven: minimum days needed to cover costs
    breakeven_days   = int(total_costs / inp.tjm_ht) + 1 if inp.tjm_ht > 0 else 0

    # VAT note (informational)
    vat_collected    = gross_revenue * 0.20 if inp.vat_regime == "normal" else 0

    return {
        "revenue": {
            "gross_ht":         round(gross_revenue, 2),
            "vat_collected":    round(vat_collected, 2),
            "after_portage":    round(net_after_portage, 2),
        },
        "costs": {
            "portage_fee":      round(portage_fee, 2),
            "overhead_annual":  round(overhead_annual, 2),
            "cfe":              cfe,
            "mutuelle":         mutuelle,
            "total":            round(total_costs, 2),
        },
        "net": {
            "annual":           round(net_income, 2),
            "monthly_avg":      round(monthly_net, 2),
            "daily_equivalent": round(daily_net, 2),
        },
        "metrics": {
            "occupancy_rate_pct":   round(effective_rate, 1),
            "breakeven_days":       breakeven_days,
            "days_billed":          inp.days_billed,
            "non_billed_days":      inp.non_billed_days,
            "cost_ratio_pct":       round(total_costs / gross_revenue * 100, 1) if gross_revenue > 0 else 0,
        },
        "alerts": _build_alerts(inp, net_income, breakeven_days, effective_rate),
    }


def _build_alerts(inp: SimulationInput, net: float, breakeven: int, occupancy: float) -> list[dict]:
    alerts = []
    if occupancy < 60:
        alerts.append({"level": "warning", "message": f"Taux d'occupation faible ({occupancy:.0f}%). Objectif minimum : 70%."})
    if net < 30000:
        alerts.append({"level": "danger", "message": "Revenu net annuel inférieur à 30 000 €. Revoir le TJM ou réduire les charges."})
    if inp.overhead_monthly > 800:
        alerts.append({"level": "warning", "message": f"Frais fixes élevés ({inp.overhead_monthly} €/mois). Piste d'optimisation."})
    if breakeven > 100 and inp.days_billed < breakeven + 20:
        alerts.append({"level": "info", "message": f"Seuil de rentabilité atteint à {breakeven} jours facturés."})
    if net > 100000:
        alerts.append({"level": "success", "message": "Excellent niveau de rentabilité. Pensez à optimiser votre structure fiscale."})
    return alerts


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/presets")
def get_presets():
    """Reference TJM presets by role and portage company rates. Cached 1h."""
    from app.core.cache import cache, PRESETS_TTL
    cached = cache.get("calculator:presets")
    if cached is not None:
        return cached
    result = {
        "roles":   ROLE_PRESETS,
        "portage": PORTAGE_RATES,
        "context": {
            "working_days_year":  218,
            "typical_overhead":   200,
            "typical_non_billed": 30,
            "vat_rate":           0.20,
        },
    }
    cache.set("calculator:presets", result, ttl=PRESETS_TTL)
    return result


@router.post("/simulate", dependencies=[Depends(get_current_user)])
def simulate(inp: SimulationInput):
    """Run a complete profitability simulation."""
    result = _simulate(inp)
    result["input"] = inp.model_dump()
    return result


@router.post("/scenarios", dependencies=[Depends(get_current_user)])
def compare_scenarios(req: ScenariosRequest):
    """Compare multiple mission scenarios side by side."""
    results = []
    for sc in req.scenarios:
        sim = _simulate(sc.simulation)
        sim["label"] = sc.label
        sim["input"] = sc.simulation.model_dump()
        results.append(sim)

    # Rank by annual net
    ranked = sorted(results, key=lambda x: x["net"]["annual"], reverse=True)
    for i, r in enumerate(ranked):
        r["rank"] = i + 1
        r["is_best"] = i == 0

    return {"scenarios": ranked, "count": len(ranked)}
