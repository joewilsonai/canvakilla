import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;
let warnedMissingPostHogKey = false;

export function getPostHogClient() {
  const token =
    process.env.POSTHOG_KEY ||
    process.env.POSTHOG_PROJECT_TOKEN ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!token) {
    if (process.env.NODE_ENV === "production" && !warnedMissingPostHogKey) {
      console.warn("PostHog key missing in production; analytics events are disabled.");
      warnedMissingPostHogKey = true;
    }
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

export function captureServerEvent(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  const client = getPostHogClient();
  if (!client) return;
  client.capture(args);
}
