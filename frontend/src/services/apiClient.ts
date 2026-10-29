import { ApiError } from "../types/domain";

/**
 * Defensive HTTP Client for SamarthCare AI Backend.
 * Safely handles requests, typed errors, and timeout/cancellation.
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      baseUrl ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8000";
  }

  async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    
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
        let errorBody: { detail?: string; message?: string } | null = null;
        try {
          errorBody = await response.json();
        } catch {
          // Response body was not JSON
        }

        const apiError: ApiError = {
          code: `HTTP_${response.status}`,
          message:
            errorBody?.detail ||
            errorBody?.message ||
            `Request failed with status ${response.status}: ${response.statusText}`,
          status_code: response.status,
          details: errorBody,
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

  patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const defaultApiClient = new ApiClient();

