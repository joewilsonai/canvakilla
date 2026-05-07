import assert from "node:assert/strict";
import test from "node:test";
import { getPublicGenerationErrorMessage } from "../lib/generation-errors.ts";

test("does not expose provider auth/internal messages to the browser", () => {
  const message = getPublicGenerationErrorMessage({
    code: "openrouter_request_failed",
    status: 403,
  });

  assert.equal(message, "Image generation is temporarily unavailable.");
  assert.doesNotMatch(message, /user not found|openrouter|api key/i);
});

test("maps provider rate limits to an actionable public message", () => {
  assert.equal(
    getPublicGenerationErrorMessage({
      code: "openrouter_retryable",
      status: 429,
    }),
    "The image provider is busy. Try again in a minute or switch models.",
  );
});

test("maps no-image responses without leaking provider text", () => {
  assert.equal(
    getPublicGenerationErrorMessage({
      code: "openrouter_no_image",
      status: 502,
    }),
    "The image provider did not return an image. Try a more direct prompt or a different model.",
  );
});
