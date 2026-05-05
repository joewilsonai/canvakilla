import { NextResponse } from "next/server";
import { captureServerEvent } from "../../../lib/posthog-server";

export const runtime = "nodejs";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3.1-flash-image-preview";
const MAX_REFERENCE_IMAGES_PER_RUN = 12;
const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;
const DEFAULT_MINUTE_LIMIT = 4;
const DEFAULT_HOUR_LIMIT = 20;

const MODEL_CONFIGS = {
  "openai/gpt-5.4-image-2": {
    label: "GPT Image 2",
    bannerAspectRatio: "3:1",
    profileAspectRatio: "1:1",
  },
  "google/gemini-3.1-flash-image-preview": {
    label: "Nano Banana 2",
    bannerAspectRatio: "4:1",
    profileAspectRatio: "1:1",
    imageSize: "2K",
  },
  "google/gemini-2.5-flash-image": {
    label: "Nano Banana",
    bannerAspectRatio: "21:9",
    profileAspectRatio: "1:1",
  },
  "google/gemini-3-pro-image-preview": {
    label: "Nano Banana Pro",
    bannerAspectRatio: "21:9",
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

function normalizeModelId(model: string): ModelId {
  if (model in MODEL_CONFIGS) return model as ModelId;
  return LEGACY_MODEL_IDS[model] || DEFAULT_MODEL;
}

function getAspectRatio(model: ModelId, target: Target) {
  const config = MODEL_CONFIGS[model];
  return target === "profile" ? config.profileAspectRatio : config.bannerAspectRatio;
}

function getImageConfig(model: ModelId, target: Target) {
  const config = MODEL_CONFIGS[model];
  const imageConfig: {
    aspect_ratio: string;
    image_size?: string;
  } = {
    aspect_ratio: getAspectRatio(model, target),
  };

  if ("imageSize" in config) {
    imageConfig.image_size = config.imageSize;
  }

  return imageConfig;
}

function buildBannerPrompt(
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

function buildProfilePrompt(
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

function buildPrompt(
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

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown-ip";

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown-ip"
  );
}

function getSessionId(formData: FormData, request: Request) {
  return (
    String(
      formData.get("sessionId") ||
        request.headers.get("x-canvakilla-session") ||
        "anonymous",
    )
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 96) || "anonymous"
  );
}

function getLimit(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function checkRateLimit(clientKey: string) {
  const now = Date.now();
  const minuteLimit = getLimit(
    "GENERATION_RATE_LIMIT_PER_MINUTE",
    DEFAULT_MINUTE_LIMIT,
  );
  const hourLimit = getLimit("GENERATION_RATE_LIMIT_PER_HOUR", DEFAULT_HOUR_LIMIT);
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

function getTextNote(message?: OpenRouterMessage) {
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

function findImageUrl(payload: OpenRouterPayload) {
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

    return {
      imageBase64: match[2],
      mimeType: match[1],
    };
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("OpenRouter returned an image URL that could not be fetched.");
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  return {
    imageBase64: imageBuffer.toString("base64"),
    mimeType: contentType,
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
      { error: "Missing OPENROUTER_API_KEY in the server environment." },
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
      type: "image_url",
      image_url: {
        url: await fileToDataUrl(image.file),
      },
    });
  }

  try {
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
        image_config: getImageConfig(model, target),
      }),
    });
    const payload = (await response.json()) as OpenRouterPayload;

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
        error:
          error instanceof Error
            ? error.message
            : "The OpenRouter image request failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const prompt = String(formData.get("prompt") || "").trim();
  const requestedTarget = String(formData.get("target") || "banner");
  const target: Target = requestedTarget === "profile" ? "profile" : "banner";
  const model = normalizeModelId(String(formData.get("model") || DEFAULT_MODEL));
  const sessionId = getSessionId(formData, request);
  const clientKey = `${getRequestIp(request)}:${sessionId}`;
  const currentImage = formData.get("currentImage");
  const referenceImages = formData
    .getAll("referenceImages")
    .filter((image): image is File => image instanceof File && image.size > 0)
    .slice(0, MAX_REFERENCE_IMAGES_PER_RUN);
  const referenceLabels = formData
    .getAll("referenceLabels")
    .map((label) => String(label))
    .slice(0, referenceImages.length);

  if (!prompt) {
    return NextResponse.json(
      { error: "Add an edit prompt before generating." },
      { status: 400 },
    );
  }

  const images: ImageInput[] = [];

  if (currentImage instanceof File && currentImage.size > 0) {
    images.push({ file: currentImage, label: "current" });
  }

  referenceImages.forEach((file, index) => {
    images.push({ file, label: referenceLabels[index] || `R${index + 1}` });
  });

  for (const image of images) {
    if (!image.file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Upload a PNG, JPEG, WebP, or GIF image." },
        { status: 400 },
      );
    }

    if (image.file.size > MAX_SOURCE_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Keep source images under 12MB." },
        { status: 400 },
      );
    }
  }

  if (activeGenerations.has(clientKey)) {
    return NextResponse.json(
      { error: "A generation is already running in this browser session." },
      { status: 429 },
    );
  }

  const rateLimit = checkRateLimit(clientKey);
  if (!rateLimit.ok) {
    captureServerEvent({
      distinctId: sessionId,
      event: "generation_rate_limited",
      properties: {
        model,
        target,
        reason: rateLimit.resetSeconds <= 60 ? "minute" : "hour",
        reset_seconds: rateLimit.resetSeconds,
      },
    });
    return NextResponse.json(
      { error: rateLimit.message },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.resetSeconds),
        },
      },
    );
  }

  activeGenerations.add(clientKey);

  try {
    return await generateWithOpenRouter({
      images,
      model,
      prompt,
      referenceLabels,
      target,
      distinctId: sessionId,
    });
  } finally {
    activeGenerations.delete(clientKey);
  }
}
