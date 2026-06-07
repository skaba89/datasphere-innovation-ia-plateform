from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Iterable


STRATEGIC_KEYWORDS = {
    "data": 8,
    "analytics": 8,
    "bi": 7,
    "ia": 8,
    "intelligence artificielle": 8,
    "digital": 6,
    "numérique": 6,
    "cloud": 7,
    "gouvernance": 6,
    "sécurité": 5,
    "cybersécurité": 7,
    "dashboard": 5,
    "entrepôt": 6,
    "pipeline": 6,
    "rag": 7,
    "documentaire": 4,
}

RISK_KEYWORDS = {
    "urgent": -8,
    "délai court": -10,
    "maintenance 5 ans": -5,
    "garantie bancaire": -7,
    "très faible budget": -8,
    "international obligatoire": -4,
}

REFERENCE_KEYWORDS = {
    "banque": 7,
    "institution": 6,
    "ministère": 5,
    "administration": 5,
    "publique": 4,
    "gouvernement": 5,
}


@dataclass(frozen=True)
class ScoreBreakdown:
    technical_fit: int
    strategic_fit: int
    commercial_fit: int
    delivery_risk: int
    reference_fit: int
    global_score: int
    recommendation: str
    rationale: list[str]


def _clamp(value: int) -> int:
    return max(0, min(value, 100))


def _contains_any(text: str, keywords: Iterable[str]) -> bool:
    text_lower = text.lower()
    return any(keyword.lower() in text_lower for keyword in keywords)


def _keyword_score(text: str, weighted_keywords: dict[str, int], base: int = 45) -> int:
    text_lower = text.lower()
    score = base
    for keyword, weight in weighted_keywords.items():
        if keyword in text_lower:
            score += weight
    return _clamp(score)


def score_tender_candidate(
    *,
    title: str,
    sector: str,
    summary: str,
    buyer_name: str,
    country: str,
    estimated_value: float | int | None = None,
) -> dict:
    """Score an opportunity using deterministic business rules.

    This is intentionally explainable and does not require an LLM. An LLM can later
    enrich the rationale while preserving the same response contract.
    """
    text = " ".join([title, sector, summary, buyer_name, country])
    estimated = float(estimated_value or 0)

    technical_fit = _keyword_score(text, STRATEGIC_KEYWORDS, base=42)
    strategic_fit = _keyword_score(text, {"guinée": 8, "banque": 7, "public": 6, "institution": 5, "data": 6, "ia": 6}, base=45)
    commercial_fit = _clamp(48 + min(int(estimated / 100000) * 4, 24))
    reference_fit = _keyword_score(text, REFERENCE_KEYWORDS, base=43)

    risk_penalty = abs(min(_keyword_score(text, RISK_KEYWORDS, base=0), 0))
    delivery_risk = _clamp(72 - risk_penalty)

    global_score = round(
        technical_fit * 0.30
        + strategic_fit * 0.25
        + commercial_fit * 0.20
        + delivery_risk * 0.15
        + reference_fit * 0.10
    )

    if global_score >= 75:
        recommendation = "GO"
    elif global_score >= 55:
        recommendation = "TO_QUALIFY"
    else:
        recommendation = "NO_GO"

    rationale: list[str] = []
    if technical_fit >= 70:
        rationale.append("Bonne adéquation avec les expertises Data/IA/Cloud de DataSphere.")
    if strategic_fit >= 70:
        rationale.append("Opportunité stratégique alignée avec les secteurs prioritaires et le marché guinéen.")
    if commercial_fit >= 70:
        rationale.append("Potentiel commercial significatif au regard de la valeur estimée.")
    if delivery_risk < 55:
        rationale.append("Risque de delivery à analyser avant engagement ferme.")
    if reference_fit >= 65:
        rationale.append("Références institutionnelles ou publiques potentiellement valorisables.")
    if not rationale:
        rationale.append("Opportunité à qualifier manuellement avant décision Go/No-Go.")

    return asdict(
        ScoreBreakdown(
            technical_fit=technical_fit,
            strategic_fit=strategic_fit,
            commercial_fit=commercial_fit,
            delivery_risk=delivery_risk,
            reference_fit=reference_fit,
            global_score=global_score,
            recommendation=recommendation,
            rationale=rationale,
        )
    )
