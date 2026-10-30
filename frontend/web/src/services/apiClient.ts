import { ApiError } from "../types/domain";
import { isOperationalPath, operationalGet, operationalPost } from "./operationalAdapter";

/**
 * Defensive HTTP Client for SamarthCare AI Backend.
 * Complies with SamarthCare AI API Contract (v1).
 * Safely handles requests, typed errors, token refresh, and timeout/cancellation.
 */
export class ApiClient {
  private baseUrl: string;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8000"
    ).replace(/\/+$/, "");
  }

  /**
   * Resolves endpoint path against baseUrl:
   * Health endpoints (/health, /health/db) are at {host}/health
   * All other endpoints are at {host}/api/v1/...
   */
  private resolveUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    if (cleanEndpoint.startsWith("http://") || cleanEndpoint.startsWith("https://")) {
      return cleanEndpoint;
    }

    if (cleanEndpoint === "/health" || cleanEndpoint === "/health/db") {
      return `${this.baseUrl}${cleanEndpoint}`;
    }

    // Ensure /api/v1 prefix
    if (cleanEndpoint.startsWith("/api/v1")) {
      return `${this.baseUrl}${cleanEndpoint}`;
    }

    return `${this.baseUrl}/api/v1${cleanEndpoint}`;
  }

  /**
   * Attempt token refresh using refresh_token stored in localStorage
   */
  private async attemptTokenRefresh(): Promise<string | null> {
    if (typeof window === "undefined") return null;

    const refreshToken = localStorage.getItem("samarth_refresh_token");
    if (!refreshToken) return null;

    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const refreshUrl = `${this.baseUrl}/api/v1/auth/refresh`;
        const res = await fetch(refreshUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!res.ok) {
          localStorage.removeItem("samarth_auth_token");
          localStorage.removeItem("samarth_refresh_token");
          localStorage.removeItem("samarth_auth_user");
          return null;
        }

        const data = await res.json();
        const newToken = data.access_token;
        if (newToken) {
          localStorage.setItem("samarth_auth_token", newToken);
          if (data.refresh_token) {
            localStorage.setItem("samarth_refresh_token", data.refresh_token);
          }
          if (data.user) {
            localStorage.setItem("samarth_auth_user", JSON.stringify(data.user));
          }
          return newToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async request<T>(
    endpoint: string,
    options?: RequestInit & { _isRetry?: boolean }
  ): Promise<T> {
    if (isOperationalPath(endpoint)) {
      const call = <R>(e: string, o?: RequestInit) => this.request<R>(e, o);
      return options?.method === "POST"
        ? operationalPost<T>(endpoint, options.body ? JSON.parse(String(options.body)) : undefined, call)
        : operationalGet<T>(endpoint, call);
    }
    const url = this.resolveUrl(endpoint);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (typeof window !== "undefined") {
        const token = localStorage.getItem("samarth_auth_token");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }

      if (options?.headers) {
        if (Array.isArray(options.headers)) {
          options.headers.forEach(([k, v]) => {
            headers[k] = v;
          });
        } else if (typeof Headers !== "undefined" && options.headers instanceof Headers) {
          options.headers.forEach((v, k) => {
            headers[k] = v;
          });
        } else {
          Object.assign(headers, options.headers as Record<string, string>);
        }
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorBody: any = null;
        try {
          errorBody = await response.json();
        } catch {
          // Response body was not JSON
        }

        // Check for 401 token_expired to trigger silent refresh & retry
        const errCode = errorBody?.error?.code || errorBody?.detail?.code;
        if (
          response.status === 401 &&
          (errCode === "token_expired" ||
            errorBody?.error?.message?.toLowerCase().includes("token expired") ||
            errorBody?.detail?.toLowerCase?.().includes("token expired")) &&
          !options?._isRetry
        ) {
          const refreshedToken = await this.attemptTokenRefresh();
          if (refreshedToken) {
            return this.request<T>(endpoint, {
              ...options,
              _isRetry: true,
              headers: {
                ...options?.headers,
                Authorization: `Bearer ${refreshedToken}`,
              },
            });
          }
        }

        // API Contract standard error format:
        // { "error": { "code": "...", "message": "...", "details": [...]? } }
        const parsedCode =
          errorBody?.error?.code ||
          errorBody?.code ||
          `HTTP_${response.status}`;

        const parsedMessage =
          errorBody?.error?.message ||
          errorBody?.detail ||
          errorBody?.message ||
          `Request failed with status ${response.status}: ${response.statusText}`;

        const apiError: ApiError = {
          code: parsedCode,
          message: parsedMessage,
          status_code: response.status,
          details: errorBody?.error?.details || errorBody?.details || errorBody,
        };

        throw apiError;
      }

      // Empty response handling (e.g. 204 No Content)
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: unknown) {
      if ((err as ApiError).code) {
        throw err;
      }

      const networkError: ApiError = {
        code: "NETWORK_ERROR",
        message:
          err instanceof Error
            ? err.message
            : "An unexpected network error occurred while communicating with the server.",
      };
      throw networkError;
    }
  }

  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }
}

export const defaultApiClient = new ApiClient();


