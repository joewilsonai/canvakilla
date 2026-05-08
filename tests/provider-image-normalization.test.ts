import assert from "node:assert/strict";
import test from "node:test";
import { getProviderImageValidationPolicy } from "../lib/provider-image-normalization.ts";

test("validates provider source images for safety before enforcing final crop shape", () => {
  assert.equal(
    getProviderImageValidationPolicy("provider-source").enforceTargetAspectRatio,
    false,
  );
  assert.equal(
    getProviderImageValidationPolicy("normalized-output").enforceTargetAspectRatio,
    true,
  );
});
