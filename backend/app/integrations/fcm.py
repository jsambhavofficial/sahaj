"""Firebase Cloud Messaging (FCM) HTTP v1 Push Notification Client.

Integrates with Google Firebase Cloud Messaging using the modern FCM HTTP v1 API.
Supports Android, iOS and WebPush payloads with strict privacy masking.
"""

import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import httpx
import jwt

from app.core.config import get_settings
from app.integrations.base import PushProvider, PushTransientError

logger = logging.getLogger(__name__)

FCM_SEND_URL = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"


class FCMPushProvider(PushProvider):
    """Production Firebase Cloud Messaging HTTP v1 provider."""

    def __init__(self, credentials_path_or_json: str | None = None) -> None:
        self._raw_config = (credentials_path_or_json or get_settings().fcm_credentials_json).strip()
        self._parsed_creds: dict[str, Any] | None = None
        self._access_token: str | None = None
        self._token_expires_at: float = 0
        self._load_credentials()

    def _load_credentials(self) -> None:
        if not self._raw_config:
            # Check default file path if set in environment
            default_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
            if default_path and os.path.isfile(default_path):
                try:
                    self._parsed_creds = json.loads(Path(default_path).read_text(encoding="utf-8"))
                    logger.info("FCM credentials loaded from GOOGLE_APPLICATION_CREDENTIALS: %s", default_path)
                    return
                except Exception as exc:
                    logger.warning("Failed to parse GOOGLE_APPLICATION_CREDENTIALS file: %s", exc)
            return

        try:
            candidate_path = Path(self._raw_config)
            if not candidate_path.is_file():
                backend_rel = Path(__file__).resolve().parents[2] / self._raw_config
                if backend_rel.is_file():
                    candidate_path = backend_rel

            if candidate_path.is_file():
                content = candidate_path.read_text(encoding="utf-8")
                self._parsed_creds = json.loads(content)
                logger.info("FCM credentials loaded from file: %s", candidate_path)
            else:
                self._parsed_creds = json.loads(self._raw_config)
                logger.info("FCM credentials loaded from JSON configuration string")
        except Exception as exc:
            logger.warning("FCM credentials could not be parsed: %s", exc)
            self._parsed_creds = None

    @property
    def is_configured(self) -> bool:
        return bool(
            self._parsed_creds
            and self._parsed_creds.get("client_email")
            and self._parsed_creds.get("private_key")
            and self._parsed_creds.get("project_id")
        )

    def _get_access_token(self) -> str | None:
        """Obtain a Google OAuth2 access token for FCM HTTP v1 using the service account."""
        if not self.is_configured:
            return None

        now = time.time()
        # Reuse existing token if valid for at least 5 more minutes
        if self._access_token and now < (self._token_expires_at - 300):
            return self._access_token

        try:
            client_email = self._parsed_creds["client_email"]
            private_key = self._parsed_creds["private_key"]
            payload = {
                "iss": client_email,
                "sub": client_email,
                "aud": OAUTH_TOKEN_URL,
                "scope": FCM_SCOPE,
                "iat": int(now),
                "exp": int(now + 3600),
            }

            signed_jwt = jwt.encode(payload, private_key, algorithm="RS256")
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    OAUTH_TOKEN_URL,
                    data={
                        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                        "assertion": signed_jwt,
                    },
                )
                if res.status_code == 200:
                    data = res.json()
                    self._access_token = data["access_token"]
                    self._token_expires_at = now + data.get("expires_in", 3600)
                    return self._access_token
                else:
                    logger.error("FCM OAuth token exchange failed (HTTP %s): %s", res.status_code, res.text)
                    return None
        except Exception as exc:
            logger.exception("Failed to obtain FCM OAuth2 token: %s", exc)
            return None

    def send(self, token: str, title: str, body: str, data: dict[str, str]) -> bool:
        """Send push notification to device token via FCM HTTP v1.

        Returns True if accepted by FCM.
        Returns False if the token was rejected (e.g. unregistered, invalid).
        """
        if not token or len(token) < 8:
            return False

        # If FCM service account is not yet configured, log and simulate delivery for local development
        if not self.is_configured:
            logger.info(
                "[FCM Local/Simulated] Push notification to token %s... Title: '%s', Data: %s",
                token[:12],
                title,
                data,
            )
            # Accept tokens that don't match known invalid signatures
            return not token.startswith("invalid_")

        access_token = self._get_access_token()
        if not access_token:
            raise PushTransientError("FCM access token unavailable")

        project_id = self._parsed_creds["project_id"]
        url = FCM_SEND_URL.format(project_id=project_id)

        # Standard FCM HTTP v1 message structure
        clean_data = {str(k): str(v) for k, v in (data or {}).items() if v is not None}
        click_url = clean_data.get("url") or clean_data.get("click_action") or "/notifications"

        message_payload = {
            "message": {
                "token": token,
                "notification": {
                    "title": title,
                    "body": body,
                },
                "data": clean_data,
                "android": {
                    "priority": "HIGH",
                    "notification": {
                        "channel_id": "sahaj_care_channel",
                        "sound": "default",
                        "notification_priority": "PRIORITY_HIGH",
                        "visibility": "PUBLIC",
                    },
                },
                "webpush": {
                    "headers": {
                        "Urgency": "high",
                    },
                    "notification": {
                        "title": title,
                        "body": body,
                        "icon": "/icons/icon-192.png",
                        "badge": "/icons/badge-72.png",
                        "requireInteraction": True,
                    },
                    "fcm_options": {
                        "link": click_url,
                    },
                },
            }
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json; UTF-8",
                    },
                    json=message_payload,
                )

                if resp.status_code == 200:
                    logger.info("FCM push delivered successfully to token %s...", token[:12])
                    return True

                error_body = resp.text
                logger.warning("FCM push response HTTP %s for token %s: %s", resp.status_code, token[:12], error_body)

                # Token invalidation codes in FCM v1
                if resp.status_code in (400, 404):
                    bad_token = "UNREGISTERED" in error_body or "NOT_FOUND" in error_body or (
                        "INVALID_ARGUMENT" in error_body and "registration token" in error_body.lower())
                    if bad_token:
                        logger.info("Token %s is unregistered or invalid; marking for cleanup.", token[:12])
                        return False

                # 5xx, rate limit or auth trouble: keep the device token and retry later
                raise PushTransientError(f"FCM HTTP {resp.status_code}")
        except PushTransientError:
            raise
        except Exception as exc:
            raise PushTransientError(f"FCM network error: {exc}") from exc

