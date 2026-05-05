import { NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { captureServerEvent } from "../../../lib/posthog-server";

export const runtime = "nodejs";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.1-flash-image-preview";
const MAX_REFERENCE_IMAGES_PER_RUN = 12;
const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_SOURCE_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_REQUEST_BYTES = 38 * 1024 * 1024;
const MAX_PROVIDER_IMAGE_BYTES = 18 * 1024 * 1024;
const MAX_PROMPT_CHARS = 3_000;
const PROVIDER_FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_MINUTE_LIMIT = 4;
const DEFAULT_HOUR_LIMIT = 20;
const DEFAULT_IP_MINUTE_LIMIT = 8;
const DEFAULT_IP_HOUR_LIMIT = 40;
const DEFAULT_MAX_ACTIVE_GENERATIONS = 8;
const SESSION_COOKIE_NAME = "canvakilla_session";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MODEL_CONFIGS = {
  "openai/gpt-5.4-image-2": {
    label: "GPT Image 2",
    bannerAspectRatio: null,
    profileAspectRatio: "1:1",
  },
  "google/gemini-3.1-flash-image-preview": {
    label: "Nano Banana 2",
    bannerAspectRatio: "3:1",
    profileAspectRatio: "1:1",
    imageSize: "2K",
  },
  "google/gemini-2.5-flash-image": {
    label: "Nano Banana",
    bannerAspectRatio: null,
    profileAspectRatio: "1:1",
  },
  "google/gemini-3-pro-image-preview": {
    label: "Nano Banana Pro",
    bannerAspectRatio: "3:1",
    profileAspectRatio: "1:1",
    imageSize: "2K",
  },
} as const;

const LEGACY_MODEL_IDS: Record<string, ModelId> = {
  "gpt-image-2": "openai/gpt-5.4-image-2",
  "gemini-3.1-flash-image-preview": "google/gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image": "google/gemini-2.5-flash-image",
  "gemini-3-pro-image-preview": "google/gemini-3-pro-image-preview",
};

type ModelId = keyof typeof MODEL_CONFIGS;
type Target = "banner" | "profile";

type ImageInput = {
  file: File;
  label?: string;
};

type RateBucket = {
  minuteStartedAt: number;
  minuteCount: number;
  hourStartedAt: number;
  hourCount: number;
};

type OpenRouterImage = {
  type?: string;
  image_url?: {
    url?: string;
  };
  imageUrl?: {
    url?: string;
  };
  url?: string;
};

type OpenRouterMessage = {
  content?: unknown;
  images?: OpenRouterImage[];
};

type OpenRouterPayload = {
  choices?: Array<{
    message?: OpenRouterMessage;
  }>;
  error?: {
    message?: string;
  };
  message?: string;
  usage?: unknown;
};

type SessionIdentity = {
  id: string;
  setCookie?: string;
};

type LimitCheck = {
  ok: boolean;
  resetSeconds: number;
  message: string;
};

const globalRateState = globalThis as typeof globalThis & {
  canvaKillaRateBuckets?: Map<string, RateBucket>;
  canvaKillaActiveGenerations?: Set<string>;
};

const rateBuckets =
  globalRateState.canvaKillaRateBuckets ||
  (globalRateState.canvaKillaRateBuckets = new Map<string, RateBucket>());
const activeGenerations =
  globalRateState.canvaKillaActiveGenerations ||
  (globalRateState.canvaKillaActiveGenerations = new Set<string>());

let lastRateCleanupAt = 0;

export function normalizeModelId(model: string): ModelId {
  if (model in MODEL_CONFIGS) return model as ModelId;
  return LEGACY_MODEL_IDS[model] || DEFAULT_MODEL;
}

export function getAspectRatio(model: ModelId, target: Target) {
  const config = MODEL_CONFIGS[model];
  return target === "profile" ? config.profileAspectRatio : config.bannerAspectRatio;
}

export function getImageConfig(model: ModelId, target: Target) {
  const config = MODEL_CONFIGS[model];
  const imageConfig: {
    aspect_ratio?: string;
    image_size?: string;
  } = {};
  const aspectRatio = getAspectRatio(model, target);

  if (aspectRatio) imageConfig.aspect_ratio = aspectRatio;

  if ("imageSize" in config) {
    imageConfig.image_size = config.imageSize;
  }

  return Object.keys(imageConfig).length ? imageConfig : undefined;
}

export function getSafeImageMimeType(contentType: string) {
  const mimeType = contentType.split(";")[0]?.trim().toLowerCase() || "";
  return ACCEPTED_IMAGE_TYPES.has(mimeType) ? mimeType : "";
}

export function buildBannerPrompt(
  userPrompt: string,
  {
    hasCurrentImage,
    referenceLabels,
  }: {
    hasCurrentImage: boolean;
    referenceLabels: string[];
  },
) {
  const sourceLine = hasCurrentImage
    ? "The first attached image is the current banner. Iterate from it and preserve its successful composition unless the edit explicitly says otherwise."
    : referenceLabels.length
      ? "Create the banner using the uploaded reference images as visual source material."
      : "Create the banner from scratch.";
  const referenceLine = referenceLabels.length
    ? `Reference images are attached ${
        hasCurrentImage ? "after the current banner" : "in the input"
      } in this exact order: ${referenceLabels
        .map((label) => `Reference ${label}`)
        .join(", ")}. When the user's edit request mentions a reference label, use the matching attached image.`
    : "";

  return [
    sourceLine,
    referenceLine,
    "Create an X/Twitter profile header banner.",
    "The final export will be cropped to 1500x500 pixels, a 3:1 landscape header.",
    "Compose the banner so the central 3:1 crop still contains the complete intended design.",
    "The lower-left quiet zone is reserved for the profile picture overlap and must not contain anything important.",
    "The lower-right mobile action zone is reserved for X mobile Follow, Edit profile, Message, and action buttons and must not contain anything important.",
    "Do not place faces, logos, readable text, hands, products, key subject details, brand marks, signatures, or the visual punchline inside either quiet zone.",
    "Keep important faces, logos, text, signatures, and focal subjects away from the lower-left profile-photo collision zone.",
    "Treat the lower-left 34% width and lower 46% height as visually quiet space because the circular avatar overlaps there.",
    "Treat the lower-right 200x100 pixels as visually quiet space because mobile action buttons can overlay that area.",
    "Avoid placing critical details in the top 60 pixels or bottom 60 pixels because X may crop header edges on some displays.",
    "Make the composition feel intentional as a social profile banner, not a generic wallpaper.",
    `Edit request: ${userPrompt.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildProfilePrompt(
  userPrompt: string,
  {
    hasCurrentImage,
    referenceLabels,
  }: {
    hasCurrentImage: boolean;
    referenceLabels: string[];
  },
) {
  const sourceLine = hasCurrentImage
    ? "The first attached image is the current X profile picture. Iterate from it and preserve the person's identity, likeness, and strongest recognizable traits unless the edit explicitly says otherwise."
    : referenceLabels.length
      ? "Create the X profile picture using the uploaded reference images as visual source material."
      : "Create the X profile picture from scratch.";
  const referenceLine = referenceLabels.length
    ? `Reference images are attached ${
        hasCurrentImage ? "after the current profile picture" : "in the input"
      } in this exact order: ${referenceLabels
        .map((label) => `Reference ${label}`)
        .join(", ")}. When the user's edit request mentions a reference label, use the matching attached image.`
    : "";

  return [
    sourceLine,
    referenceLine,
    "Create an X/Twitter profile picture avatar.",
    "The final export is a square image and will be displayed as a circle on X.",
    "Keep the face, logo, or primary subject centered with comfortable breathing room.",
    "Avoid placing important details, readable text, logos, hands, signatures, or tiny features near the extreme corners because the circular crop can hide them.",
    "Make the image readable at small avatar sizes, with strong contrast and a clean silhouette.",
    "Do not design this as a header banner, landscape wallpaper, or wide composition.",
    `Edit request: ${userPrompt.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPrompt(
  target: Target,
  userPrompt: string,
  options: {
    hasCurrentImage: boolean;
    referenceLabels: string[];
  },
) {
  return target === "profile"
    ? buildProfilePrompt(userPrompt, options)
    : buildBannerPrompt(userPrompt, options);
}

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown-ip";

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown-ip"
  );
}

export function getSigningSecret() {
  return (
    process.env.CANVAKILLA_SESSION_SECRET ||
    process.env.OPENROUTER_API_KEY ||
    "canvakilla-local-development-secret"
  );
}

export function signSessionId(sessionId: string) {
  return createHmac("sha256", getSigningSecret())
    .update(sessionId)
    .digest("base64url");
}

export function parseCookies(cookieHeader: string | null) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const item of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (!rawName || !rawValue.length) continue;
    cookies.set(rawName, rawValue.join("="));
  }

  return cookies;
}

export function verifySessionCookie(value?: string) {
  if (!value) return "";
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature || !/^[a-zA-Z0-9_-]{16,96}$/.test(sessionId)) {
    return "";
  }

  const expected = signSessionId(sessionId);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return "";

  return timingSafeEqual(expectedBuffer, signatureBuffer) ? sessionId : "";
}

function getSessionIdentity(request: Request): SessionIdentity {
  const cookies = parseCookies(request.headers.get("cookie"));
  const existingId = verifySessionCookie(cookies.get(SESSION_COOKIE_NAME));
  if (existingId) return { id: existingId };

  const id = randomBytes(18).toString("base64url");
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    id,
    setCookie: `${SESSION_COOKIE_NAME}=${id}.${signSessionId(
      id,
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}${secure}`,
  };
}

function withSessionCookie<T extends NextResponse>(
  response: T,
  session: SessionIdentity,
) {
  if (session.setCookie) response.headers.append("Set-Cookie", session.setCookie);
  return response;
}

export function getLimit(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pruneRateBuckets(now: number) {
  if (now - lastRateCleanupAt < 60_000) return;
  lastRateCleanupAt = now;

  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.hourStartedAt > 3_900_000) {
      rateBuckets.delete(key);
    }
  }
}

function checkRateLimit(
  clientKey: string,
  {
    minuteLimit,
    hourLimit,
  }: {
    minuteLimit: number;
    hourLimit: number;
  },
): LimitCheck {
  const now = Date.now();
  pruneRateBuckets(now);
  const bucket =
    rateBuckets.get(clientKey) ||
    ({
      minuteStartedAt: now,
      minuteCount: 0,
      hourStartedAt: now,
      hourCount: 0,
    } satisfies RateBucket);

  if (now - bucket.minuteStartedAt >= 60_000) {
    bucket.minuteStartedAt = now;
    bucket.minuteCount = 0;
  }

  if (now - bucket.hourStartedAt >= 3_600_000) {
    bucket.hourStartedAt = now;
    bucket.hourCount = 0;
  }

  if (bucket.minuteCount >= minuteLimit) {
    return {
      ok: false,
      resetSeconds: Math.max(1, Math.ceil((60_000 - (now - bucket.minuteStartedAt)) / 1000)),
      message: `Too many generations. Try again in about ${Math.ceil(
        (60_000 - (now - bucket.minuteStartedAt)) / 1000,
      )} seconds.`,
    };
  }

  if (bucket.hourCount >= hourLimit) {
    return {
      ok: false,
      resetSeconds: Math.max(
        1,
        Math.ceil((3_600_000 - (now - bucket.hourStartedAt)) / 1000),
      ),
      message: "Hourly generation limit reached. Try again later.",
    };
  }

  bucket.minuteCount += 1;
  bucket.hourCount += 1;
  rateBuckets.set(clientKey, bucket);

  return {
    ok: true,
    resetSeconds: 0,
    message: "",
  };
}

async function fileToDataUrl(file: File) {
  const imageBuffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type || "image/png"};base64,${imageBuffer.toString("base64")}`;
}

async function readCappedResponseBody(response: Response) {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PROVIDER_IMAGE_BYTES) {
      throw new Error("Provider image was too large.");
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_PROVIDER_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("Provider image was too large.");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export function isPrivateIp(ip: string) {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith("169.254.")) return true;
  if (/^(fc|fd)/i.test(ip)) return true;
  return false;
}

async function assertSafeProviderUrl(imageUrl: string) {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:") {
    throw new Error("Provider image URL was not secure.");
  }

  const hostType = isIP(url.hostname);
  if (hostType && isPrivateIp(url.hostname)) {
    throw new Error("Provider image URL was not allowed.");
  }

  if (!hostType) {
    const records = await lookup(url.hostname, { all: true, verbatim: true });
    if (records.some((record) => isPrivateIp(record.address))) {
      throw new Error("Provider image URL was not allowed.");
    }
  }
}

export function getTextNote(message?: OpenRouterMessage) {
  if (!message) return "";

  if (typeof message.content === "string") return message.content;
  if (!Array.isArray(message.content)) return "";

  return message.content
    .map((part) => {
      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function findImageUrl(payload: OpenRouterPayload) {
  const message = payload.choices?.[0]?.message;
  const candidates: unknown[] = [];

  if (Array.isArray(message?.images)) candidates.push(...message.images);
  if (Array.isArray(message?.content)) candidates.push(...message.content);
  if (typeof message?.content === "string") candidates.push(message.content);

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const match = candidate.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
      if (match) return match[0];
      continue;
    }

    if (!candidate || typeof candidate !== "object") continue;

    const imageCandidate = candidate as OpenRouterImage;
    const url =
      imageCandidate.image_url?.url ||
      imageCandidate.imageUrl?.url ||
      imageCandidate.url;

    if (url) return url;
  }

  return "";
}

async function imageUrlToBase64Result(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);

    if (!match) {
      throw new Error("OpenRouter returned an unreadable image data URI.");
    }

    const mimeType = getSafeImageMimeType(match[1]);
    const imageBuffer = Buffer.from(match[2], "base64");
    if (!mimeType || imageBuffer.length > MAX_PROVIDER_IMAGE_BYTES) {
      throw new Error("OpenRouter returned an unsupported image.");
    }

    return {
      imageBase64: match[2],
      mimeType,
    };
  }

  await assertSafeProviderUrl(imageUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_FETCH_TIMEOUT_MS);

  const response = await fetch(imageUrl, {
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error("OpenRouter returned an image URL that could not be fetched.");
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const mimeType = getSafeImageMimeType(contentType);
  const contentLength = Number.parseInt(
    response.headers.get("content-length") || "",
    10,
  );

  if (!mimeType || contentLength > MAX_PROVIDER_IMAGE_BYTES) {
    throw new Error("OpenRouter returned an unsupported image.");
  }

  const imageBuffer = await readCappedResponseBody(response);

  return {
    imageBase64: imageBuffer.toString("base64"),
    mimeType,
  };
}

async function generateWithOpenRouter({
  images,
  model,
  prompt,
  referenceLabels,
  target,
  distinctId,
}: {
  images: ImageInput[];
  model: ModelId;
  prompt: string;
  referenceLabels: string[];
  target: Target;
  distinctId: string;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Image generation is temporarily unavailable." },
      { status: 500 },
    );
  }

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: buildPrompt(target, prompt, {
        hasCurrentImage: images.some((image) => image.label === "current"),
        referenceLabels,
      }),
    },
  ];

  for (const image of images) {
    content.push({
      type: "text",
      text:
        image.label === "current"
          ? `Current ${target} image follows.`
          : `Reference ${image.label || "image"} follows.`,
    });
    content.push({
      type: "image_url",
      image_url: {
        url: await fileToDataUrl(image.file),
      },
    });
  }

  try {
    const imageConfig = getImageConfig(model, target);
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "CanvaKilla.com",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content,
          },
        ],
        modalities: ["image", "text"],
        ...(imageConfig ? { image_config: imageConfig } : {}),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as OpenRouterPayload;

    if (!response.ok) {
      throw new Error(
        payload?.error?.message ||
          payload?.message ||
          "The OpenRouter image request failed.",
      );
    }

    const imageUrl = findImageUrl(payload);
    if (!imageUrl) {
      throw new Error(
        getTextNote(payload.choices?.[0]?.message) ||
          "OpenRouter did not return an image for this prompt.",
      );
    }

    const result = await imageUrlToBase64Result(imageUrl);

    captureServerEvent({
      distinctId,
      event: "image_generation_completed",
      properties: {
        model,
        target,
        has_current_image: images.some((image) => image.label === "current"),
        reference_count: images.filter((image) => image.label !== "current").length,
      },
    });

    return NextResponse.json({
      ...result,
      model,
      note: getTextNote(payload.choices?.[0]?.message),
      provider: "openrouter",
      usage: payload.usage || null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Image generation failed. Try a smaller image or a different prompt.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = getSessionIdentity(request);
  const contentLength = Number.parseInt(request.headers.get("content-length") || "", 10);

  if (contentLength > MAX_REQUEST_BYTES) {
    return withSessionCookie(
      NextResponse.json(
        { error: "Keep total uploads under 32MB for each generation." },
        { status: 413 },
      ),
      session,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return withSessionCookie(
      NextResponse.json(
        { error: "Could not read that upload. Try smaller PNG, JPEG, WebP, or GIF files." },
        { status: 400 },
      ),
      session,
    );
  }
  const prompt = String(formData.get("prompt") || "").trim();
  const requestedTarget = String(formData.get("target") || "banner");
  const target: Target = requestedTarget === "profile" ? "profile" : "banner";
  const model = normalizeModelId(String(formData.get("model") || DEFAULT_MODEL));
  const requestIp = getRequestIp(request);
  const sessionKey = `session:${session.id}`;
  const ipKey = `ip:${requestIp}`;
  const currentImage = formData.get("currentImage");
  const referenceImages = formData
    .getAll("referenceImages")
    .filter((image): image is File => image instanceof File && image.size > 0);
  const referenceLabels = formData
    .getAll("referenceLabels")
    .map((label) => String(label))
    .slice(0, Math.min(referenceImages.length, MAX_REFERENCE_IMAGES_PER_RUN));

  if (!prompt) {
    return withSessionCookie(
      NextResponse.json(
        { error: "Add an edit prompt before generating." },
        { status: 400 },
      ),
      session,
    );
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return withSessionCookie(
      NextResponse.json(
        { error: `Keep prompts under ${MAX_PROMPT_CHARS.toLocaleString()} characters.` },
        { status: 400 },
      ),
      session,
    );
  }

  if (referenceImages.length > MAX_REFERENCE_IMAGES_PER_RUN) {
    return withSessionCookie(
      NextResponse.json(
        { error: `Send at most ${MAX_REFERENCE_IMAGES_PER_RUN} references per run.` },
        { status: 400 },
      ),
      session,
    );
  }

  const images: ImageInput[] = [];

  if (currentImage instanceof File && currentImage.size > 0) {
    images.push({ file: currentImage, label: "current" });
  }

  referenceImages.forEach((file, index) => {
    images.push({ file, label: referenceLabels[index] || `R${index + 1}` });
  });

  const totalImageBytes = images.reduce((total, image) => total + image.file.size, 0);
  if (totalImageBytes > MAX_TOTAL_SOURCE_IMAGE_BYTES) {
    return withSessionCookie(
      NextResponse.json(
        { error: "Keep all source images under 32MB total for each generation." },
        { status: 400 },
      ),
      session,
    );
  }

  for (const image of images) {
    if (!ACCEPTED_IMAGE_TYPES.has(image.file.type)) {
      return withSessionCookie(
        NextResponse.json(
          { error: "Upload a PNG, JPEG, WebP, or GIF image." },
          { status: 400 },
        ),
        session,
      );
    }

    if (image.file.size > MAX_SOURCE_IMAGE_BYTES) {
      return withSessionCookie(
        NextResponse.json(
          { error: "Keep each source image under 8MB." },
          { status: 400 },
        ),
        session,
      );
    }
  }

  const maxActiveGenerations = getLimit(
    "MAX_ACTIVE_GENERATIONS",
    DEFAULT_MAX_ACTIVE_GENERATIONS,
  );

  if (activeGenerations.size >= maxActiveGenerations) {
    return withSessionCookie(
      NextResponse.json(
        { error: "CanvaKilla is busy. Try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
      session,
    );
  }

  if (activeGenerations.has(sessionKey) || activeGenerations.has(ipKey)) {
    return withSessionCookie(
      NextResponse.json(
        { error: "A generation is already running for this browser or network." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
      session,
    );
  }

  const ipRateLimit = checkRateLimit(ipKey, {
    minuteLimit: getLimit("GENERATION_IP_RATE_LIMIT_PER_MINUTE", DEFAULT_IP_MINUTE_LIMIT),
    hourLimit: getLimit("GENERATION_IP_RATE_LIMIT_PER_HOUR", DEFAULT_IP_HOUR_LIMIT),
  });

  const rateLimit = ipRateLimit.ok
    ? checkRateLimit(sessionKey, {
        minuteLimit: getLimit(
          "GENERATION_RATE_LIMIT_PER_MINUTE",
          DEFAULT_MINUTE_LIMIT,
        ),
        hourLimit: getLimit("GENERATION_RATE_LIMIT_PER_HOUR", DEFAULT_HOUR_LIMIT),
      })
    : ipRateLimit;

  if (!rateLimit.ok) {
    captureServerEvent({
      distinctId: session.id,
      event: "generation_rate_limited",
      properties: {
        model,
        target,
        reason: rateLimit.resetSeconds <= 60 ? "minute" : "hour",
        reset_seconds: rateLimit.resetSeconds,
      },
    });
    return withSessionCookie(
      NextResponse.json(
        { error: rateLimit.message },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.resetSeconds),
          },
        },
      ),
      session,
    );
  }

  activeGenerations.add(sessionKey);
  activeGenerations.add(ipKey);

  try {
    const response = await generateWithOpenRouter({
      images,
      model,
      prompt,
      referenceLabels,
      target,
      distinctId: session.id,
    });
    return withSessionCookie(response, session);
  } finally {
    activeGenerations.delete(sessionKey);
    activeGenerations.delete(ipKey);
  }
}
