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
});

