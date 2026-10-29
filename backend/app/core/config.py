"""Application settings, loaded from environment / .env."""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "SamarthCare AI"
    environment: str = "development"
    database_url: str = "sqlite:///./samarth.db"
    jwt_secret: str = "change-me"
    bhashini_api_key: str = ""

    # Pluggable LLM Provider Settings
    llm_provider: str = "gemini"  # "gemini", "openai", "groq", "anthropic", "ollama", "mock"
    llm_model: Optional[str] = None
    llm_api_key: str = ""
    llm_base_url: Optional[str] = None

    # Provider-specific keys
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    openai_api_key: str = ""
    groq_api_key: str = ""
    anthropic_api_key: str = ""

    aws_region: str = "ap-south-1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
