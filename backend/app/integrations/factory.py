"""Chooses real or stub providers from settings. Stubs are the default everywhere."""

from functools import lru_cache

from app.core.config import get_settings
from app.integrations.base import LLMProvider, PushProvider, STTProvider, StorageProvider, TTSProvider, TelephonyProvider
from app.integrations.bhashini.client import BhashiniClient, BhashiniSTT, BhashiniTTS
from app.integrations.exotel.client import ExotelTelephony
from app.integrations.storage import LocalStorage, SupabaseStorage
from app.integrations.stub.providers import StubLLM, StubPush, StubSTT, StubTTS, StubTelephony


@lru_cache
def get_telephony() -> TelephonyProvider:
    s = get_settings()
    if s.telephony_provider == "exotel":
        return ExotelTelephony(api_key=s.exotel_api_key, api_token=s.exotel_api_token,
                               account_sid=s.exotel_account_sid, subdomain=s.exotel_subdomain)
    return StubTelephony()


@lru_cache
def _bhashini() -> BhashiniClient:
    s = get_settings()
    return BhashiniClient(user_id=s.bhashini_user_id, ulca_key=s.bhashini_api_key,
                          inference_key=s.bhashini_inference_key, tts_model=s.bhashini_tts_model)


@lru_cache
def get_stt() -> STTProvider:
    return BhashiniSTT(_bhashini()) if get_settings().stt_provider == "bhashini" else StubSTT()


@lru_cache
def get_tts() -> TTSProvider:
    return BhashiniTTS(_bhashini()) if get_settings().tts_provider == "bhashini" else StubTTS()


@lru_cache
def get_llm() -> LLMProvider:
    return StubLLM()  # Bedrock is added when access arrives


@lru_cache
def get_storage() -> StorageProvider:
    s = get_settings()
    if s.storage_provider == "supabase":
        return SupabaseStorage(s)
    return LocalStorage()


@lru_cache
def get_push() -> PushProvider:
    return StubPush()  # FCM is added when credentials are available
