import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "../services/apiClient";

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient("http://test-server:8000");
    vi.restoreAllMocks();
  });

  it("handles successful JSON response", async () => {
    const mockData = { status: "healthy", version: "2.0.0" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await client.get("/health");
    expect(result).toEqual(mockData);
  });

  it("handles 404 response with structured ApiError", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "Senior not found: S9999" }),
    });

    await expect(client.get("/seniors/S9999")).rejects.toMatchObject({
      code: "HTTP_404",
      message: "Senior not found: S9999",
      status_code: 404,
    });
  });

  it("handles 500 internal server error defensively", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({ detail: "Database connection failed" }),
    });

    await expect(client.get("/seniors")).rejects.toMatchObject({
      code: "HTTP_500",
      status_code: 500,
    });
  });

  it("handles network drop or fetch rejection", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    await expect(client.get("/health")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Failed to fetch",
    });
  });

  it("resolves /health at root and api endpoints with /api/v1 prefix", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    });

    await client.get("/health");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-server:8000/health",
      expect.anything()
    );

    await client.get("/coordinators/me/today");
    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-server:8000/api/v1/coordinators/me/today",
      expect.anything()
    );
  });

  it("parses standard contract error format { error: { code, message } }", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        error: {
          code: "invalid_credentials",
          message: "Incorrect email or password",
        },
      }),
    });

    await expect(client.post("/auth/login", { email: "bad" })).rejects.toMatchObject({
      code: "invalid_credentials",
      message: "Incorrect email or password",
      status_code: 401,
    });
  });

  it("attempts silent token refresh on 401 token_expired and retries", async () => {
    localStorage.setItem("samarth_refresh_token", "test_refresh_token");

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes("/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: "refreshed_access_token",
            refresh_token: "new_refresh_token",
          }),
        };
      }

      if (callCount === 1) {
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: "token_expired",
              message: "Access token has expired",
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ result: "success_after_refresh" }),
      };
    });

    const res = await client.get<{ result: string }>("/coordinators/me/today");
    expect(res).toEqual({ result: "success_after_refresh" });
    expect(localStorage.getItem("samarth_auth_token")).toBe("refreshed_access_token");
  });
});

