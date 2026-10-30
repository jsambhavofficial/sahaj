import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { defaultApiClient } from "../services/apiClient";

// The web portal is for organization managers; coordinators and seniors use the mobile app.
async function loadAuth() {
  // Empty -> the built-in default (ops, admin). The module is imported once per file, after this.
  vi.stubEnv("NEXT_PUBLIC_WEB_ROLES", "");
  return await import("../context/AuthContext");
}

async function signIn(role: string) {
  const mod = await loadAuth();
  vi.spyOn(defaultApiClient, "post").mockResolvedValue({
    access_token: "tok", refresh_token: "ref", user: { id: "u1", role, display_name: "Test", email: "t@x" },
  });
  let ctx: ReturnType<typeof mod.useAuth> | null = null;
  function Probe() {
    ctx = mod.useAuth();
    return null;
  }
  render(<mod.AuthProvider><Probe /></mod.AuthProvider>);
  return { mod, get: () => ctx! };
}

describe("web portal access", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(["ops", "admin", "city_manager", "organization_admin"])("lets %s sign in", async (role) => {
    const { get } = await signIn(role);
    let user;
    await act(async () => { user = await get().login("a@b.c", "pw"); });
    expect(user).toMatchObject({ role });
    expect(localStorage.getItem("samarth_auth_token")).toBe("tok");
  });

  it.each(["coordinator", "senior", "family"])("refuses %s and stores no session", async (role) => {
    const { mod, get } = await signIn(role);
    await act(async () => {
      await expect(get().login("a@b.c", "pw")).rejects.toThrow(mod.WEB_PORTAL_ROLE_MESSAGE);
    });
    expect(localStorage.getItem("samarth_auth_token")).toBeNull();
    expect(localStorage.getItem("samarth_auth_user")).toBeNull();
  });

  it("refuses senior device pairing on the web", async () => {
    const { mod, get } = await signIn("ops");
    await act(async () => {
      await expect(get().pairSenior("PAIR_X")).rejects.toThrow(mod.WEB_PORTAL_ROLE_MESSAGE);
    });
  });

  it("drops a leftover coordinator session on page load", async () => {
    localStorage.setItem("samarth_auth_token", "old");
    localStorage.setItem("samarth_auth_user", JSON.stringify({ id: "c", role: "coordinator" }));
    await signIn("ops");
    await act(async () => {});
    expect(localStorage.getItem("samarth_auth_token")).toBeNull();
  });
});
