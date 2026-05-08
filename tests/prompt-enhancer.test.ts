import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPromptEnhancerMessages,
  extractEnhancedPrompt,
  normalizeProfileContext,
} from "../lib/prompt-enhancer.ts";

test("builds platform and model aware prompt enhancement instructions", () => {
  const messages = buildPromptEnhancerMessages({
    prompt: "Make it look premium using Reference R3.",
    model: "openai/gpt-5.4-image-2",
    platform: "linkedin",
    target: "banner",
    hasCurrentImage: true,
    profileContext:
      "https://www.linkedin.com/in/example\nFounder helping teams learn AI by doing.",
    referenceLabels: ["R3"],
  });
  const userMessage = messages[1]?.content || "";

  assert.match(userMessage, /LinkedIn/);
  assert.match(userMessage, /LinkedIn banner/);
  assert.match(userMessage, /GPT Image 2/);
  assert.match(userMessage, /Reference R3/);
  assert.match(userMessage, /Founder helping teams learn AI by doing/);
  assert.match(userMessage, /Do not claim you visited the links/);
  assert.match(userMessage, /central mobile-safe region/);
  assert.match(userMessage, /current LinkedIn banner image/);
});

test("extracts enhanced prompt text from plain text, fences, and JSON", () => {
  assert.equal(
    extractEnhancedPrompt("```text\nCreate a sharp banner.\n```"),
    "Create a sharp banner.",
  );
  assert.equal(
    extractEnhancedPrompt('{"enhancedPrompt":"Create a safe X banner."}'),
    "Create a safe X banner.",
  );
});

test("normalizes pasted profile context without requiring profile scraping", () => {
  const context = normalizeProfileContext(
    "  https://x.com/example  \n\n\n\nAI founder shipping tools.  ",
  );

  assert.equal(context, "https://x.com/example\nAI founder shipping tools.");
});
