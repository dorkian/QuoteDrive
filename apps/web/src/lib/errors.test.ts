import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  UNAUTHORIZED_EVENT,
  describeError,
  throwIfNotOk,
} from "./errors";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("throwIfNotOk", () => {
  it("does nothing for a successful response", async () => {
    await expect(
      throwIfNotOk(jsonResponse(200, {}), "Failed"),
    ).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the status and the API's detail", async () => {
    const error = await throwIfNotOk(
      jsonResponse(404, { detail: "Not found" }),
      "Failed to load opportunity",
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      message: "Failed to load opportunity",
      detail: "Not found",
    });
  });

  it("tolerates a non-JSON error body", async () => {
    const error = await throwIfNotOk(
      new Response("<html>Bad gateway</html>", { status: 502 }),
      "Failed",
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 502, detail: null });
  });

  it("announces a 401 so the app can return to the login screen", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await throwIfNotOk(jsonResponse(401, {}), "Failed").catch(() => {});

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on a 401 when the caller handles it itself", async () => {
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);

    await throwIfNotOk(jsonResponse(401, {}), "Invalid demo login", {
      notifyUnauthorized: false,
    }).catch(() => {});

    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("describeError", () => {
  const action = "load this opportunity";

  it("names the user's role on a generic 403", () => {
    const err = new ApiError(
      403,
      "Failed",
      "Insufficient role for this action",
    );
    expect(describeError(err, { action, role: "viewer" })).toEqual({
      message: "Your role (Viewer) can't load this opportunity.",
      retryable: false,
    });
  });

  it("passes through a specific 403 reason from the API", () => {
    const err = new ApiError(403, "Failed", "Cannot approve your own version");
    expect(describeError(err, { action, role: "approver" })).toEqual({
      message: "Cannot approve your own version.",
      retryable: false,
    });
  });

  it("reports a 404 as missing, not as something to retry", () => {
    const err = new ApiError(404, "Failed", "Not found");
    expect(describeError(err, { action, subject: "opportunity" })).toEqual({
      message: "This opportunity doesn't exist or isn't in your organization.",
      retryable: false,
    });
  });

  it("treats server and network failures as retryable", () => {
    expect(
      describeError(new ApiError(500, "Failed", null), { action }),
    ).toEqual({ message: "Couldn't load this opportunity.", retryable: true });
    expect(describeError(new TypeError("Failed to fetch"), { action })).toEqual(
      { message: "Couldn't load this opportunity.", retryable: true },
    );
  });
});
