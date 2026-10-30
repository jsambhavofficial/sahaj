/**
 * Strict HTTP client for the Sahaj backend. Unlike the old contract.ts helper it never invents
 * sample data when a request fails: errors reach the screen so a wrong URL is obvious.
 */
import { API_BASE_URL } from './contract';
import { messageOf } from './mappers';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const TIMEOUT_MS = 60000;

interface AuthHooks {
  getTokens: () => { access: string | null; refresh: string | null };
  setTokens: (access: string, refresh: string | null) => void;
  /** Last resort before signing out, e.g. a paired senior phone logging in again with its device token. */
  renew?: () => Promise<boolean>;
  onExpired: () => void;
}
let hooks: AuthHooks | null = null;
export function configureAuth(h: AuthHooks | null) {
  hooks = h;
}

let refreshing: Promise<boolean> | null = null;

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'AbortError' || e.message?.toLowerCase().includes('abort') || e.message?.toLowerCase().includes('timeout'));
    throw new ApiError(
      timedOut
        ? 'The server took too long to answer. Please try again.'
        : `Cannot reach the Sahaj server (${API_BASE_URL}). Check your internet connection.`,
      0,
      'network_error'
    );
  } finally {
    clearTimeout(timer);
  }
}

async function toError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let code: string | undefined;
  try {
    const body = await res.json();
    if (body?.error?.message) message = String(body.error.message);
    code = body?.error?.code;
    if (!body?.error && Array.isArray(body?.detail)) message = 'Please check the details you entered.';
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(message, res.status, code);
}

async function refreshAccessToken(): Promise<boolean> {
  const tokens = hooks?.getTokens();
  if (!hooks || !tokens?.refresh) return false;
  try {
    const res = await rawFetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (!data?.access_token) return false;
    hooks.setTokens(data.access_token, data.refresh_token ?? tokens.refresh);
    return true;
  } catch {
    return false;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** false for login/pair calls, which have no token yet. */
  auth?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const { method = 'GET', body, query, auth = true } = opts;
  const qs = query
    ? '?' + Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')
    : '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isFormData = Boolean(body) && ((typeof FormData !== 'undefined' && body instanceof FormData) || typeof (body as any)?.append === 'function' || Array.isArray((body as any)?._parts));
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  const access = hooks?.getTokens().access;
  if (auth && access) headers.Authorization = `Bearer ${access}`;

  const res = await rawFetch(path + (qs === '?' ? '' : qs), {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as unknown as BodyInit) : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !retried) {
    refreshing = refreshing ?? refreshAccessToken().finally(() => { refreshing = null; });
    if (await refreshing) return request<T>(path, opts, true);
    if (hooks?.renew && (await hooks.renew())) return request<T>(path, opts, true);
    hooks?.onExpired();
    throw new ApiError('Your session has expired. Please sign in again.', 401, 'session_expired');
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new ApiError(messageOf(e), res.status, 'bad_response');
  }
}
