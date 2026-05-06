"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { sanitizePostHogCapture } from "../lib/posthog-client";

let isPostHogInitialized = false;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    if (!token || isPostHogInitialized) return;

    posthog.init(token, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2026-01-30",
      autocapture: false,
      capture_exceptions: false,
      capture_pageleave: true,
      capture_pageview: true,
      disable_session_recording: true,
      advanced_disable_flags: true,
      respect_dnt: true,
      before_send: sanitizePostHogCapture,
      debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true",
    });
    isPostHogInitialized = true;
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
