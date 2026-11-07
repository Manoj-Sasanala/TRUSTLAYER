from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven config. Every secret comes from .env, never from code."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    paypal_env: str = "sandbox"
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    catalog_signing_key: str = "dev-only-change-me"
    gemini_api_key: str = ""
    agent_mode: str = "mock"
    database_path: str = "warrant.db"


settings = Settings()
