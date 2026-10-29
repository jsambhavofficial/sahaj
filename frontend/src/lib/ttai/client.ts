/**
 * ToughTongue AI Client Utilities for Sahaj AI
 *
 * Implements embed URL construction, message postMessage lifecycle listeners,
 * and communication with the backend voice proxy.
 */

import { TOUGHTONGUE_ORIGIN, TOUGHTONGUE_EMBED_BASE, DEFAULT_VOICE_SCENARIO_ID } from "./constants";
import type {
  EmbedUrlOptions,
  IframeEventHandlers,
  IframeEventData,
  SATResponse,
  VoiceConfigResponse,
} from "./types";
import { defaultApiClient } from "@/services/apiClient";

/**
 * Builds an embed URL for a ToughTongue AI scenario.
 */
export function buildEmbedUrl(options: EmbedUrlOptions): string {
  const {
    scenarioId = DEFAULT_VOICE_SCENARIO_ID,
    embedStyle = "basic",
    background,
    userName,
    userEmail,
    promptUserInfo,
    dynamicVariables,
    accessToken,
    voice,
    accent,
    name,
    color,
    showPulse,
    hidePoweredBy,
    maxDuration,
    restoreSession,
    languageCode = "hi",
  } = options;

  const basePath =
    embedStyle === "basic"
      ? `${TOUGHTONGUE_EMBED_BASE}/basic/${scenarioId}`
      : embedStyle === "minimal"
        ? `${TOUGHTONGUE_EMBED_BASE}/minimal/${scenarioId}`
        : `${TOUGHTONGUE_EMBED_BASE}/${scenarioId}`;

  const url = new URL(basePath);

  // Access control
  if (accessToken) url.searchParams.set("scenarioAccessToken", accessToken);

  // User identity
  if (userName) url.searchParams.set("userName", userName);
  if (userEmail) url.searchParams.set("userEmail", userEmail);
  if (promptUserInfo && !userName) url.searchParams.set("promptUserInfo", "true");

  // Appearance & Voice
  if (background) url.searchParams.set("background", background);
  if (voice) url.searchParams.set("voice", voice);
  if (accent) url.searchParams.set("accent", accent);
  if (name) url.searchParams.set("name", name);
  if (color) url.searchParams.set("color", color);
  if (languageCode) url.searchParams.set("languageCode", languageCode);

  // Behaviour
  if (showPulse === false) url.searchParams.set("showPulse", "false");
  if (hidePoweredBy) url.searchParams.set("hidePoweredBy", "true");
  if (maxDuration) url.searchParams.set("maxDuration", String(maxDuration));
  if (restoreSession) url.searchParams.set("restoreSession", restoreSession);

  // Dynamic variables — prefix every key with t_
  if (dynamicVariables) {
    Object.entries(dynamicVariables).forEach(([key, value]) => {
      const paramKey = key.startsWith("t_") ? key : `t_${key}`;
      url.searchParams.set(paramKey, value);
    });
  }

  return url.toString();
}

/**
 * Normalizes different event payload formats from ToughTongue iframe.
 */
function normalizeEventPayload(rawData: Record<string, unknown>): {
  eventType: string;
  data: IframeEventData;
} | null {
  // Format A: { event: 'onStart', sessionId: '...', timestamp: 123 }
  if (rawData.event && typeof rawData.event === "string") {
    return {
      eventType: rawData.event,
      data: {
        session_id: (rawData.sessionId as string) || (rawData.session_id as string) || "",
        scenario_id: rawData.scenarioId as string | undefined,
        duration_seconds: rawData.duration_seconds as number | undefined,
        timestamp: typeof rawData.timestamp === "number" ? rawData.timestamp : Date.now(),
      },
    };
  }

  // Format B: { type: 'onStart', data: { session_id: '...', ... } }
  if (rawData.type && typeof rawData.type === "string") {
    const nestedData = (rawData.data as Record<string, unknown>) || {};
    return {
      eventType: rawData.type,
      data: {
        session_id: (nestedData.session_id as string) || (rawData.sessionId as string) || "",
        scenario_id: (nestedData.scenario_id as string) || (rawData.scenarioId as string) || undefined,
        duration_seconds: nestedData.duration_seconds as number | undefined,
        timestamp:
          typeof nestedData.timestamp === "number"
            ? nestedData.timestamp
            : typeof nestedData.timestamp === "string"
              ? new Date(nestedData.timestamp).getTime()
              : Date.now(),
      },
    };
  }

  return null;
}

/**
 * Creates a message event listener for ToughTongue iframe events.
 */
export function createIframeEventListener(handlers: IframeEventHandlers): () => void {
  const handleMessage = (event: MessageEvent) => {
    // Only accept messages from ToughTongue origin
    if (event.origin !== TOUGHTONGUE_ORIGIN) return;

    const rawData = event.data as Record<string, unknown>;
    if (!rawData || typeof rawData !== "object") return;

    if (rawData.type === "onError" || rawData.event === "onError") {
      const errorData =
        (rawData.data as { code: string; message: string }) ||
        ({
          code: "UNKNOWN_ERROR",
          message: String(rawData.message || "Unknown voice agent error"),
        } as { code: string; message: string });
      handlers.onError?.(errorData);
      return;
    }

    if (rawData.type === "onReady" || rawData.event === "onReady") {
      const scenarioId =
        (rawData.data as { scenario_id?: string })?.scenario_id ||
        (rawData.scenarioId as string) ||
        DEFAULT_VOICE_SCENARIO_ID;
      handlers.onReady?.(scenarioId);
      return;
    }

    const normalized = normalizeEventPayload(rawData);
    if (!normalized) return;

    const { eventType, data } = normalized;

    switch (eventType) {
      case "onStart":
        handlers.onStart?.({ type: "onStart", data });
        break;
      case "onStop":
        handlers.onStop?.({ type: "onStop", data });
        break;
      case "onTerminated":
        handlers.onTerminated?.({ type: "onTerminated", data });
        break;
      case "onSubmit":
        handlers.onSubmit?.({ type: "onSubmit", data });
        break;
    }
  };

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}

/**
 * Fetches voice agent configuration from Sahaj backend.
 */
export async function fetchVoiceConfig(): Promise<VoiceConfigResponse> {
  return defaultApiClient.get<VoiceConfigResponse>("/api/v1/voice/config");
}

/**
 * Requests a Scenario Access Token from backend proxy.
 */
export async function fetchSAT(request?: {
  scenario_id?: string;
  duration_hours?: number;
  email?: string;
}): Promise<SATResponse> {
  return defaultApiClient.post<SATResponse>("/api/v1/voice/sat", request || {});
}

/**
 * Logs a voice agent event (start, stop, etc.) back to Sahaj backend for records and care team visibility.
 */
export async function recordVoiceEvent(payload: {
  session_id: string;
  event_type: string;
  duration_seconds?: number;
  scenario_id?: string;
  senior_id?: string;
  notes?: string;
}): Promise<{ status: string; session_id: string; event_type: string; timestamp: string }> {
  return defaultApiClient.post("/api/v1/voice/session-event", payload);
}

