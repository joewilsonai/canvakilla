export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

let warnedMissingOpenRouterKey = false;

export function sanitizeOpenRouterApiKey(value?: string) {
  return (value || "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "")
    .trim();
}

export function getOpenRouterApiKey() {
  const apiKey = sanitizeOpenRouterApiKey(
    process.env.OPENROUTER_API_KEY ||
      process.env.OPENROUTER_KEY ||
      process.env.OPENROUTER_TOKEN,
  );

  if (!apiKey && process.env.NODE_ENV === "production" && !warnedMissingOpenRouterKey) {
    warnedMissingOpenRouterKey = true;
    console.warn(
      "OPENROUTER_API_KEY missing in production; OpenRouter features are disabled.",
    );
  }

  return apiKey;
}
