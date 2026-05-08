import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldAttachTemplateGuideImageForRun,
  shouldRetryWithoutTemplateGuideImage,
} from "../lib/template-guide-policy.ts";

test("prompt-only generations do not attach the internal template guide image", () => {
  assert.equal(shouldAttachTemplateGuideImageForRun(0), false);
  assert.equal(shouldAttachTemplateGuideImageForRun(1), true);
});

test("guide-image provider rejections are retried without the guide image", () => {
  assert.equal(shouldRetryWithoutTemplateGuideImage(400), true);
  assert.equal(shouldRetryWithoutTemplateGuideImage(413), true);
  assert.equal(shouldRetryWithoutTemplateGuideImage(422), true);
  assert.equal(shouldRetryWithoutTemplateGuideImage(401), false);
  assert.equal(shouldRetryWithoutTemplateGuideImage(429), false);
  assert.equal(shouldRetryWithoutTemplateGuideImage(500), false);
});
