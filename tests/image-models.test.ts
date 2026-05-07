import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IMAGE_MODEL_FETCH_TIMEOUT_MS,
  getImageModelFetchTimeoutMs,
  normalizeImageModelId,
} from "../lib/image-models.ts";

test("keeps legacy GPT Image 2 selector mapped to the OpenRouter image model", () => {
  assert.equal(normalizeImageModelId("gpt-image-2"), "openai/gpt-5.4-image-2");
});

test("gives slower GPT Image 2 requests a longer provider timeout", () => {
  assert.equal(
    getImageModelFetchTimeoutMs("google/gemini-3.1-flash-image-preview"),
    DEFAULT_IMAGE_MODEL_FETCH_TIMEOUT_MS,
  );
  assert.equal(getImageModelFetchTimeoutMs("openai/gpt-5.4-image-2"), 180_000);
});
