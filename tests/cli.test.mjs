import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultOutputPath,
  getHelp,
  normalizeBaseUrl,
  parseArgs,
} from "../lib/cli.mjs";

test("parses enhance command options and repeated references", () => {
  const parsed = parseArgs([
    "enhance",
    "--platform",
    "linkedin",
    "--target=banner",
    "--prompt",
    "make it premium",
    "--profile-context-file",
    "profile.txt",
    "--reference",
    "logo.png",
    "--reference",
    "headshot.jpg",
    "--template-guide",
    "--json",
  ]);

  assert.equal(parsed.command, "enhance");
  assert.equal(parsed.options.platform, "linkedin");
  assert.equal(parsed.options.target, "banner");
  assert.equal(parsed.options.prompt, "make it premium");
  assert.equal(parsed.options.profileContextFile, "profile.txt");
  assert.deepEqual(parsed.options.references, ["logo.png", "headshot.jpg"]);
  assert.equal(parsed.options.templateGuide, true);
  assert.equal(parsed.options.json, true);
});

test("normalizes API base URLs", () => {
  assert.equal(normalizeBaseUrl("https://canvakilla.com/"), "https://canvakilla.com");
  assert.equal(
    normalizeBaseUrl("http://localhost:3001/linkedin"),
    "http://localhost:3001/linkedin",
  );
});

test("chooses platform-sized default output paths", () => {
  assert.equal(
    getDefaultOutputPath({ platform: "linkedin", target: "banner" }),
    "linkedin-banner-1584x396.jpg",
  );
  assert.equal(
    getDefaultOutputPath({ platform: "x", target: "banner" }),
    "x-banner-1500x500.jpg",
  );
  assert.equal(
    getDefaultOutputPath({ platform: "linkedin", target: "profile" }),
    "linkedin-profile-1024x1024.jpg",
  );
});

test("prints command-specific help", () => {
  assert.match(getHelp("generate"), /canvakilla generate/);
  assert.match(getHelp("generate"), /--enhance/);
  assert.match(getHelp("generate"), /--template-guide/);
  assert.match(getHelp("enhance"), /--profile-context/);
});
