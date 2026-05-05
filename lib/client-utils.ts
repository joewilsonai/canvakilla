export const MODELS: { id: string; label: string }[] = [
  {
    id: "openai/gpt-5.4-image-2",
    label: "GPT Image 2",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
  },
  {
    id: "google/gemini-2.5-flash-image",
    label: "Nano Banana",
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
  },
] ;

export const LEGACY_MODEL_IDS: Record<string, string> = {
  "gpt-image-2": "openai/gpt-5.4-image-2",
  "gemini-3.1-flash-image-preview": "google/gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image": "google/gemini-2.5-flash-image",
  "gemini-3-pro-image-preview": "google/gemini-3-pro-image-preview",
};

export type ReferenceItem = {
  id: string;
  image: string;
  name: string;
  label: string;
  createdAt: string;
};

/** Maps a possibly-legacy model ID to the canonical model ID. */
export function normalizeModelId(modelId: string): string {
  const nextModel = LEGACY_MODEL_IDS[modelId] || modelId;
  return MODELS.some((item) => item.id === nextModel) ? nextModel : MODELS[0].id;
}

/**
 * Returns the highest numeric suffix seen across all reference labels
 * (e.g. "R3" → 3) so the next label can be R(n+1).
 */
export function getNextReferenceNumber(references: ReferenceItem[]): number {
  return references.reduce((max, reference) => {
    const number = Number(reference.label.replace(/^R/, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
}

/** Estimates the byte-size of a base64-encoded data URL. */
export function getDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}
