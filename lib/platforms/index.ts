import { linkedinPlatform } from "./linkedin";
import { xPlatform } from "./x";

export type {
  CropTipId,
  EditTarget,
  PlatformConfig,
  PlatformId,
  PlatformSize,
} from "./types";

export const PLATFORM_CONFIGS = {
  x: xPlatform,
  linkedin: linkedinPlatform,
} as const;

export const PLATFORM_IDS = ["x", "linkedin"] as const;

export function getPlatformConfig(platform: string) {
  return platform === "linkedin" ? linkedinPlatform : xPlatform;
}
