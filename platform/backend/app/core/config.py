from functools import lru_cache
from pydantic import Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DataSphere Innovation IA Platform"
    app_env: str = "development"
    app_debug: bool = True
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60
    database_url: str = "postgresql+psycopg2://datasphere:change-me@localhost:5432/datasphere_platform"

    @validator("database_url", pre=True)
    def fix_database_url(cls, v: str) -> str:
        """
        Render injecte une URL postgres:// (sans +psycopg2).
        SQLAlchemy 2.0 requiert postgresql+psycopg2:// — on corrige automatiquement.
        """
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+psycopg2://", 1)
        elif v.startswith("postgresql://") and "+psycopg2" not in v:
            v = v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    # ── LLM Providers ─────────────────────────────────────────────────────────
    # Leave empty to skip a provider. At least one key is needed for real AI.
    # Priority order: anthropic → openai → gemini → groq → glm → qwen
    #                 → mistral → openrouter → together → cohere → perplexity
    #                 → simulation (always works)

    anthropic_api_key: str = ""      # https://console.anthropic.com
    openai_api_key: str = ""         # https://platform.openai.com
    gemini_api_key: str = ""         # https://aistudio.google.com/apikey
    groq_api_key: str = ""           # https://console.groq.com  — quasi-gratuit
    glm_api_key: str = ""            # https://open.bigmodel.ai  — glm-4-flash gratuit
    qwen_api_key: str = ""           # https://dashscope.aliyuncs.com
    mistral_api_key: str = ""        # https://console.mistral.ai
    openrouter_api_key: str = ""     # https://openrouter.ai     — 200+ modèles
    together_api_key: str = ""       # https://api.together.xyz
    cohere_api_key: str = ""         # https://dashboard.cohere.com
    perplexity_api_key: str = ""     # https://www.perplexity.ai/settings/api

    # ── LLM Model overrides (optional — uses provider defaults if empty) ─────
    llm_model_anthropic: str = ""    # e.g. claude-3-5-sonnet-20241022
    llm_model_openai: str = ""       # e.g. gpt-4o
    llm_model_gemini: str = ""       # e.g. gemini-1.5-pro
    llm_model_groq: str = ""         # e.g. llama-3.1-8b-instant (faster/cheaper)
    llm_model_glm: str = ""          # e.g. glm-4 (premium vs glm-4-flash)
    llm_model_qwen: str = ""         # e.g. qwen-max
    llm_model_mistral: str = ""      # e.g. mistral-large-latest
    llm_model_openrouter: str = ""   # e.g. anthropic/claude-3.5-haiku
    llm_model_together: str = ""     # e.g. Qwen/Qwen2.5-72B-Instruct-Turbo
    llm_model_cohere: str = ""       # e.g. command-r
    llm_model_perplexity: str = ""   # e.g. sonar-pro

    # ── LLM Global settings ───────────────────────────────────────────────────
    llm_max_tokens: int = 1500
    llm_timeout_seconds: int = 25   # 25s max per LLM call — fail fast, try next provider
    # Override provider priority order (comma-separated provider names)
    llm_provider_order: str = ""     # e.g. "groq,anthropic,gemini"

    # ── Task-specific provider overrides ─────────────────────────────────────
    # Force a specific provider for each task type
    # e.g. LLM_TASK_GO_NO_GO_RECOMMENDATION=anthropic
    llm_task_go_no_go_recommendation: str = ""
    llm_task_context_analysis: str = ""
    llm_task_tender_requirements_review: str = ""
    llm_task_deliverable_plan: str = ""
    llm_task_compliance_matrix: str = ""
    llm_task_commercial_proposal: str = ""

    # ── Scheduler ─────────────────────────────────────────────────────────────
    sentry_dsn: str = Field(default="", description="Sentry DSN pour le monitoring prod")
    scheduler_enabled: bool = True
    scheduler_timezone: str = "Europe/Paris"
    scheduler_auto_execute_interval_minutes: int = 5
    scheduler_auto_plan_interval_minutes: int = 3
    scheduler_auto_draft_interval_minutes: int = 10
    scheduler_daily_report_hour: int = 7
    scheduler_max_actions_per_run: int = 10
    boamp_scan_enabled: bool = True
    boamp_keywords: str = Field(
        default="data informatique numérique IA intelligence artificielle machine learning",
        description="Mots-clés BOAMP séparés par espaces"
    )
    boamp_score_threshold: int = Field(default=70, description="Score minimum pour notification")
    boamp_daily_limit: int = Field(default=50, description="Nombre max d'AOs à analyser par scan")         # Daily BOAMP public tender scan

    # ── Stripe Billing ────────────────────────────────────────────────────────
    stripe_secret_key: str = ""             # sk_live_... or sk_test_...
    stripe_webhook_secret: str = ""         # whsec_...
    stripe_starter_price_id: str = ""       # price_... for Starter monthly
    stripe_starter_yearly_price_id: str = ""
    stripe_pro_price_id: str = ""           # price_... for Pro monthly
    stripe_pro_yearly_price_id: str = ""
    stripe_success_url: str = "https://datasphere-frontend-n1mb.onrender.com"
    stripe_cancel_url: str = "https://datasphere-frontend-n1mb.onrender.com/pricing"

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key and self.stripe_secret_key.startswith("sk_"))

    # ── SMTP ──────────────────────────────────────────────────────────────────
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "DataSphere Innovation <noreply@datasphere-innovation.fr>"
    frontend_url: str = "https://datasphere-frontend-n1mb.onrender.com"
    smtp_tls: bool = True

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user)

    @property
    def has_llm_provider(self) -> bool:
        return any([
            self.anthropic_api_key, self.openai_api_key, self.gemini_api_key,
            self.groq_api_key, self.glm_api_key, self.qwen_api_key,
            self.mistral_api_key, self.openrouter_api_key, self.together_api_key,
            self.cohere_api_key, self.perplexity_api_key,
        ])

    @property
    def cors_origin_list(self) -> list[str]:
        """
        Parse CORS_ORIGINS env var. Always includes localhost origins in dev.
        Production: set CORS_ORIGINS to your real domain(s).

        Examples:
          CORS_ORIGINS=https://datasphere-innovation.fr
          CORS_ORIGINS=https://app.datasphere.fr,https://datasphere-innovation.fr
        """
        # Parse whatever was set
        parsed = [o.strip() for o in self.cors_origins.split(",") if o.strip()]

        # Dev always includes localhost (avoids CORS hell during development)
        if self.app_env in ("development", "dev", "local", "test", ""):
            dev_origins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
            for origin in dev_origins:
                if origin not in parsed:
                    parsed.append(origin)

        # Render auto-detection : RENDER_EXTERNAL_URL est injecté automatiquement
        # par Render sur le service backend. On en déduit l'URL du frontend.
        import os as _os
        render_external = _os.environ.get("RENDER_EXTERNAL_URL", "")
        if render_external:
            # Le backend est sur datasphere-backend-xxxx.onrender.com
            # Le frontend est sur datasphere-frontend-xxxx.onrender.com
            # On autorise tous les *.onrender.com pour l'auto-discovery
            frontend_guess = render_external.replace(
                "datasphere-backend", "datasphere-frontend"
            ).rstrip("/")
            if frontend_guess and frontend_guess not in parsed:
                parsed.append(frontend_guess)

        # Safety net: never return an empty list (would block everything)
        if not parsed:
            return [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]

        return parsed

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
