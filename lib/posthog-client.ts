"use client";

import posthog from "posthog-js";

export function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  posthog.capture(event, properties);
}
