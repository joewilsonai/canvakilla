import { createHash, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DEFAULT_IMAGE_MODEL_ID,
  normalizeImageModelId,
  type ImageModelId,
} from "../../../lib/image-models";
import {
  checkGenerationRateLimit,
  getLimiterKey,
  getSharedLimiterConfig,
  isSharedLimiterRequired,
  warnMissingSharedLimiter,
  warnSharedLimiterFailure,
  type LimitCheck,
  type RateLimitOptions,
} from "../../../lib/generation-limiter";
import { normalizeReferenceLabels } from "../../../lib/generation-request";
import { getOpenRouterApiKey, OPENROUTER_API_URL } from "../../../lib/openrouter";
import {
  buildPromptEnhancerMessages,
  extractEnhancedPrompt,
} from "../../../lib/prompt-enhancer";
import { captureServerEvent } from "../../../lib/posthog-server";
import type { EditTarget, PlatformId } from "../../../lib/platforms";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_CHARS = 3_000;
const MAX_REFERENCE_LABELS = 12;
const PROMPT_ENHANCER_TIMEOUT_MS = 45_000;
const DEFAULT_PROMPT_ENHANCER_MODEL = "openai/gpt-5.4-mini";
const DEFAULT_MINUTE_LIMIT = 10;
const DEFAULT_HOUR_LIMIT = 80;
const DEFAULT_COST_MINUTE_LIMIT = 24;
const DEFAULT_COST_HOUR_LIMIT = 160;

type EnhancePromptRequest = {
  prompt?: unknown;
  model?: unknown;
  target?: unknown;
  platform?: unknown;
  hasCurrentImage?: unknown;
  referenceLabels?: unknown;
};

type OpenRouterPayload = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
  message?: string;
  model?: string;
};

class PromptEnhancerError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function normalizePlatformId(platform: unknown): PlatformId {
  return platform === "linkedin" ? "linkedin" : "x";
}

function normalizeTarget(target: unknown): EditTarget {
  return target === "profile" ? "profile" : "banner";
}

function normalizeModel(model: unknown): ImageModelId {
  return normalizeImageModelId(
    typeof model === "string" ? model : DEFAULT_IMAGE_MODEL_ID,
  );
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

function normalizeReferenceLabelInput(value: unknown) {
  if (!Array.isArray(value)) return [];

  return normalizeReferenceLabels(
    value
      .slice(0, MAX_REFERENCE_LABELS)
      .map((item) => (typeof item === "string" ? item : "")),
    Math.min(value.length, MAX_REFERENCE_LABELS),
  );
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function getAllowedRequestOrigins(request: Request) {
  const origins = new Set<string>();
  const requestOrigin = normalizeOrigin(request.url);
  if (requestOrigin) origins.add(requestOrigin);

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
    ? normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL)
    : "";
  if (siteOrigin) origins.add(siteOrigin);

  return origins;
}

function isSameOriginRequest(request: Request) {
  const allowedOrigins = getAllowedRequestOrigins(request);
  const origin = request.headers.get("origin");
  if (origin) return allowedOrigins.has(normalizeOrigin(origin));

  const referer = request.headers.get("referer");
  if (referer) return allowedOrigins.has(normalizeOrigin(referer));

  return false;
}

function getRequestIp(request: Request) {
  const trustedHeaders = [
    "x-vercel-forwarded-for",
    "x-forwarded-for",
    "x-real-ip",
  ];

  for (const header of trustedHeaders) {
    const value = request.headers.get(header);
    const ip = value?.split(",")[0]?.trim();
    if (ip) return ip;
  }

  return "unknown-ip";
}

function getSigningSecret() {
  return (
    process.env.CANVAKILLA_SESSION_SECRET ||
    getOpenRouterApiKey() ||
    "canvakilla-local-development-secret"
  );
}

function getAnalyticsDistinctId(request: Request) {
  return `anon_${createHmac("sha256", getSigningSecret())
    .update(`enhance:${getRequestIp(request)}`)
    .digest("base64url")
    .slice(0, 32)}`;
}

function getLimit(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPromptEnhancerModel() {
  const configuredModel = (
    process.env.PROMPT_ENHANCER_MODEL ||
    process.env.CANVAKILLA_PROMPT_ENHANCER_MODEL ||
    ""
  ).trim();

  return configuredModel || DEFAULT_PROMPT_ENHANCER_MODEL;
}

function getPromptLogDetails(prompt: string) {
  return {
    prompt_length: prompt.length,
    prompt_hash: createHash("sha256").update(prompt).digest("hex"),
  };
}

async function checkPromptEnhancementRateLimit(request: Request) {
  const sharedLimiter = getSharedLimiterConfig();
  const sharedLimiterRequired = isSharedLimiterRequired();

  if (!sharedLimiter) {
    if (sharedLimiterRequired) {
      throw new PromptEnhancerError(
        "Shared limiter missing.",
        "shared_limiter_missing",
        503,
      );
    }
    warnMissingSharedLimiter();
  }

  const options = {
    cost: 1,
    costMinuteLimit: getLimit(
      "PROMPT_ENHANCER_COST_LIMIT_PER_MINUTE",
      DEFAULT_COST_MINUTE_LIMIT,
    ),
    costHourLimit: getLimit(
      "PROMPT_ENHANCER_COST_LIMIT_PER_HOUR",
      DEFAULT_COST_HOUR_LIMIT,
    ),
    minuteLimit: getLimit(
      "PROMPT_ENHANCER_RATE_LIMIT_PER_MINUTE",
      DEFAULT_MINUTE_LIMIT,
    ),
    hourLimit: getLimit("PROMPT_ENHANCER_RATE_LIMIT_PER_HOUR", DEFAULT_HOUR_LIMIT),
  } satisfies RateLimitOptions;
  const limiterKey = getLimiterKey(
    "ip",
    `enhance:${getRequestIp(request)}`,
    getSigningSecret(),
  );

  try {
    return await checkGenerationRateLimit(sharedLimiter, limiterKey, options);
  } catch (error) {
    if (sharedLimiterRequired) {
      throw new PromptEnhancerError(
        "Shared limiter failed.",
        "shared_limiter_failed",
        503,
      );
    }
    warnSharedLimiterFailure(error);
    return checkGenerationRateLimit(null, limiterKey, options);
  }
}

function getRateLimitResponse(rateLimit: LimitCheck) {
  const message =
    rateLimit.resetSeconds <= 60
      ? `Too many prompt enhancements. Try again in about ${rateLimit.resetSeconds} seconds.`
      : "Hourly prompt enhancement limit reached. Try again later.";

  return NextResponse.json(
    { error: message, code: "prompt_enhancement_rate_limited" },
    {
      status: 429,
      headers: {
        "Retry-After": String(rateLimit.resetSeconds),
      },
    },
  );
}

async function parseOpenRouterResponse(response: Response): Promise<OpenRouterPayload> {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as OpenRouterPayload;
  } catch {
    return {
      message: text.replace(/\s+/g, " ").trim().slice(0, 240),
    };
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function getPublicErrorMessage(error: unknown) {
  if (error instanceof PromptEnhancerError) {
    if (error.status === 429) return "Too many prompt enhancements. Try again later.";
    if (error.status === 503) return "Prompt enhancement is temporarily unavailable.";
  }

  return "Prompt enhancement failed. Edit the prompt directly or try again.";
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Prompt enhancement requests must come from CanvaKilla.", code: "bad_origin" },
      { status: 403 },
    );
  }

  let payload: EnhancePromptRequest;
  try {
    payload = (await request.json()) as EnhancePromptRequest;
  } catch {
    return NextResponse.json(
      { error: "Could not read that prompt.", code: "bad_request" },
      { status: 400 },
    );
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const platform = normalizePlatformId(payload.platform);
  const target = normalizeTarget(payload.target);
  const model = normalizeModel(payload.model);
  const referenceLabels = normalizeReferenceLabelInput(payload.referenceLabels);
  const hasCurrentImage = normalizeBoolean(payload.hasCurrentImage);
  const distinctId = getAnalyticsDistinctId(request);

  if (!prompt) {
    return NextResponse.json(
      { error: "Add a prompt before enhancing it.", code: "missing_prompt" },
      { status: 400 },
    );
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      {
        error: `Keep prompts under ${MAX_PROMPT_CHARS.toLocaleString()} characters.`,
        code: "prompt_too_long",
      },
      { status: 400 },
    );
  }

  try {
    const rateLimit = await checkPromptEnhancementRateLimit(request);
    if (!rateLimit.ok) return getRateLimitResponse(rateLimit);

    const apiKey = getOpenRouterApiKey();
    if (!apiKey) {
      throw new PromptEnhancerError("OpenRouter key missing.", "openrouter_missing", 503);
    }

    console.info("CanvaKilla prompt enhancement request", {
      model,
      target,
      platform,
      has_current_image: hasCurrentImage,
      reference_count: referenceLabels.length,
      enhancer_model: getPromptEnhancerModel(),
      ...getPromptLogDetails(prompt),
    });

    captureServerEvent({
      distinctId,
      event: "prompt_enhancement_started",
      properties: {
        model,
        target,
        platform,
        has_current_image: hasCurrentImage,
        reference_count: referenceLabels.length,
      },
    });

    const response = await fetchWithTimeout(
      OPENROUTER_API_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://canvakilla.com",
          "X-Title": "CanvaKilla.com",
        },
        body: JSON.stringify({
          model: getPromptEnhancerModel(),
          messages: buildPromptEnhancerMessages({
            prompt,
            model,
            platform,
            target,
            hasCurrentImage,
            referenceLabels,
          }),
          max_tokens: 700,
          temperature: 0.55,
        }),
      },
      PROMPT_ENHANCER_TIMEOUT_MS,
    );
    const openRouterPayload = await parseOpenRouterResponse(response);

    if (!response.ok) {
      throw new PromptEnhancerError(
        openRouterPayload.error?.message ||
          openRouterPayload.message ||
          "OpenRouter could not enhance that prompt.",
        response.status === 429 ? "openrouter_rate_limited" : "openrouter_failed",
        response.status,
      );
    }

    const enhancedPrompt = extractEnhancedPrompt(
      openRouterPayload.choices?.[0]?.message?.content,
    );

    if (!enhancedPrompt) {
      throw new PromptEnhancerError(
        "OpenRouter did not return an enhanced prompt.",
        "openrouter_empty",
        502,
      );
    }

    captureServerEvent({
      distinctId,
      event: "prompt_enhancement_completed",
      properties: {
        model,
        target,
        platform,
        has_current_image: hasCurrentImage,
        reference_count: referenceLabels.length,
        enhancer_model: openRouterPayload.model || getPromptEnhancerModel(),
      },
    });

    return NextResponse.json({
      enhancedPrompt,
      model,
      enhancerModel: openRouterPayload.model || getPromptEnhancerModel(),
    });
  } catch (error) {
    const status =
      error instanceof PromptEnhancerError &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 500;
    const code =
      error instanceof PromptEnhancerError
        ? error.code
        : "prompt_enhancement_failed";

    console.error("Prompt enhancement failed", {
      code,
      status,
    });

    captureServerEvent({
      distinctId,
      event: "prompt_enhancement_failed",
      properties: {
        model,
        target,
        platform,
        error_kind: code,
      },
    });

    return NextResponse.json(
      {
        error: getPublicErrorMessage(error),
        code,
      },
      { status },
    );
  }
}
