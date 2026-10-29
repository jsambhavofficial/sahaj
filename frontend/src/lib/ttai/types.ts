/**
 * ToughTongue AI Type Definitions for Sahaj AI
 */

export type EmbedStyle = "full" | "basic" | "minimal";

export interface EmbedUrlOptions {
  scenarioId: string;
  embedStyle?: EmbedStyle;
  background?: "black" | "white" | "transparent";
  userName?: string;
  userEmail?: string;
  promptUserInfo?: boolean;
  dynamicVariables?: Record<string, string>;
  accessToken?: string;
  voice?: string;
  accent?: string;
  name?: string;
  color?: string;
  showPulse?: boolean;
  hidePoweredBy?: boolean;
  maxDuration?: number;
  restoreSession?: string;
  languageCode?: string;
}

export type IframeEventType =
  | "onStart"
  | "onStop"
  | "onTerminated"
  | "onSubmit"
  | "onError"
  | "onReady";

export interface IframeEventData {
  session_id: string;
  scenario_id?: string;
  duration_seconds?: number;
  timestamp: number;
}

export interface IframeStartEvent {
  type: "onStart";
  data: IframeEventData;
}

export interface IframeStopEvent {
  type: "onStop";
  data: IframeEventData;
}

export interface IframeTerminatedEvent {
  type: "onTerminated";
  data: IframeEventData;
}

export interface IframeSubmitEvent {
  type: "onSubmit";
  data: IframeEventData;
}

export interface IframeErrorEvent {
  type: "onError";
  data: {
    code: string;
    message: string;
  };
}

export interface IframeReadyEvent {
  type: "onReady";
  data: {
    scenario_id: string;
  };
}

export type IframeEvent =
  | IframeStartEvent
  | IframeStopEvent
  | IframeTerminatedEvent
  | IframeSubmitEvent
  | IframeErrorEvent
  | IframeReadyEvent;

export interface IframeEventHandlers {
  onStart?: (event: IframeStartEvent) => void;
  onStop?: (event: IframeStopEvent) => void;
  onTerminated?: (event: IframeTerminatedEvent) => void;
  onSubmit?: (event: IframeSubmitEvent) => void;
  onError?: (error: { code: string; message: string }) => void;
  onReady?: (scenarioId: string) => void;
}

export interface SATResponse {
  success: boolean;
  configured: boolean;
  scenario_id: string;
  access_token?: string;
  expires_at?: string;
  iframe_src: string;
  message?: string;
}

export interface VoiceConfigResponse {
  scenario_id: string;
  embed_base: string;
  origin: string;
  has_api_key: boolean;
  agent_name: string;
  agent_role: string;
  default_language: string;
  supported_embed_styles: string[];
  direct_embed_url: string;
}

