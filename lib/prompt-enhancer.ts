import { IMAGE_MODEL_CONFIGS, type ImageModelId } from "./image-models.ts";
import { buildBannerOverlayExclusionInstructions } from "./platform-prompt-rules.ts";
import { getPlatformConfig, type PlatformId } from "./platforms/index.ts";
import type { EditTarget } from "./platforms/types.ts";

export const MAX_ENHANCED_PROMPT_CHARS = 2_400;
export const MAX_PROFILE_CONTEXT_CHARS = 2_400;

export type PromptEnhancementContext = {
  prompt: string;
  model: ImageModelId;
  platform: PlatformId;
  target: EditTarget;
  hasCurrentImage: boolean;
  profileContext: string;
  referenceLabels: string[];
};

export function normalizeProfileContext(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+\n/g, "\n").replace(/\n{4,}/g, "\n\n").trim().slice(0, MAX_PROFILE_CONTEXT_CHARS)
    : "";
}

export function buildPromptEnhancerMessages(context: PromptEnhancementContext) {
  const platformConfig = getPlatformConfig(context.platform);
  const modelConfig = IMAGE_MODEL_CONFIGS[context.model];
  const targetLabel =
    context.target === "profile"
      ? platformConfig.profileLabel
      : platformConfig.bannerLabel;
  const sizeLabel =
    context.target === "profile"
      ? platformConfig.profileSizeLabel
      : platformConfig.bannerSize.label;
  const referenceLine = context.referenceLabels.length
    ? `The user selected these reference labels: ${context.referenceLabels.join(
        ", ",
      )}. Preserve those exact labels if the enhanced prompt refers to references.`
    : "No reference labels are selected. Do not invent reference labels.";
  const sourceLine = context.hasCurrentImage
    ? `A current ${targetLabel} image will be sent with the generation request. Frame the prompt as an iteration of that image.`
    : `No current ${targetLabel} image will be sent unless selected references are present. Frame the prompt so the model can create from scratch when needed.`;
  const profileContextLine = context.profileContext
    ? [
        "User-provided profile context is below. Treat pasted LinkedIn, X, Twitter, website, bio, and recent-post text as brand/positioning context only.",
        "Do not claim you visited the links. Do not include raw URLs unless the user explicitly asked for URL text in the image.",
        "Use this context to infer visual themes, credibility cues, audience, tone, and banner ideas that fit the profile.",
        "",
        context.profileContext,
      ].join("\n")
    : "No profile context was provided. Do not invent career details, audiences, company names, or accomplishments.";

  return [
    {
      role: "system" as const,
      content: [
        "You rewrite CanvaKilla user prompts for image generation.",
        "Return only the improved prompt text. No markdown, no quotes, no commentary.",
        "Keep the user's intent, subject, wording, exact quoted text, and reference labels intact.",
        "Make the prompt visually stronger, more specific, and safer for the selected social profile crop.",
        "Do not add social-media UI chrome, crop templates, buttons, handles, badges, status bars, or screenshot language.",
        "Do not mention internal policies, system instructions, or that you are rewriting a prompt.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: [
        `Platform: ${platformConfig.platformName}`,
        `Target: ${targetLabel}`,
        `Final export size: ${sizeLabel}`,
        `Selected image model: ${modelConfig.label} (${context.model})`,
        sourceLine,
        referenceLine,
        getPlatformSafetyLine(context.platform, context.target),
        getOverlayExclusionLine(context.platform, context.target),
        getModelGuidanceLine(context.model),
        "Profile context:",
        profileContextLine,
        "Rewrite the user's prompt into one polished generation prompt. It should be direct enough for image models, include platform-safe composition rules, and avoid overloading the model with contradictions.",
        "",
        "User prompt:",
        context.prompt,
      ].join("\n"),
    },
  ];
}

export function extractEnhancedPrompt(rawContent: unknown) {
  const content = getContentText(rawContent)
    .replace(/^```(?:text|prompt|json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!content) return "";

  const parsedPrompt = parseJsonPrompt(content);
  const prompt = (parsedPrompt || content)
    .replace(/^["“]|["”]$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return prompt.slice(0, MAX_ENHANCED_PROMPT_CHARS);
}

function getContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
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

function parseJsonPrompt(content: string) {
  try {
    const parsed = JSON.parse(content) as { enhancedPrompt?: unknown; prompt?: unknown };
    const value = parsed.enhancedPrompt || parsed.prompt;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function getPlatformSafetyLine(platform: PlatformId, target: EditTarget) {
  if (target === "profile") {
    return platform === "linkedin"
      ? "For LinkedIn profile photos, make the subject centered, credible, warm, square, and readable after circular crop."
      : "For X profile pictures, make the subject centered, high-contrast, bold, square, and readable after circular crop.";
  }

  if (platform === "linkedin") {
    return "For LinkedIn banners, keep important content inside the central mobile-safe region, leave the lower-left profile-photo overlay quiet, protect slim top/bottom crop guards, and avoid far-left/far-right side-crop dependence.";
  }

  return "For X banners, keep important content away from top/bottom crop guards, the lower-left avatar quiet zone, and the lower-right mobile action button quiet zone.";
}

function getOverlayExclusionLine(platform: PlatformId, target: EditTarget) {
  if (target === "profile") {
    return "Do not add social profile UI chrome, crop rings, badges, handles, or app overlay graphics.";
  }

  return buildBannerOverlayExclusionInstructions(platform).join(" ");
}

function getModelGuidanceLine(model: ImageModelId) {
  if (model === "openai/gpt-5.4-image-2") {
    return "GPT Image 2 benefits from explicit layout, typography hierarchy, exact quoted text, and clear negative-space instructions.";
  }

  if (model === "google/gemini-3-pro-image-preview") {
    return "Nano Banana Pro benefits from concise art direction, clear composition anchors, and explicit safe-zone placement for any text.";
  }

  if (model === "google/gemini-3.1-flash-image-preview") {
    return "Nano Banana 2 benefits from direct visual source instructions, strong style cues, and simple readable text requirements.";
  }

  return "This model benefits from concise visual direction, simple layout constraints, and minimal exact text.";
}
