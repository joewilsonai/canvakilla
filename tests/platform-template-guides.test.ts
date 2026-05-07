import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  buildTemplateGuideImage,
  getTemplateGuideDescription,
  getTemplateGuideImageCount,
} from "../lib/platform-template-guides.ts";

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  assert.ok(match, "guide should be a PNG data URL");
  return Buffer.from(match[1], "base64");
}

test("builds exact platform-sized banner template guides", async () => {
  const linkedinGuide = await buildTemplateGuideImage("linkedin", "banner");
  const xGuide = await buildTemplateGuideImage("x", "banner");
  const linkedinMetadata = await sharp(decodeDataUrl(linkedinGuide.dataUrl)).metadata();
  const xMetadata = await sharp(decodeDataUrl(xGuide.dataUrl)).metadata();

  assert.equal(linkedinMetadata.format, "png");
  assert.equal(linkedinMetadata.width, 1584);
  assert.equal(linkedinMetadata.height, 396);
  assert.equal(xMetadata.width, 1500);
  assert.equal(xMetadata.height, 500);
});

test("builds circular profile template guide", async () => {
  const profileGuide = await buildTemplateGuideImage("linkedin", "profile");
  const metadata = await sharp(decodeDataUrl(profileGuide.dataUrl)).metadata();

  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  assert.equal(getTemplateGuideImageCount(), 1);
});

test("template guide text warns models not to render the guide", () => {
  const bannerDescription = getTemplateGuideDescription("x", "banner");
  const profileDescription = getTemplateGuideDescription("linkedin", "profile");

  assert.match(bannerDescription, /spatial map/i);
  assert.match(bannerDescription, /Do not reproduce/i);
  assert.match(profileDescription, /circle/i);
  assert.match(profileDescription, /Do not reproduce/i);
});
