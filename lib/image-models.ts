import type { PlatformId } from "./platforms/types.ts";

export const DEFAULT_IMAGE_MODEL_ID = "google/gemini-3.1-flash-image-preview";
export const DEFAULT_IMAGE_MODEL_FETCH_TIMEOUT_MS = 70_000;

export const IMAGE_MODEL_CONFIGS = {
  "google/gemini-3.1-flash-image-preview": {
    bannerAspectRatio: "21:9",
    costWeight: 2,
    imageSize: "2K",
    label: "Nano Banana 2",
    platformBannerAspectRatios: {
      linkedin: "4:1",
    },
    profileAspectRatio: "1:1",
  },
  "google/gemini-3-pro-image-preview": {
    bannerAspectRatio: "21:9",
    costWeight: 8,
    imageSize: "2K",
    label: "Nano Banana Pro",
    profileAspectRatio: "1:1",
  },
  "openai/gpt-5.4-image-2": {
    bannerAspectRatio: "21:9",
    costWeight: 4,
    fetchTimeoutMs: 180_000,
    label: "GPT Image 2",
    profileAspectRatio: "1:1",
  },
  "google/gemini-2.5-flash-image": {
    bannerAspectRatio: null,
    costWeight: 1,
    label: "Nano Banana",
    profileAspectRatio: "1:1",
  },
} as const;

export type ImageModelId = keyof typeof IMAGE_MODEL_CONFIGS;

export const IMAGE_MODEL_OPTIONS = Object.entries(IMAGE_MODEL_CONFIGS).map(
  ([id, config]) => ({
    id: id as ImageModelId,
    label: config.label,
  }),
);

export const LEGACY_IMAGE_MODEL_IDS: Record<string, ImageModelId> = {
  "gpt-image-2": "openai/gpt-5.4-image-2",
  "gemini-3.1-flash-image-preview": "google/gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image": "google/gemini-2.5-flash-image",
  "gemini-3-pro-image-preview": "google/gemini-3-pro-image-preview",
};

export function normalizeImageModelId(model: string): ImageModelId {
  if (model in IMAGE_MODEL_CONFIGS) return model as ImageModelId;
  return LEGACY_IMAGE_MODEL_IDS[model] || DEFAULT_IMAGE_MODEL_ID;
}

export function getImageModelCost(model: ImageModelId, imageCount: number) {
  const referenceCost = Math.max(0, imageCount - 1);
  return IMAGE_MODEL_CONFIGS[model].costWeight + referenceCost;
}

export function getImageModelFetchTimeoutMs(model: ImageModelId) {
  const config = IMAGE_MODEL_CONFIGS[model] as { fetchTimeoutMs?: number };
  return config.fetchTimeoutMs || DEFAULT_IMAGE_MODEL_FETCH_TIMEOUT_MS;
}

export function getImageModelAspectRatio(
  model: ImageModelId,
  target: "banner" | "profile",
  platform: PlatformId,
) {
  const config = IMAGE_MODEL_CONFIGS[model];
  if (target === "profile") return config.profileAspectRatio;
  const platformAspectRatios =
    ("platformBannerAspectRatios" in config
      ? config.platformBannerAspectRatios
      : {}) as Partial<Record<PlatformId, string | null>>;

  return platformAspectRatios[platform] ?? config.bannerAspectRatio;
}
