#!/usr/bin/env python3
"""
DataSphere — Diagnostic de configuration
Lancer depuis le dossier platform/backend/ :

    python scripts/check_config.py

Vérifie : .env, APP_ENV, CORS, DATABASE_URL, SECRET_KEY, providers LLM.
"""

import os
import sys

# Ajoute platform/backend/ au chemin Python
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)          # platform/backend/
ROOT_DIR    = os.path.dirname(os.path.dirname(BACKEND_DIR))  # repo root

sys.path.insert(0, BACKEND_DIR)

# Couleurs (désactivées sur Windows sans ANSI)
_ANSI = sys.platform != 'win32' or os.environ.get('TERM', '') == 'xterm'
def _c(code: str, text: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _ANSI else text

OK  = _c("32", "✓")
ERR = _c("31", "✗")
WRN = _c("33", "⚠")
INF = _c("36", "ℹ")


def section(title: str) -> None:
    print(f"\n{_c('1', f'── {title} ──')}")


def main() -> None:
    print(_c("1", "DataSphere Innovation IA Platform — Diagnostic de configuration"))

    # ── Vérifier le répertoire courant ────────────────────────────────────────
    cwd = os.getcwd()
    if not os.path.exists(os.path.join(cwd, "app", "main.py")):
        print(f"\n{ERR} Mauvais répertoire !")
        print(f"   Répertoire actuel : {cwd}")
        print(f"   Lancer depuis     : platform/backend/")
        print(f"   Commande correcte : python scripts/check_config.py")
        sys.exit(1)
    print(f"  {OK} Répertoire correct : {cwd}")

    # ── .env existence ────────────────────────────────────────────────────────
    section("Fichier .env")
    # Cherche .env dans platform/backend/ OU à la racine du projet
    env_in_backend = os.path.join(BACKEND_DIR, ".env")
    env_in_root    = os.path.join(ROOT_DIR, ".env")
    env_path = None
    if os.path.exists(env_in_backend):
        env_path = env_in_backend
        print(f"  {OK} .env trouvé : {env_in_backend}")
    elif os.path.exists(env_in_root):
        env_path = env_in_root
        print(f"  {OK} .env trouvé à la racine : {env_in_root}")
    else:
        print(f"  {WRN} .env manquant — valeurs par défaut utilisées")
        print(f"       Copier .env.example → .env à la racine du projet :")
        print(f"       cp {os.path.join(ROOT_DIR, '.env.example')} {env_in_root}")

    # ── Charger la configuration ──────────────────────────────────────────────
    try:
        from app.core.config import Settings
        # Forcer la lecture depuis le bon .env
        if env_path:
            s = Settings(_env_file=env_path)
        else:
            s = Settings()
    except Exception as e:
        print(f"\n  {ERR} Impossible de charger la configuration :")
        print(f"       {e}")
        print(f"\n       → Vérifier que vous êtes dans platform/backend/")
        print(f"         et que les dépendances Python sont installées :")
        print(f"         pip install -r requirements.txt")
        sys.exit(1)

    # ── APP_ENV ───────────────────────────────────────────────────────────────
    section("APP_ENV")
    env_val = s.app_env
    if env_val in ("development", "dev", "local", ""):
        print(f"  {OK} APP_ENV={env_val!r} — mode dev (CORS localhost activé automatiquement)")
    elif env_val in ("production", "prod"):
        print(f"  {INF} APP_ENV={env_val!r} — mode production")
    else:
        print(f"  {WRN} APP_ENV={env_val!r} — inconnu (traité comme dev)")

    # ── CORS ──────────────────────────────────────────────────────────────────
    section("CORS")
    origins = s.cors_origin_list
    print(f"  {INF} {len(origins)} origines autorisées :")
    for o in origins:
        print(f"       {OK} {o}")

    has_localhost = any("localhost:5173" in o or "127.0.0.1:5173" in o for o in origins)
    if not has_localhost:
        print(f"\n  {ERR} localhost:5173 absent — le frontend ne peut pas appeler l'API !")
        print(f"       Ajouter dans .env :")
        print(f"       APP_ENV=development")
        print(f"       CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173")
    else:
        print(f"\n  {OK} Le frontend sur localhost:5173 peut appeler l'API")

    # ── DATABASE_URL ──────────────────────────────────────────────────────────
    section("Base de données")
    db = s.database_url
    if "change-me" in db:
        print(f"  {WRN} DATABASE_URL contient 'change-me' — à configurer dans .env")
    else:
        host_part = db.split("@")[-1] if "@" in db else db
        print(f"  {OK} DATABASE_URL : {host_part}")

    # ── SECRET_KEY ────────────────────────────────────────────────────────────
    section("Sécurité")
    if s.secret_key in ("change-me", "change-me-with-openssl-rand-hex-64", "x", ""):
        print(f"  {ERR} SECRET_KEY non sécurisée !")
        print(f"       Générer une clé :")
        print(f'       python -c "import secrets; print(secrets.token_hex(64))"')
    else:
        print(f"  {OK} SECRET_KEY configurée ({len(s.secret_key)} chars)")

    # ── Providers LLM ─────────────────────────────────────────────────────────
    section("Providers LLM")
    providers = [
        ("GLM (gratuit)",         getattr(s, "glm_api_key", "")),
        ("Groq (quasi-gratuit)",  getattr(s, "groq_api_key", "")),
        ("Gemini (quasi-gratuit)",getattr(s, "gemini_api_key", "")),
        ("OpenAI",                getattr(s, "openai_api_key", "")),
        ("Anthropic",             getattr(s, "anthropic_api_key", "")),
    ]
    configured = [(n, k) for n, k in providers if k]
    if configured:
        for name, _ in configured:
            print(f"  {OK} {name}")
    else:
        print(f"  {WRN} Aucun provider LLM — mode simulation (pas d'IA réelle)")
        print(f"       Configurer au moins un provider dans .env :")
        print(f"       GLM_API_KEY=... (gratuit sur open.bigmodel.ai)")

    # ── Résumé ────────────────────────────────────────────────────────────────
    section("Résumé")
    issues = []
    if not has_localhost:
        issues.append("CORS : localhost:5173 absent")
    if "change-me" in s.database_url:
        issues.append("DATABASE_URL : non configurée")
    if s.secret_key in ("change-me", "change-me-with-openssl-rand-hex-64", "x", ""):
        issues.append("SECRET_KEY : non sécurisée")

    if issues:
        print(f"  {WRN} {len(issues)} problème(s) :")
        for issue in issues:
            print(f"     • {issue}")
        print(f"\n  Solution : copier .env.example → .env et remplir les valeurs")
    else:
        print(f"  {OK} Configuration OK pour le développement")
        print(f"     Démarrer le backend :")
        print(f"     uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    main()
