#!/usr/bin/env python3
"""
DataSphere — Diagnostic de configuration
Lancer depuis platform/backend/ pour vérifier l'environnement.

Usage:
    python scripts/check_config.py
    python scripts/check_config.py --fix        # génère un .env corrigé
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Couleurs terminal ────────────────────────────────────────────────────────
OK  = "\033[32m✓\033[0m"
ERR = "\033[31m✗\033[0m"
WRN = "\033[33m⚠\033[0m"
INF = "\033[36mℹ\033[0m"


def section(title: str) -> None:
    print(f"\n\033[1m── {title} ──\033[0m")


def main() -> None:
    print("\033[1mDataSphere Innovation IA Platform — Diagnostic de configuration\033[0m")

    # ── .env existence ────────────────────────────────────────────────────────
    section("Fichier .env")
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_exists = os.path.exists(env_path)
    if env_exists:
        print(f"  {OK} .env trouvé")
    else:
        print(f"  {WRN} .env manquant — les valeurs par défaut seront utilisées")
        print(f"       Copier .env.example → .env (racine du projet)")

    # ── Load settings ─────────────────────────────────────────────────────────
    try:
        from app.core.config import settings
    except Exception as e:
        print(f"  {ERR} Impossible de charger la configuration : {e}")
        sys.exit(1)

    # ── APP_ENV ───────────────────────────────────────────────────────────────
    section("APP_ENV")
    env_val = settings.app_env
    if env_val in ("development", "dev", "local"):
        print(f"  {OK} APP_ENV={env_val} (mode dev — localhost CORS activé)")
    elif env_val in ("production", "prod"):
        print(f"  {INF} APP_ENV={env_val} (mode prod)")
    else:
        print(f"  {WRN} APP_ENV={env_val!r} (inconnu — traité comme dev)")

    # ── CORS ─────────────────────────────────────────────────────────────────
    section("CORS")
    origins = settings.cors_origin_list
    print(f"  {INF} {len(origins)} origines autorisées :")
    for o in origins:
        print(f"       {OK} {o}")

    # Warn if localhost is missing in dev
    has_localhost = any("localhost:5173" in o or "127.0.0.1:5173" in o for o in origins)
    if not has_localhost and env_val not in ("production", "prod"):
        print(f"  {WRN} localhost:5173 absent — le frontend dev ne pourra pas appeler l'API !")
        print(f"       Solution : APP_ENV=development dans .env")

    # ── Database ──────────────────────────────────────────────────────────────
    section("Base de données")
    db_url = settings.database_url
    if "change-me" in db_url:
        print(f"  {WRN} DATABASE_URL contient encore 'change-me' — mettre à jour .env")
    else:
        print(f"  {OK} DATABASE_URL configurée")
    print(f"       {db_url.split('@')[-1] if '@' in db_url else db_url}")

    # ── SECRET_KEY ────────────────────────────────────────────────────────────
    section("Sécurité")
    if settings.secret_key in ("change-me", "change-me-with-openssl-rand-hex-64", ""):
        print(f"  {ERR} SECRET_KEY non configurée ! Générer avec :")
        print(f"       python -c \"import secrets; print(secrets.token_hex(64))\"")
    else:
        print(f"  {OK} SECRET_KEY configurée ({len(settings.secret_key)} chars)")

    # ── LLM Providers ─────────────────────────────────────────────────────────
    section("Providers LLM")
    providers = {
        "GLM (gratuit)":    settings.glm_api_key,
        "Groq (quasi-gratuit)": settings.groq_api_key,
        "Gemini (quasi-gratuit)": settings.gemini_api_key,
        "OpenAI":           settings.openai_api_key,
        "Anthropic":        getattr(settings, "anthropic_api_key", ""),
    }
    configured = [(name, key) for name, key in providers.items() if key]
    if configured:
        for name, _ in configured:
            print(f"  {OK} {name}")
    else:
        print(f"  {WRN} Aucun provider LLM configuré — mode simulation uniquement")
        print(f"       Recommandé : GLM_API_KEY=... (gratuit sur open.bigmodel.ai)")

    # ── Summary ───────────────────────────────────────────────────────────────
    section("Résumé")
    issues = []
    if not has_localhost and env_val not in ("production", "prod"):
        issues.append("CORS : localhost:5173 manquant")
    if "change-me" in db_url:
        issues.append("DATABASE_URL : non configurée")
    if settings.secret_key in ("change-me", "change-me-with-openssl-rand-hex-64", ""):
        issues.append("SECRET_KEY : non sécurisée")

    if issues:
        print(f"  {WRN} {len(issues)} problème(s) à corriger :")
        for issue in issues:
            print(f"     • {issue}")
        print(f"\n  Solution rapide : copier .env.example → .env (racine du projet)")
        print(f"  puis modifier les valeurs marquées 'change-me'")
    else:
        print(f"  {OK} Configuration valide pour le développement")
        print(f"  Démarrer le backend : uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    main()
