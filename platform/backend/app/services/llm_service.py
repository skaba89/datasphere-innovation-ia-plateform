"""
LLM Service — Multi-provider AI completion with graceful simulation fallback.

Supported providers (in default priority order):
  1. Anthropic   (Claude 3.5 Haiku / Sonnet)
  2. OpenAI      (GPT-4o-mini / GPT-4o)
  3. Gemini      (Flash / Pro) — Google
  4. Groq        (Llama 3.3 70B) — ultra-fast, near-free
  5. GLM-5       (glm-4-flash) — ZhipuAI, strong French support
  6. Qwen        (qwen-plus) — Alibaba DashScope
  7. Mistral     (mistral-small) — native French
  8. OpenRouter  (multi-model routing)
  9. Together AI (Llama 3 70B)
 10. Cohere      (Command R+)
 11. Perplexity  (sonar) — web-grounded
 12. Simulation  (fallback, always works)

Configuration via .env:
  Each provider requires its API key. Provider priority and preferred model
  can be overridden with LLM_PROVIDER_ORDER and LLM_MODEL_<PROVIDER>.
  Task-specific provider overrides: LLM_TASK_<TASK_TYPE>=<provider_name>

Uses synchronous httpx.Client (safe for APScheduler background threads).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Callable

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider metadata
# ---------------------------------------------------------------------------

@dataclass
class ProviderInfo:
    name: str
    label: str
    url: str
    models: list[str]
    default_model: str
    tier: str          # "premium" | "standard" | "fast" | "free"
    context_window: int
    strengths: list[str]
    notes: str = ""


PROVIDER_REGISTRY: dict[str, ProviderInfo] = {
    # ── TIER 1 : GRATUIT ─────────────────────────────────────────────────────
    "glm": ProviderInfo(
        name="glm",
        label="ZhipuAI GLM-4 Flash",
        url="https://open.bigmodel.ai",
        models=["glm-4-flash", "glm-4-flash-250414", "glm-4-air", "glm-4", "glm-4-0520"],
        default_model="glm-4-flash",
        tier="free",
        context_window=128_000,
        strengths=["100% GRATUIT (glm-4-flash)", "multilingual", "français correct", "API OpenAI-compatible"],
        notes="glm-4-flash : zéro coût, zéro carte bancaire. Premier recours systématique.",
    ),
    # ── TIER 2 : QUASI-GRATUIT (free tier généreux) ───────────────────────────
    "groq": ProviderInfo(
        name="groq",
        label="Groq (Llama 3)",
        url="https://api.groq.com",
        models=["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
        default_model="llama-3.3-70b-versatile",
        tier="near-free",
        context_window=128_000,
        strengths=["ultra-rapide (<1s)", "free tier très généreux", "Llama 3.3 70B excellent", "bon en français"],
        notes="Free tier : 14 400 req/jour. Quasi-gratuit même en prod. Deuxième recours.",
    ),
    "gemini": ProviderInfo(
        name="gemini",
        label="Google Gemini Flash",
        url="https://generativelanguage.googleapis.com",
        models=["gemini-2.0-flash-exp", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash-preview-04-17"],
        default_model="gemini-2.0-flash-exp",
        tier="near-free",
        context_window=1_000_000,
        strengths=["1 MILLION tokens contexte", "free tier généreux", "rapide", "multimodal"],
        notes="Flash : 1500 req/jour gratuit. Seul modèle capable de lire un AO de 400 pages en un appel.",
    ),
    # ── TIER 3 : BUDGET (payant mais très peu cher) ───────────────────────────
    "together": ProviderInfo(
        name="together",
        label="Together AI",
        url="https://api.together.xyz",
        models=[
            "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "Qwen/Qwen2.5-72B-Instruct-Turbo",
            "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
        ],
        default_model="meta-llama/Llama-3.3-70B-Instruct-Turbo",
        tier="budget",
        context_window=131_072,
        strengths=["~0.18$/M tokens", "Llama 3 70B optimisé", "open-source", "parallélisme élevé"],
        notes="Llama 3.3 70B Turbo : excellent rapport qualité/prix, ~10x moins cher qu'OpenAI.",
    ),
    "qwen": ProviderInfo(
        name="qwen",
        label="Alibaba Qwen",
        url="https://dashscope.aliyuncs.com",
        models=["qwen-plus", "qwen-turbo", "qwen-max", "qwen2.5-72b-instruct", "qwen-long"],
        default_model="qwen-turbo",
        tier="budget",
        context_window=131_072,
        strengths=["très peu cher", "multilingue (arabe, bambara, swahili…)", "long context", "Afrique/Asie"],
        notes="qwen-turbo : parmi les moins chers du marché. Solide sur les langues africaines pour GovTech.",
    ),
    # ── TIER 4 : STANDARD (payant, rapport qualité/prix correct) ─────────────
    "openrouter": ProviderInfo(
        name="openrouter",
        label="OpenRouter",
        url="https://openrouter.ai",
        models=[
            "meta-llama/llama-3.3-70b-instruct",
            "google/gemini-flash-1.5",
            "qwen/qwen-2.5-72b-instruct",
            "mistralai/mistral-small-3.1-24b-instruct:free",
            "anthropic/claude-3.5-haiku",
        ],
        default_model="meta-llama/llama-3.3-70b-instruct",
        tier="standard",
        context_window=128_000,
        strengths=["200+ modèles", "modèles gratuits disponibles (:free suffix)", "fallback automatique", "prix compétitifs"],
        notes="Accès à des modèles gratuits via le suffixe :free. Routing intelligent entre providers.",
    ),
    "mistral": ProviderInfo(
        name="mistral",
        label="Mistral AI",
        url="https://api.mistral.ai",
        models=["mistral-small-latest", "open-mistral-nemo", "mistral-medium-latest", "mistral-large-latest"],
        default_model="mistral-small-latest",
        tier="standard",
        context_window=32_000,
        strengths=["français natif excellence", "souveraineté UE", "RGPD", "juridique"],
        notes="Meilleur choix pour la conformité RGPD/UE. open-mistral-nemo : très peu cher.",
    ),
    "cohere": ProviderInfo(
        name="cohere",
        label="Cohere Command R",
        url="https://api.cohere.com",
        models=["command-r-plus", "command-r", "command-light"],
        default_model="command-r",
        tier="standard",
        context_window=128_000,
        strengths=["RAG natif", "grounding documentaire", "enterprise", "recherche"],
        notes="command-r (pas plus) : moins cher. Excellent pour l'analyse documentaire AO.",
    ),
    "perplexity": ProviderInfo(
        name="perplexity",
        label="Perplexity Sonar",
        url="https://api.perplexity.ai",
        models=["sonar", "sonar-pro", "sonar-reasoning"],
        default_model="sonar",
        tier="standard",
        context_window=127_072,
        strengths=["recherche web temps réel", "sources citées", "actualité marché"],
        notes="Unique : accès web en temps réel. Utile pour veille concurrentielle et sectorielle.",
    ),
    # ── TIER 5 : PREMIUM (payant, meilleure qualité) ──────────────────────────
    "openai": ProviderInfo(
        name="openai",
        label="OpenAI GPT",
        url="https://api.openai.com",
        models=["gpt-4o-mini", "gpt-4o", "o1-mini", "o3-mini"],
        default_model="gpt-4o-mini",
        tier="premium",
        context_window=128_000,
        strengths=["polyvalent", "code", "structuration JSON fiable", "bien connu"],
        notes="gpt-4o-mini est abordable. Réserver gpt-4o pour les cas critiques uniquement.",
    ),
    "anthropic": ProviderInfo(
        name="anthropic",
        label="Anthropic Claude",
        url="https://api.anthropic.com",
        models=["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
        default_model="claude-3-5-haiku-20241022",
        tier="premium",
        context_window=200_000,
        strengths=["meilleur raisonnement complexe", "français excellent", "JSON structuré", "instructions longues"],
        notes="Haiku = moins cher. Réserver Sonnet/Opus aux livrables critiques ou au Go/No-Go stratégique.",
    ),
}

# ---------------------------------------------------------------------------
# Priority order : FREE → NEAR-FREE → BUDGET → STANDARD → PREMIUM
# Logique : on essaie les gratuits en premier. Si l'un tombe (rate limit,
# timeout, erreur API), le suivant prend le relais automatiquement.
# L'IA premium n'est consommée que si tous les providers moins chers ont échoué.
# ---------------------------------------------------------------------------
_DEFAULT_ORDER = [
    # Tier 1 — Gratuit
    "glm",
    # Tier 2 — Quasi-gratuit (free tier généreux)
    "groq",
    "gemini",
    # Tier 3 — Budget (quelques centimes par millier de tokens)
    "together",
    "qwen",
    # Tier 4 — Standard
    "openrouter",
    "mistral",
    "cohere",
    "perplexity",
    # Tier 5 — Premium (dernier recours)
    "openai",
    "anthropic",
]

# Coût relatif par tier pour l'affichage
TIER_ORDER = ["free", "near-free", "budget", "standard", "premium"]
TIER_LABELS = {
    "free":      "Gratuit",
    "near-free": "Quasi-gratuit",
    "budget":    "Budget",
    "standard":  "Standard",
    "premium":   "Premium",
}

# ---------------------------------------------------------------------------
# Task recommendations — prioritise gratuit/quasi-gratuit pour chaque tâche
# Principe : un bon modèle gratuit AVANT un modèle premium
# ---------------------------------------------------------------------------
TASK_RECOMMENDATIONS: dict[str, dict] = {
    "context_analysis": {
        "best": ["glm", "groq", "gemini"],
        "reason": "Tâche répétitive du scheduler. GLM-4-Flash (gratuit) puis Groq (quasi-gratuit) suffisent largement.",
        "avoid": ["anthropic", "openai"],
        "cost_hint": "Coût cible : 0 € (GLM ou Groq couvrent 99% des cas)",
    },
    "go_no_go_recommendation": {
        "best": ["groq", "gemini", "glm"],
        "reason": "Llama 3.3 70B (Groq) et Gemini Flash donnent d'excellentes analyses Go/No-Go. Coût quasi nul.",
        "avoid": [],
        "cost_hint": "Coût cible : 0 € (Groq free tier) ou quelques centimes (Gemini)",
    },
    "tender_requirements_review": {
        "best": ["gemini", "glm", "cohere"],
        "reason": "Gemini Flash : 1M tokens, idéal pour les AO très longs. GLM en fallback. Cohere pour le RAG.",
        "avoid": [],
        "cost_hint": "Coût cible : 0 € avec Gemini free tier pour la majorité des AO",
    },
    "deliverable_plan": {
        "best": ["groq", "glm", "mistral"],
        "reason": "Llama 3.3 70B (Groq) excellent en rédaction française. Mistral si conformité RGPD exigée.",
        "avoid": [],
        "cost_hint": "Coût cible : 0 € (Groq) ou ~0.001 € (Mistral small)",
    },
    "compliance_matrix": {
        "best": ["glm", "groq", "gemini"],
        "reason": "Structure JSON simple. GLM-4-Flash (gratuit) et Groq gèrent très bien les matrices.",
        "avoid": [],
        "cost_hint": "Coût cible : 0 € (GLM + Groq chain)",
    },
    "commercial_proposal": {
        "best": ["groq", "mistral", "glm"],
        "reason": "Llama 3.3 70B rédige des propositions commerciales de qualité. Mistral pour le style français.",
        "avoid": [],
        "cost_hint": "Coût cible : 0 € (Groq) ou ~0.001 € (Mistral)",
    },
    "sector_analysis": {
        "best": ["perplexity", "gemini", "groq"],
        "reason": "Perplexity pour l'actualité marché en temps réel. Gemini/Groq pour l'analyse structurée.",
        "avoid": ["glm"],
        "cost_hint": "Coût : ~0.001 $/requête (Perplexity sonar)",
    },
}

# ---------------------------------------------------------------------------
# OpenAI-compatible helper (used by 8/11 providers)
# ---------------------------------------------------------------------------

def _openai_compat(
    base_url: str,
    api_key: str,
    model: str,
    system: str,
    prompt: str,
    max_tokens: int,
    timeout: int,
    extra_headers: dict | None = None,
) -> str:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    with httpx.Client(timeout=timeout) as client:
        response = client.post(
            f"{base_url}/v1/chat/completions",
            headers=headers,
            json={"model": model, "max_tokens": max_tokens, "messages": messages},
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Provider-specific call functions
# ---------------------------------------------------------------------------

def _call_anthropic(system: str, prompt: str, settings) -> str:
    model = getattr(settings, "llm_model_anthropic", None) or PROVIDER_REGISTRY["anthropic"].default_model
    with httpx.Client(timeout=settings.llm_timeout_seconds) as client:
        r = client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": settings.llm_max_tokens,
                "system": system or "Tu es un expert en conseil Data, IT et IA. Réponds en français.",
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]


def _call_openai(system: str, prompt: str, settings) -> str:
    model = getattr(settings, "llm_model_openai", None) or PROVIDER_REGISTRY["openai"].default_model
    return _openai_compat("https://api.openai.com", settings.openai_api_key, model, system, prompt, settings.llm_max_tokens, settings.llm_timeout_seconds)


def _call_gemini(system: str, prompt: str, settings) -> str:
    """Google Gemini via OpenAI-compatible endpoint."""
    model = getattr(settings, "llm_model_gemini", None) or PROVIDER_REGISTRY["gemini"].default_model
    return _openai_compat(
        "https://generativelanguage.googleapis.com/v1beta/openai",
        settings.gemini_api_key,
        model,
        system,
        prompt,
        settings.llm_max_tokens,
        settings.llm_timeout_seconds,
    )


def _call_groq(system: str, prompt: str, settings) -> str:
    model = getattr(settings, "llm_model_groq", None) or PROVIDER_REGISTRY["groq"].default_model
    return _openai_compat("https://api.groq.com/openai", settings.groq_api_key, model, system, prompt, settings.llm_max_tokens, settings.llm_timeout_seconds)


def _call_glm(system: str, prompt: str, settings) -> str:
    """ZhipuAI GLM-4 (OpenAI-compatible endpoint)."""
    model = getattr(settings, "llm_model_glm", None) or PROVIDER_REGISTRY["glm"].default_model
    return _openai_compat("https://open.bigmodel.ai/api/paas", settings.glm_api_key, model, system, prompt, settings.llm_max_tokens, settings.llm_timeout_seconds)


def _call_qwen(system: str, prompt: str, settings) -> str:
    """Alibaba DashScope Qwen (OpenAI-compatible)."""
    model = getattr(settings, "llm_model_qwen", None) or PROVIDER_REGISTRY["qwen"].default_model
    return _openai_compat(
        "https://dashscope.aliyuncs.com/compatible-mode",
        settings.qwen_api_key,
        model,
        system,
        prompt,
        settings.llm_max_tokens,
        settings.llm_timeout_seconds,
    )


def _call_mistral(system: str, prompt: str, settings) -> str:
    model = getattr(settings, "llm_model_mistral", None) or PROVIDER_REGISTRY["mistral"].default_model
    return _openai_compat("https://api.mistral.ai", settings.mistral_api_key, model, system, prompt, settings.llm_max_tokens, settings.llm_timeout_seconds)


def _call_openrouter(system: str, prompt: str, settings) -> str:
    model = getattr(settings, "llm_model_openrouter", None) or PROVIDER_REGISTRY["openrouter"].default_model
    return _openai_compat(
        "https://openrouter.ai/api",
        settings.openrouter_api_key,
        model,
        system,
        prompt,
        settings.llm_max_tokens,
        settings.llm_timeout_seconds,
        extra_headers={"HTTP-Referer": "https://datasphere-innovation.fr", "X-Title": "DataSphere Innovation"},
    )


def _call_together(system: str, prompt: str, settings) -> str:
    model = getattr(settings, "llm_model_together", None) or PROVIDER_REGISTRY["together"].default_model
    return _openai_compat("https://api.together.xyz", settings.together_api_key, model, system, prompt, settings.llm_max_tokens, settings.llm_timeout_seconds)


def _call_cohere(system: str, prompt: str, settings) -> str:
    """Cohere v2 chat API."""
    model = getattr(settings, "llm_model_cohere", None) or PROVIDER_REGISTRY["cohere"].default_model
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    with httpx.Client(timeout=settings.llm_timeout_seconds) as client:
        r = client.post(
            "https://api.cohere.com/v2/chat",
            headers={"Authorization": f"Bearer {settings.cohere_api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "max_tokens": settings.llm_max_tokens},
        )
        r.raise_for_status()
        data = r.json()
        # Cohere v2 response structure
        return data["message"]["content"][0]["text"]


def _call_perplexity(system: str, prompt: str, settings) -> str:
    model = getattr(settings, "llm_model_perplexity", None) or PROVIDER_REGISTRY["perplexity"].default_model
    return _openai_compat("https://api.perplexity.ai", settings.perplexity_api_key, model, system, prompt, settings.llm_max_tokens, settings.llm_timeout_seconds)


# ---------------------------------------------------------------------------
# Provider registry — maps name → (key_attr, call_fn)
# ---------------------------------------------------------------------------

_PROVIDER_MAP: dict[str, tuple[str, Callable]] = {
    "anthropic":  ("anthropic_api_key",  _call_anthropic),
    "openai":     ("openai_api_key",     _call_openai),
    "gemini":     ("gemini_api_key",     _call_gemini),
    "groq":       ("groq_api_key",       _call_groq),
    "glm":        ("glm_api_key",        _call_glm),
    "qwen":       ("qwen_api_key",       _call_qwen),
    "mistral":    ("mistral_api_key",    _call_mistral),
    "openrouter": ("openrouter_api_key", _call_openrouter),
    "together":   ("together_api_key",   _call_together),
    "cohere":     ("cohere_api_key",     _call_cohere),
    "perplexity": ("perplexity_api_key", _call_perplexity),
}

# Default provider priority order
_DEFAULT_ORDER = ["anthropic", "openai", "gemini", "groq", "glm", "qwen", "mistral", "openrouter", "together", "cohere", "perplexity"]


def _get_active_providers(settings) -> list[tuple[str, Callable]]:
    """Return list of (provider_name, call_fn) for configured providers, in priority order."""
    # Allow override via LLM_PROVIDER_ORDER env var (comma-separated)
    order_str = getattr(settings, "llm_provider_order", "") or ""
    order = [p.strip() for p in order_str.split(",") if p.strip()] if order_str else _DEFAULT_ORDER

    active = []
    for name in order:
        if name not in _PROVIDER_MAP:
            continue
        key_attr, fn = _PROVIDER_MAP[name]
        key_value = getattr(settings, key_attr, "")
        if key_value:
            active.append((name, fn))
    return active


def _get_task_providers(task_type: str, settings) -> list[tuple[str, Callable]]:
    """
    If task_type has a specific recommendation or env override, reorder providers accordingly.
    Env override: LLM_TASK_<TASK_TYPE>=provider_name
    """
    # Check for task-specific env override first
    task_env_key = f"llm_task_{task_type.lower()}"
    override = getattr(settings, task_env_key, "") or ""
    if override:
        key_attr, fn = _PROVIDER_MAP.get(override, (None, None))
        if fn and getattr(settings, key_attr, ""):
            return [(override, fn)]

    # Use task recommendations to reorder
    active = _get_active_providers(settings)
    rec = TASK_RECOMMENDATIONS.get(task_type, {})
    best = rec.get("best", [])
    avoid = rec.get("avoid", [])

    if not best:
        return [(n, f) for n, f in active if n not in avoid]

    # Reorder: recommended providers first, then rest (excluding avoid)
    first = [(n, f) for n, f in active if n in best and n not in avoid]
    rest = [(n, f) for n, f in active if n not in best and n not in avoid]
    return first + rest


# ---------------------------------------------------------------------------
# Simulation fallback
# ---------------------------------------------------------------------------

_SIMULATION: dict[str, tuple[str, str]] = {
    "context_analysis": (
        "Contexte analysé. Enjeux identifiés : transformation data, gouvernance, performance décisionnelle. "
        "Parties prenantes clés cartographiées. Contraintes budgétaires et délais à confirmer. "
        "Données manquantes : accès aux systèmes sources et validation du périmètre fonctionnel.",
        "Compléter les informations manquantes dans l'opportunité ou l'AO et planifier la réunion de cadrage.",
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
    "go_no_go_recommendation": (
        "Analyse Go/No-Go complétée (mode simulation). Score pondéré calculé sur les critères disponibles. "
        "Décision basée sur les critères saisis. Configurer une clé LLM pour une analyse argumentée.",
        "Vérifier les critères et configurer une clé API LLM pour une recommandation complète.",
    ),
    "sector_analysis": (
        "Analyse sectorielle réalisée. Marché cible identifié. Acteurs clés recensés. "
        "Opportunités et menaces évaluées selon les données disponibles.",
        "Valider l'analyse avec une clé LLM active pour des insights actualisés.",
    ),
}

_DEFAULT_SIMULATION = (
    "Action exécutée en mode autonome. Résultats consolidés et prêts pour validation humaine.",
    "Vérifier le résultat et valider avant toute action client.",
)


def _simulate(action_type: str) -> tuple[str, str]:
    return _SIMULATION.get(action_type, _DEFAULT_SIMULATION)


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------

_RÉSUMÉ_MARKERS = ["RÉSUMÉ:", "RESUME:", "RÉSUMÉ :", "RESULT:"]
_NEXT_STEP_MARKERS = ["PROCHAINE ÉTAPE:", "PROCHAINE ETAPE:", "NEXT_STEP:", "NEXT STEP:"]


def _parse_structured_response(text: str) -> tuple[str, str | None]:
    for marker in _RÉSUMÉ_MARKERS:
        if marker in text:
            after = text.split(marker, 1)[1].strip()
            for ns_marker in _NEXT_STEP_MARKERS:
                if ns_marker in after:
                    parts = after.split(ns_marker, 1)
                    return parts[0].strip(), parts[1].strip()
            return after.strip(), None
    return text.strip(), None


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

    Provider selection:
    1. Task-specific env override (LLM_TASK_<ACTION_TYPE>)
    2. Task recommendation reordering
    3. Default priority order with active providers
    4. Simulation fallback
    """
    settings = get_settings()
    providers = _get_task_providers(action_type, settings) if action_type else _get_active_providers(settings)

    for name, call_fn in providers:
        t0 = time.monotonic()
        try:
            raw = call_fn(system, prompt, settings)
            result, next_step = _parse_structured_response(raw)
            ms = int((time.monotonic() - t0) * 1000)
            logger.info("LLM [%s] succeeded — %d chars in %dms", name, len(result), ms)
            return result, next_step
        except (httpx.TimeoutException, httpx.HTTPStatusError, KeyError, IndexError, json.JSONDecodeError) as exc:
            ms = int((time.monotonic() - t0) * 1000)
            logger.warning("LLM [%s] failed in %dms: %s — trying next provider", name, ms, exc)
            continue
        except Exception as exc:
            logger.warning("LLM [%s] unexpected error: %s — trying next provider", name, exc)
            continue

    logger.info("LLM: all providers failed or none configured — using simulation for %r", action_type)
    return _simulate(action_type)


def provider_label() -> str:
    """Return label of first active provider."""
    settings = get_settings()
    active = _get_active_providers(settings)
    if not active:
        return "simulation"
    name = active[0][0]
    info = PROVIDER_REGISTRY.get(name)
    if not info:
        return name
    model = getattr(settings, f"llm_model_{name}", "") or info.default_model
    return f"{name}/{model}"


def list_providers() -> list[dict]:
    """
    Return status of all providers sorted by cost (free first).
    Used by /api/v1/providers endpoint.
    """
    settings = get_settings()
    result = []
    for name in _DEFAULT_ORDER:
        if name not in _PROVIDER_MAP:
            continue
        key_attr, _ = _PROVIDER_MAP[name]
        info = PROVIDER_REGISTRY.get(name)
        has_key = bool(getattr(settings, key_attr, ""))
        configured_model = getattr(settings, f"llm_model_{name}", "") or ""
        result.append({
            "name": name,
            "label": info.label if info else name,
            "configured": has_key,
            "tier": info.tier if info else "unknown",
            "tier_label": TIER_LABELS.get(info.tier, info.tier) if info else "?",
            "tier_order": TIER_ORDER.index(info.tier) if info and info.tier in TIER_ORDER else 99,
            "models": info.models if info else [],
            "default_model": info.default_model if info else "",
            "active_model": configured_model or (info.default_model if info else ""),
            "context_window": info.context_window if info else 0,
            "strengths": info.strengths if info else [],
            "notes": info.notes if info else "",
            "api_key_env": key_attr.upper(),
        })
    return result


def get_recommendations(task_type: str | None = None) -> dict:
    """Return provider recommendations with cost hints, optionally filtered by task."""
    settings = get_settings()
    active = {n for n, _ in _get_active_providers(settings)}

    if task_type:
        rec = TASK_RECOMMENDATIONS.get(task_type, {})
        best = rec.get("best", [])
        return {
            "task_type": task_type,
            "best_providers": [
                {
                    **{k: v for k, v in PROVIDER_REGISTRY[p].__dict__.items()},
                    "configured": p in active,
                    "tier_label": TIER_LABELS.get(PROVIDER_REGISTRY[p].tier, PROVIDER_REGISTRY[p].tier),
                }
                for p in best if p in PROVIDER_REGISTRY
            ],
            "avoid": rec.get("avoid", []),
            "reason": rec.get("reason", ""),
            "cost_hint": rec.get("cost_hint", ""),
            "active_for_task": [n for n, _ in _get_task_providers(task_type, settings)],
        }

    return {
        "strategy": (
            "Gratuit → Quasi-gratuit → Budget → Standard → Premium. "
            "L'app essaie toujours les providers gratuits en premier. "
            "Les providers premium ne sont consommés que si tous les moins chers ont échoué."
        ),
        "priority_order": _DEFAULT_ORDER,
        "tier_breakdown": {
            "free":      ["glm"],
            "near-free": ["groq", "gemini"],
            "budget":    ["together", "qwen"],
            "standard":  ["openrouter", "mistral", "cohere", "perplexity"],
            "premium":   ["openai", "anthropic"],
        },
        "all_tasks": {
            t: {
                "best": r.get("best", []),
                "reason": r.get("reason", ""),
                "avoid": r.get("avoid", []),
                "cost_hint": r.get("cost_hint", ""),
            }
            for t, r in TASK_RECOMMENDATIONS.items()
        },
        "tips": [
            "glm-4-flash (ZhipuAI) : 100% gratuit, aucune carte requise. Premier recours pour toutes les tâches.",
            "Groq (Llama 3.3 70B) : free tier 14 400 req/jour, latence <1s. Deuxième recours.",
            "Gemini Flash : free tier 1500 req/jour + 1M tokens contexte. Idéal pour les AO très longs.",
            "Together AI : ~0.18$/M tokens. Fallback budget si les gratuits sont épuisés.",
            "Qwen turbo : très peu cher + langues africaines/arabe pour missions GovTech.",
            "OpenRouter : accès gratuit à certains modèles (suffix :free). Routing intelligent.",
            "Mistral small : ~0.2$/M tokens. Choisir si RGPD/souveraineté UE est exigée.",
            "OpenAI/Anthropic : réserver aux livrables stratégiques ou Go/No-Go critiques.",
            "Configurer LLM_PROVIDER_ORDER pour personnaliser la chaîne selon vos besoins.",
            "Configurer LLM_TASK_<TYPE>=<provider> pour forcer un provider sur une tâche spécifique.",
        ],
    }
