import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "./api";
import { AuthProvider, useAuth } from "./auth-context";

vi.mock("./api");

const mockMe: api.Me = {
  user: { id: 1, email: "admin@northstar.example", display_name: "Admin" },
  organization: {
    id: 1,
    name: "Northstar Mobility Advisory",
    slug: "northstar",
  },
  role: "admin",
};

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthProvider", () => {
  it("starts unauthenticated when there is no stored token", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
  });

  it("restores a session from a stored token", async () => {
    localStorage.setItem("quotedrive.token", "stored-token");
    vi.mocked(api.fetchMe).mockResolvedValue(mockMe);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.me).toEqual(mockMe);
    expect(result.current.token).toBe("stored-token");
  });

  it("clears an invalid stored token instead of leaving the dashboard broken", async () => {
    localStorage.setItem("quotedrive.token", "expired-token");
    vi.mocked(api.fetchMe).mockRejectedValue(new Error("Session expired"));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(localStorage.getItem("quotedrive.token")).toBeNull();
  });

  it("login() authenticates and stores the token on success", async () => {
    vi.mocked(api.demoLogin).mockResolvedValue("new-token");
    vi.mocked(api.fetchMe).mockResolvedValue(mockMe);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.login("admin@northstar.example");
    });

    expect(result.current.status).toBe("authenticated");
    expect(result.current.token).toBe("new-token");
    expect(localStorage.getItem("quotedrive.token")).toBe("new-token");
  });

  it("login() surfaces an error and stays unauthenticated on failure", async () => {
    vi.mocked(api.demoLogin).mockRejectedValue(new Error("Invalid demo login"));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    await act(async () => {
      await result.current.login("nobody@example.com");
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.error).not.toBeNull();
  });
});
