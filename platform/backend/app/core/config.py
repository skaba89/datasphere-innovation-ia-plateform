from functools import lru_cache
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

    # LLM providers — leave empty to use simulation fallback
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    mistral_api_key: str = ""
    openrouter_api_key: str = ""
    llm_max_tokens: int = 1500
    llm_timeout_seconds: int = 60

    # Scheduler
    scheduler_enabled: bool = True
    scheduler_timezone: str = "Europe/Paris"
    scheduler_auto_execute_interval_minutes: int = 5
    scheduler_auto_plan_interval_minutes: int = 3
    scheduler_auto_draft_interval_minutes: int = 10
    scheduler_daily_report_hour: int = 7
    scheduler_max_actions_per_run: int = 10

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def has_llm_provider(self) -> bool:
        return bool(self.anthropic_api_key or self.openai_api_key or self.openrouter_api_key or self.mistral_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
