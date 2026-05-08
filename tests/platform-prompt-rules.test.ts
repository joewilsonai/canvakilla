import assert from "node:assert/strict";
import test from "node:test";
import { buildBannerTypographyInstructions } from "../lib/platform-prompt-rules.ts";

test("LinkedIn typography rules override absolute right-edge placement", () => {
  const rules = buildBannerTypographyInstructions("linkedin").join("\n");

  assert.match(rules, /top-right, right side, or bottom-right/i);
  assert.match(rules, /central mobile-safe area/i);
  assert.match(rules, /x=420 to x=1320/i);
  assert.match(rules, /right edge no farther than x=1320/i);
  assert.match(rules, /top-right pencil\/edit button/i);
});

test("X typography rules still protect the mobile action quiet zone", () => {
  const rules = buildBannerTypographyInstructions("x").join("\n");

  assert.match(rules, /mobile action button quiet zone/i);
  assert.doesNotMatch(rules, /x=420 to x=1320/i);
});
