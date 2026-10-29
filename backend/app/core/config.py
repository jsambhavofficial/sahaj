"""Application settings, loaded from environment / .env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "SamarthCare AI"
    environment: str = "development"
    database_url: str = "sqlite:///./samarth.db"
    jwt_secret: str = "change-me"
    bhashini_api_key: str = ""
    aws_region: str = "ap-south-1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
