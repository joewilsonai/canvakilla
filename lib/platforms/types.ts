export type PlatformId = "x" | "linkedin";
export type EditTarget = "banner" | "profile";
export type CropTipId = "crop" | "avatar" | "mobile-action" | "side-crop";

export type PlatformSize = {
  width: number;
  height: number;
  label: string;
};

export type PlatformConfig = {
  id: PlatformId;
  route: string;
  tabLabel: string;
  brandEyebrow: string;
  appName: string;
  quickStartKicker: string;
  quickStartTitle: string;
  quickStartBody: string;
  bannerLabel: string;
  profileLabel: string;
  platformName: string;
  bannerSize: PlatformSize;
  profileSizeLabel: string;
  bannerAspectRatio: string;
  bannerProofName: string;
  bannerDownloadName: string;
  profileProofName: string;
  profileDownloadName: string;
  bannerPrompts: string[];
  profilePrompts: string[];
  firstRunNudge: string;
  cropTips: Partial<Record<CropTipId, { label: string; body: string }>>;
};
