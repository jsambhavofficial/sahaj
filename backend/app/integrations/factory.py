"""Chooses real or stub providers from settings. Stubs are the default everywhere."""

import logging
from functools import lru_cache

from app.core.config import get_settings
from app.integrations.base import LLMProvider, PushProvider, STTProvider, StorageProvider, TTSProvider, TelephonyProvider
from app.integrations.bhashini.client import BhashiniClient, BhashiniSTT, BhashiniTTS
from app.integrations.exotel.client import ExotelTelephony
from app.integrations.fcm import FCMPushProvider
from app.integrations.gemini.client import GeminiLLM
from app.integrations.groq.client import GroqLLM
from app.integrations.sarvam.client import SarvamClient, SarvamSTT, SarvamTTS
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
def _sarvam() -> SarvamClient:
    s = get_settings()
    return SarvamClient(api_key=s.sarvam_api_key, stt_model=s.sarvam_stt_model,
                        tts_model=s.sarvam_tts_model, tts_speaker=s.sarvam_tts_speaker)


@lru_cache
def get_stt() -> STTProvider:
    provider = get_settings().stt_provider
    if provider == "bhashini":
        return BhashiniSTT(_bhashini())
    return SarvamSTT(_sarvam()) if provider == "sarvam" else StubSTT()


@lru_cache
def get_tts() -> TTSProvider:
    provider = get_settings().tts_provider
    if provider == "bhashini":
        return BhashiniTTS(_bhashini())
    return SarvamTTS(_sarvam()) if provider == "sarvam" else StubTTS()


@lru_cache
def get_llm() -> LLMProvider:
    s = get_settings()
    if s.llm_provider == "groq":
        if s.groq_api_key:
            return GroqLLM(api_key=s.groq_api_key, model=s.groq_model)
        logging.getLogger(__name__).warning("LLM_PROVIDER=groq but GROQ_API_KEY is empty; using the stub LLM")
    if s.llm_provider == "gemini":
        if s.gemini_api_key:
            return GeminiLLM(api_key=s.gemini_api_key, model=s.gemini_model)
        logging.getLogger(__name__).warning("LLM_PROVIDER=gemini but GEMINI_API_KEY is empty; using the stub LLM")
    return StubLLM()  # Bedrock is added when access arrives


@lru_cache
def get_storage() -> StorageProvider:
    s = get_settings()
    if s.storage_provider == "supabase":
        return SupabaseStorage(s)
    return LocalStorage()


@lru_cache
def get_push() -> PushProvider:
    s = get_settings()
    if s.push_provider == "fcm" or s.fcm_credentials_json:
        fcm = FCMPushProvider()
        if fcm.is_configured:
            return fcm
        logging.getLogger(__name__).warning(
            "FCM is requested but the service-account credentials could not be loaded "
            "(check FCM_CREDENTIALS_JSON); using the stub push provider")
    return StubPush()
