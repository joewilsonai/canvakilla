"use client";

import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";

const ALLOWED_EVENT_PROPERTIES = {
  $pageview: [
    "$current_url",
    "$host",
    "$pathname",
    "$referrer",
    "$referring_domain",
    "$screen_height",
    "$screen_width",
    "$viewport_height",
    "$viewport_width",
  ],
  $pageleave: [
    "$current_url",
    "$host",
    "$pathname",
    "$referrer",
    "$referring_domain",
  ],
  edit_target_switched: ["target", "platform"],
  image_downloaded: ["target", "with_template", "source", "platform"],
  image_generated: [
    "model",
    "target",
    "platform",
    "has_current_image",
    "reference_count",
    "prompt_renderer_used",
  ],
  image_generation_failed: ["model", "target", "platform", "error_kind"],
  model_changed: ["model", "platform"],
  current_image_moved_to_references: ["target", "platform"],
  prompt_starter_clicked: ["starter_index", "target", "platform"],
  reference_images_added: ["count", "platform"],
  reference_deselected_for_generation: ["reference_label", "target", "platform"],
  reference_loaded_as_profile_source: ["reference_label", "platform"],
  reference_selected_for_generation: ["reference_label", "target", "platform"],
  source_image_uploaded: ["target", "platform"],
} as const;

const ALLOWED_POSTHOG_SYSTEM_PROPERTIES = [
  "$browser",
  "$browser_version",
  "$device_id",
  "$device_type",
  "$insert_id",
  "$lib",
  "$lib_version",
  "$os",
  "$os_version",
  "$process_person_profile",
  "$session_id",
  "$time",
  "$window_id",
  "distinct_id",
  "token",
] as const;

const MAX_STRING_PROPERTY_LENGTH = 96;
const MAX_SYSTEM_STRING_PROPERTY_LENGTH = 256;

function isAllowedEvent(
  event: string,
): event is keyof typeof ALLOWED_EVENT_PROPERTIES {
  return event in ALLOWED_EVENT_PROPERTIES;
}

function sanitizePropertyValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  return value.slice(0, MAX_STRING_PROPERTY_LENGTH);
}

function sanitizeSystemPropertyValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;

  return value.slice(0, MAX_SYSTEM_STRING_PROPERTY_LENGTH);
}

function sanitizeProperties(
  event: string,
  properties?: Record<string, unknown>,
  options: { includeSystemProperties?: boolean } = {},
) {
  if (!isAllowedEvent(event)) return null;

  const allowedProperties = ALLOWED_EVENT_PROPERTIES[event];
  const sanitized: Record<string, string | number | boolean> = {};

  if (options.includeSystemProperties) {
    for (const propertyName of ALLOWED_POSTHOG_SYSTEM_PROPERTIES) {
      const value = sanitizeSystemPropertyValue(properties?.[propertyName]);
      if (value !== undefined) {
        sanitized[propertyName] = value;
      }
    }
  }

  for (const propertyName of allowedProperties) {
    const value = sanitizePropertyValue(properties?.[propertyName]);
    if (value !== undefined) {
      sanitized[propertyName] = value;
    }
  }

  return sanitized;
}

export function sanitizePostHogCapture(capture: CaptureResult | null) {
  if (!capture) return null;

  const sanitizedProperties = sanitizeProperties(
    capture.event,
    capture.properties as Record<string, unknown> | undefined,
    { includeSystemProperties: true },
  );

  if (!sanitizedProperties) return null;

  return {
    ...capture,
    properties: sanitizedProperties,
  };
}

export function captureClientEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  const sanitizedProperties = sanitizeProperties(event, properties);
  if (!sanitizedProperties) return;

  posthog.capture(event, sanitizedProperties);
}
