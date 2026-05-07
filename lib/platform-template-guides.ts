import sharp from "sharp";
import type { EditTarget, PlatformId } from "./platforms/types.ts";

type TemplateGuideImage = {
  dataUrl: string;
  description: string;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  opacity: number;
  stroke?: string;
};

function rect({ x, y, width, height, fill, opacity, stroke }: Rect) {
  const strokeAttributes = stroke
    ? ` stroke="${stroke}" stroke-width="6" stroke-dasharray="18 12"`
    : "";

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" opacity="${opacity}"${strokeAttributes} />`;
}

function circle({
  cx,
  cy,
  fill,
  opacity,
  r,
  stroke,
}: {
  cx: number;
  cy: number;
  fill: string;
  opacity: number;
  r: number;
  stroke?: string;
}) {
  const strokeAttributes = stroke
    ? ` stroke="${stroke}" stroke-width="7" stroke-dasharray="18 12"`
    : "";

  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"${strokeAttributes} />`;
}

function buildLinkedInBannerGuideSvg() {
  const width = 1584;
  const height = 396;
  const sideCropWidth = 192;
  const cropGuardHeight = 30;
  const profileRadius = 150;
  const profileCenterX = 198;
  const profileCenterY = 360;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#101214" />`,
    rect({
      x: sideCropWidth,
      y: cropGuardHeight,
      width: width - sideCropWidth * 2,
      height: height - cropGuardHeight * 2,
      fill: "#f5f7fa",
      opacity: 0.3,
      stroke: "#f5f7fa",
    }),
    rect({
      x: 0,
      y: 0,
      width,
      height: cropGuardHeight,
      fill: "#000000",
      opacity: 0.6,
    }),
    rect({
      x: 0,
      y: height - cropGuardHeight,
      width,
      height: cropGuardHeight,
      fill: "#000000",
      opacity: 0.6,
    }),
    rect({
      x: 0,
      y: cropGuardHeight,
      width: sideCropWidth,
      height: height - cropGuardHeight * 2,
      fill: "#000000",
      opacity: 0.62,
      stroke: "#f5f7fa",
    }),
    rect({
      x: width - sideCropWidth,
      y: cropGuardHeight,
      width: sideCropWidth,
      height: height - cropGuardHeight * 2,
      fill: "#000000",
      opacity: 0.62,
      stroke: "#f5f7fa",
    }),
    circle({
      cx: profileCenterX,
      cy: profileCenterY,
      r: profileRadius,
      fill: "#000000",
      opacity: 0.72,
      stroke: "#f5f7fa",
    }),
    "</svg>",
  ].join("");
}

function buildXBannerGuideSvg() {
  const width = 1500;
  const height = 500;
  const cropGuardHeight = 60;
  const avatarQuietWidth = Math.round(width * 0.34);
  const avatarQuietHeight = Math.round(height * 0.46);
  const mobileActionWidth = 200;
  const mobileActionHeight = 100;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="#101214" />`,
    rect({
      x: Math.round(width * 0.37),
      y: cropGuardHeight,
      width: Math.round(width * 0.59),
      height: Math.round(height * 0.56),
      fill: "#f5f7fa",
      opacity: 0.28,
      stroke: "#f5f7fa",
    }),
    rect({
      x: 0,
      y: 0,
      width,
      height: cropGuardHeight,
      fill: "#000000",
      opacity: 0.58,
    }),
    rect({
      x: 0,
      y: height - cropGuardHeight,
      width,
      height: cropGuardHeight,
      fill: "#000000",
      opacity: 0.58,
    }),
    rect({
      x: 0,
      y: height - avatarQuietHeight,
      width: avatarQuietWidth,
      height: avatarQuietHeight,
      fill: "#000000",
      opacity: 0.68,
      stroke: "#f5f7fa",
    }),
    rect({
      x: width - mobileActionWidth,
      y: height - mobileActionHeight,
      width: mobileActionWidth,
      height: mobileActionHeight,
      fill: "#000000",
      opacity: 0.68,
      stroke: "#f5f7fa",
    }),
    "</svg>",
  ].join("");
}

function buildProfileGuideSvg() {
  const size = 1024;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" fill="#101214" />`,
    circle({
      cx: size / 2,
      cy: size / 2,
      r: 430,
      fill: "#f5f7fa",
      opacity: 0.32,
      stroke: "#f5f7fa",
    }),
    circle({
      cx: size / 2,
      cy: size / 2,
      r: 512,
      fill: "transparent",
      opacity: 1,
      stroke: "#f5f7fa",
    }),
    "</svg>",
  ].join("");
}

function buildTemplateGuideSvg(platform: PlatformId, target: EditTarget) {
  if (target === "profile") return buildProfileGuideSvg();
  return platform === "linkedin" ? buildLinkedInBannerGuideSvg() : buildXBannerGuideSvg();
}

function getTemplateGuidePlatformName(platform: PlatformId) {
  return platform === "linkedin" ? "LinkedIn" : "X";
}

export function getTemplateGuideImageCount() {
  return 1;
}

export function getTemplateGuideDescription(platform: PlatformId, target: EditTarget) {
  const platformName = getTemplateGuidePlatformName(platform);

  if (target === "profile") {
    return [
      `Internal ${platformName} avatar crop guide image follows.`,
      "Use it only as a spatial map: the light circle is the safest area for the face, logo, or primary subject; the darker outer area is vulnerable to circular cropping.",
      "Do not reproduce the guide image, dark square, circle outlines, colors, dashed marks, or any crop-template graphics in the final avatar.",
    ].join(" ");
  }

  return [
    `Internal ${platformName} banner crop-safety guide image follows.`,
    "Use it only as a spatial map: the light rectangle is safest for important content; dark or outlined regions are crop guards, profile/avatar overlaps, mobile crops, or action-button quiet zones.",
    "Do not reproduce the guide image, blocks, outlines, colors, dashed marks, or any crop-template graphics in the final banner.",
  ].join(" ");
}

export async function buildTemplateGuideImage(
  platform: PlatformId,
  target: EditTarget,
): Promise<TemplateGuideImage> {
  const guidePng = await sharp(Buffer.from(buildTemplateGuideSvg(platform, target)))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return {
    dataUrl: `data:image/png;base64,${guidePng.toString("base64")}`,
    description: getTemplateGuideDescription(platform, target),
  };
}
