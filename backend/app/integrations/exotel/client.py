"""Exotel telephony: click-to-call (connect two numbers) with recording, plus call lookup."""

import xml.etree.ElementTree as ET
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.integrations.base import CallInfo

IST = ZoneInfo("Asia/Kolkata")
_STATUS = {"queued": "queued", "in-progress": "in_progress", "ringing": "in_progress",
           "completed": "completed", "failed": "failed", "busy": "busy", "no-answer": "no_answer"}


class ExotelError(Exception):
    pass


def _parse(response: httpx.Response) -> dict:
    """Exotel answers in JSON or Twilio-style XML depending on the URL; accept both."""
    if response.status_code >= 400:
        raise ExotelError(f"Exotel returned HTTP {response.status_code}: {response.text[:200]}")
    try:
        return response.json()["Call"]
    except (ValueError, KeyError):
        node = ET.fromstring(response.text).find("Call")
        if node is None:
            raise ExotelError("Unexpected Exotel response")
        return {child.tag: child.text for child in node}


def _dt(value: str | None) -> datetime | None:
    try:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S").replace(tzinfo=IST) if value else None
    except ValueError:
        return None


def _int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def to_call_info(raw: dict) -> CallInfo:
    return CallInfo(sid=raw.get("Sid") or raw.get("CallSid") or "",
                    status=_STATUS.get(str(raw.get("Status", "")).lower(), "queued"),
                    duration_sec=_int(raw.get("Duration")), recording_url=raw.get("RecordingUrl") or None,
                    started_at=_dt(raw.get("StartTime")), ended_at=_dt(raw.get("EndTime")))


class ExotelTelephony:
    def __init__(self, *, api_key: str, api_token: str, account_sid: str, subdomain: str,
                 client: httpx.Client | None = None):
        self.auth = (api_key, api_token)
        self.base = f"https://{subdomain}/v1/Accounts/{account_sid}"
        self.http = client or httpx.Client(timeout=30)

    def connect_call(self, *, from_number, to_number, caller_id, status_callback, record=True) -> str:
        data = {"From": from_number, "To": to_number, "CallerId": caller_id,
                "Record": "true" if record else "false", "RecordingChannels": "dual"}
        if status_callback:
            data.update(StatusCallback=status_callback, StatusCallbackContentType="application/json")
        sid = _parse(self.http.post(f"{self.base}/Calls/connect", auth=self.auth, data=data)).get("Sid")
        if not sid:
            raise ExotelError("Exotel did not return a call id")
        return sid

    def get_call(self, sid: str) -> CallInfo:
        return to_call_info(_parse(self.http.get(f"{self.base}/Calls/{sid}.json", auth=self.auth)))

    def download_recording(self, url: str) -> bytes:
        r = self.http.get(url, follow_redirects=True)
        if r.status_code in (401, 403):  # some links need the account credentials
            r = self.http.get(url, auth=self.auth, follow_redirects=True)
        if r.status_code >= 400:
            raise ExotelError(f"Could not download recording (HTTP {r.status_code})")
        return r.content
