"""
LLM Service — Multi-provider AI completion with graceful simulation fallback.

Provider priority: Anthropic → OpenAI → OpenRouter → Mistral → Simulation
Uses synchronous httpx.Client (safe for APScheduler background threads).
Falls back silently to simulation when no API key is configured.
"""

from __future__ import annotations

import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------

_RÉSUMÉ_MARKERS = ["RÉSUMÉ:", "RESUME:", "RÉSUMÉ :", "RESULT:"]
_NEXT_STEP_MARKERS = ["PROCHAINE ÉTAPE:", "PROCHAINE ETAPE:", "NEXT_STEP:", "NEXT STEP:"]


def _parse_structured_response(text: str) -> tuple[str, str | None]:
    """Extract (result_summary, next_step) from a structured LLM response."""
    result = ""
    next_step = None

    for marker in _RÉSUMÉ_MARKERS:
        if marker in text:
            after = text.split(marker, 1)[1].strip()
            for ns_marker in _NEXT_STEP_MARKERS:
                if ns_marker in after:
                    parts = after.split(ns_marker, 1)
                    result = parts[0].strip()
                    next_step = parts[1].strip()
                    return result, next_step
            result = after.strip()
            return result, None

    # No markers found — return raw text as result
    return text.strip(), None


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

def _call_anthropic(system: str, prompt: str, settings) -> str:
    with httpx.Client(timeout=settings.llm_timeout_seconds) as client:
        response = client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-3-5-haiku-20241022",
                "max_tokens": settings.llm_max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["content"][0]["text"]


def _call_openai(system: str, prompt: str, settings) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    with httpx.Client(timeout=settings.llm_timeout_seconds) as client:
        response = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "content-type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "max_tokens": settings.llm_max_tokens,
                "messages": messages,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def _call_openrouter(system: str, prompt: str, settings) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    with httpx.Client(timeout=settings.llm_timeout_seconds) as client:
        response = client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "content-type": "application/json",
            },
            json={
                "model": "mistralai/mistral-7b-instruct",
                "max_tokens": settings.llm_max_tokens,
                "messages": messages,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def _call_mistral(system: str, prompt: str, settings) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    with httpx.Client(timeout=settings.llm_timeout_seconds) as client:
        response = client.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.mistral_api_key}",
                "content-type": "application/json",
            },
            json={
                "model": "mistral-small-latest",
                "max_tokens": settings.llm_max_tokens,
                "messages": messages,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Simulation fallback (no API key needed)
# ---------------------------------------------------------------------------

_SIMULATION: dict[str, tuple[str, str]] = {
    "context_analysis": (
        "Contexte analysé. Enjeux identifiés : transformation data, gouvernance, performance décisionnelle. "
        "Parties prenantes clés cartographiées. Contraintes budgétaires et délais à confirmer. "
        "Données manquantes : accès aux systèmes sources et validation du périmètre fonctionnel.",
        "Compléter les informations manquantes dans l'opportunité ou l'appel d'offres et planifier la réunion de cadrage.",
    ),
    "tender_requirements_review": (
        "Exigences AO analysées. Exigences obligatoires identifiées : architecture data, gouvernance, tableaux de bord. "
        "Risques de non-conformité détectés sur les délais de transfert de compétences. "
        "Axes de différenciation : expertise Afrique, approche Lakehouse, gouvernance humaine des livrables.",
        "Construire la matrice de conformité et valider la décision Go/No-Go avec le responsable.",
    ),
    "deliverable_plan": (
        "Plan de livrable structuré. Sections identifiées : compréhension du besoin, approche méthodologique, "
        "équipe mobilisée, références, gestion des risques, assurance qualité. "
        "Points de validation définis à chaque jalon. Reviewer humain requis avant transmission client.",
        "Faire valider le plan par le reviewer humain avant production du livrable final.",
    ),
    "compliance_matrix": (
        "Matrice de conformité construite. Taux de conformité initial estimé à 85%. "
        "3 exigences partiellement couvertes nécessitent un complément documentaire. "
        "1 exigence à risque identifiée sur les délais de mise en production.",
        "Compléter les preuves manquantes et soumettre la matrice au reviewer avant dépôt de l'offre.",
    ),
    "commercial_proposal": (
        "Proposition commerciale structurée. Budget estimé : 45 000 € HT sur 3 mois. "
        "Équipe proposée : 1 Lead Architect + 1 Data Engineer Senior + coordination projet. "
        "Jalons de facturation définis sur avancement validé.",
        "Personnaliser les références et ajuster le budget selon les contraintes client avant envoi.",
    ),
}

_DEFAULT_SIMULATION = (
    "Action exécutée en mode autonome. Résultats consolidés et prêts pour validation humaine.",
    "Vérifier le résultat et valider avant toute action client.",
)


def _simulate(action_type: str) -> tuple[str, str]:
    return _SIMULATION.get(action_type, _DEFAULT_SIMULATION)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def complete(
    prompt: str,
    system: str = "",
    action_type: str = "",
) -> tuple[str, str | None]:
    """
    Complete a prompt using the best available LLM provider.
    Returns (result_summary, next_step).

    Falls back to simulation when no provider key is configured or all calls fail.
    """
    settings = get_settings()

    providers = []
    if settings.anthropic_api_key:
        providers.append(("Anthropic", lambda: _call_anthropic(system, prompt, settings)))
    if settings.openai_api_key:
        providers.append(("OpenAI", lambda: _call_openai(system, prompt, settings)))
    if settings.openrouter_api_key:
        providers.append(("OpenRouter", lambda: _call_openrouter(system, prompt, settings)))
    if settings.mistral_api_key:
        providers.append(("Mistral", lambda: _call_mistral(system, prompt, settings)))

    for name, call in providers:
        try:
            raw = call()
            result, next_step = _parse_structured_response(raw)
            logger.info("LLM [%s] succeeded — %d chars", name, len(result))
            return result, next_step
        except (httpx.TimeoutException, httpx.HTTPStatusError, KeyError, json.JSONDecodeError) as exc:
            logger.warning("LLM [%s] failed: %s — trying next provider", name, exc)
            continue

    # All providers failed or none configured — use simulation
    logger.info("LLM fallback to simulation for action_type=%r", action_type)
    return _simulate(action_type)


def provider_label() -> str:
    """Return the active provider label for logging/display."""
    settings = get_settings()
    if settings.anthropic_api_key:
        return "anthropic/claude-3-5-haiku"
    if settings.openai_api_key:
        return "openai/gpt-4o-mini"
    if settings.openrouter_api_key:
        return "openrouter/mistral-7b"
    if settings.mistral_api_key:
        return "mistral/small"
    return "simulation"
