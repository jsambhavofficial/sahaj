"""Application settings, loaded from environment / .env."""

import re
from datetime import date
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_JWT_SECRETS = {"", "change-me"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "SamarthCare AI"
    environment: str = "development"
    database_url: str = "sqlite:///./samarth.db"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60
    refresh_token_days: int = 14
    db_pool_size: int = 3  # connections kept open per process
    db_max_overflow: int = 2  # extra connections under load (3 + 2 = 5 at most)
    auth_rate_limit_per_minute: int = 20  # per IP per auth endpoint; 0 disables
    pairing_code_minutes: int = 10

    # Browser origins allowed to call the API (ops dashboard); comma separated in env.
    # 8081 / 19006 are Expo's web dev servers. Add the deployed web portal's address here.
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8081,http://localhost:19006"
    # Optional pattern for origins that change (preview deployments, a LAN address), e.g.
    # https://.*\.vercel\.app. Tokens travel in the Authorization header, not cookies.
    cors_origin_regex: str = ""

    # Demo clock: the dataset ends before the real "today". Empty means use the real date.
    demo_today: date | None = None

    # Which RiskScorer implementation to use (see app/modules/risk/service.get_scorer).
    risk_scorer: str = "multimodal"

    # Public URL of this service, used for provider webhooks.
    public_base_url: str = ""

    # Telephony (Exotel)
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_account_sid: str = ""
    exotel_subdomain: str = "api.exotel.com"
    exotel_caller_id: str = ""
    exotel_webhook_secret: str = ""

    # External providers; "stub" runs with no accounts.
    stt_provider: str = "stub"
    tts_provider: str = "stub"
    llm_provider: str = "stub"
    telephony_provider: str = "stub"
    push_provider: str = "stub"
    storage_provider: str = "stub"
    bhashini_api_key: str = ""  # the portal's "Udyat key" (sent as ulcaApiKey)
    bhashini_user_id: str = ""
    bhashini_inference_key: str = ""
    voice_agent_gender: str = "male"  # the voice agent's voice; the scripted lines use matching grammar
    bhashini_tts_model: str = "ai4bharat"  # or "iitm" (Bhashini/IITM/TTS, male voice only)
    sarvam_api_key: str = ""
    sarvam_stt_model: str = "saaras:v4"
    sarvam_tts_model: str = "bulbul:v4-flash"
    sarvam_tts_speaker: str = ""  # empty = the model's default voice
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    llm_api_key: str = ""
    llm_model: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    aws_region: str = "ap-south-1"
    bedrock_model_id: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    storage_bucket: str = ""
    fcm_credentials_json: str = ""

    # Background jobs
    scheduler_enabled: bool = False
    reminder_grace_minutes: int = 90

    @field_validator("public_base_url")
    @classmethod
    def _strip_trailing_slash(cls, v: str) -> str:
        return v.strip().rstrip("/")

    @field_validator("demo_today", mode="before")
    @classmethod
    def _empty_demo_today(cls, v):
        return None if v in ("", None) else v

    @field_validator("cors_origin_regex")
    @classmethod
    def _valid_cors_regex(cls, v: str) -> str:
        v = v.strip()
        if v:
            try:
                re.compile(v)
            except re.error as exc:
                raise ValueError(f"CORS_ORIGIN_REGEX is not a valid regular expression: {exc}") from exc
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def validate_for_runtime(self) -> None:
        """Fail fast on unsafe production configuration."""
        if self.is_production and self.jwt_secret in _INSECURE_JWT_SECRETS:
            raise RuntimeError("JWT_SECRET must be set to a long random value in production")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def today() -> date:
    """The 'current' date for date-based endpoints: DEMO_TODAY if set, else the real date."""
    return get_settings().demo_today or date.today()
