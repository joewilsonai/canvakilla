import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeReferenceLabel,
  normalizeReferenceLabels,
} from "../lib/generation-request.ts";

test("preserves clicked reference labels from the client", () => {
  assert.deepEqual(normalizeReferenceLabels(["R7", "R3", "R12"], 3), [
    "R7",
    "R3",
    "R12",
  ]);
});

test("falls back to positional labels for missing or invalid labels", () => {
  assert.deepEqual(
    normalizeReferenceLabels(["R4", "bad label", "", undefined], 4),
    ["R4", "R2", "R3", "R4"],
  );
});

test("ignores extra labels beyond the attached reference count", () => {
  assert.deepEqual(normalizeReferenceLabels(["R9", "R8", "R7"], 1), ["R9"]);
});

test("rejects labels that are not simple R-number references", () => {
  assert.equal(normalizeReferenceLabel("Reference R7", 0), "R1");
  assert.equal(normalizeReferenceLabel("R1000", 1), "R2");
  assert.equal(normalizeReferenceLabel(" R22 ", 2), "R22");
});
