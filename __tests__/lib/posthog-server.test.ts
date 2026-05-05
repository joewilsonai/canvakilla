import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureServerEvent } from "../../lib/posthog-server";

// ---------------------------------------------------------------------------
// getPostHogClient – isolation via module reset + dynamic import
// ---------------------------------------------------------------------------

describe("getPostHogClient", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  });
  afterEach(() => {
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  });

  it("returns null when no PostHog token is configured", async () => {
    const { getPostHogClient } = await import("../../lib/posthog-server");
    expect(getPostHogClient()).toBeNull();
  });

  it("returns a PostHog client instance when POSTHOG_KEY is set", async () => {
    process.env.POSTHOG_KEY = "phc_test_key_123";
    const { getPostHogClient } = await import("../../lib/posthog-server");
    const client = getPostHogClient();
    expect(client).not.toBeNull();
  });

  it("returns a PostHog client instance when POSTHOG_PROJECT_TOKEN is set", async () => {
    process.env.POSTHOG_PROJECT_TOKEN = "phc_project_token_456";
    const { getPostHogClient } = await import("../../lib/posthog-server");
    const client = getPostHogClient();
    expect(client).not.toBeNull();
  });

  it("returns a PostHog client instance when NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is set", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_public_token_789";
    const { getPostHogClient } = await import("../../lib/posthog-server");
    const client = getPostHogClient();
    expect(client).not.toBeNull();
  });

  it("returns the same singleton on repeated calls within the same module instance", async () => {
    process.env.POSTHOG_KEY = "phc_singleton_test";
    const { getPostHogClient } = await import("../../lib/posthog-server");
    const client1 = getPostHogClient();
    const client2 = getPostHogClient();
    expect(client1).toBe(client2);
  });
});

// ---------------------------------------------------------------------------
// captureServerEvent
// ---------------------------------------------------------------------------

describe("captureServerEvent", () => {
  beforeEach(() => {
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  });
  afterEach(() => {
    delete process.env.POSTHOG_KEY;
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  });

  it("does not throw when no PostHog client is available", () => {
    expect(() =>
      captureServerEvent({
        distinctId: "user-123",
        event: "test_event",
        properties: { key: "value" },
      }),
    ).not.toThrow();
  });

  it("does not throw when called with minimal arguments", () => {
    expect(() =>
      captureServerEvent({ distinctId: "u1", event: "e1" }),
    ).not.toThrow();
  });

  it("calls client.capture when a token is available", async () => {
    vi.resetModules();
    process.env.POSTHOG_KEY = "phc_capture_test_key";
    const { getPostHogClient, captureServerEvent: capture } = await import(
      "../../lib/posthog-server"
    );
    const client = getPostHogClient();
    if (client) {
      const captureSpy = vi.spyOn(client, "capture").mockReturnValue(undefined);
      capture({
        distinctId: "user-abc",
        event: "image_generation_completed",
        properties: { model: "test-model" },
      });
      expect(captureSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: "user-abc",
          event: "image_generation_completed",
        }),
      );
    }
  });
});
