import type { PlatformConfig } from "./types";

export const linkedinPlatform: PlatformConfig = {
  id: "linkedin",
  route: "/linkedin",
  tabLabel: "LinkedIn",
  brandEyebrow: "Make a banner that hires you",
  appName: "CanvaKilla.com",
  quickStartKicker: "Make a profile cover for LinkedIn",
  quickStartTitle: "Upload proof, describe the upgrade, ship a sharper profile.",
  quickStartBody:
    "The prompt protects the profile-photo overlay, mobile side crops, and slim top/bottom crop guards.",
  bannerLabel: "LinkedIn banner",
  profileLabel: "LinkedIn profile photo",
  platformName: "LinkedIn",
  bannerSize: { width: 1584, height: 396, label: "1584x396" },
  profileSizeLabel: "1024x1024",
  bannerAspectRatio: "4:1",
  bannerProofName: "linkedin-banner-template-proof-1584x396.png",
  bannerDownloadName: "linkedin-banner-1584x396.png",
  profileProofName: "linkedin-profile-picture-circle-proof-1024x1024.png",
  profileDownloadName: "linkedin-profile-picture-1024x1024.png",
  bannerPrompts: [
    "Turn this into standalone LinkedIn banner artwork that looks credible, hireable, and senior. Keep key faces, logos, and text inside the center mobile-safe zone, leave the lower-left profile-photo overlay quiet, keep top/bottom crop guards clear, and do not add LinkedIn UI chrome, buttons, badges, handles, or screenshot elements.",
    "Make this feel like a polished founder/operator LinkedIn header. Use professional contrast, confident negative space, and a clean center-right focal point. Keep the lower-left profile photo zone plus left/right mobile crop edges free of important details.",
    "Create a sharp LinkedIn cover image that helps the profile feel trustworthy and memorable. Keep readable content away from the mobile side crops, avoid important details behind the profile photo circle, and remove any social-app UI elements from the artwork.",
  ],
  profilePrompts: [
    "Turn this into a polished LinkedIn profile photo with a confident expression, clean background, natural lighting, strong small-size readability, and no LinkedIn UI chrome, badges, handles, or overlay buttons.",
    "Create a professional headshot-style avatar from this image. Preserve likeness, improve lighting, simplify distractions, and make it work cleanly as a circle.",
    "Make this profile picture feel credible and warm for recruiters, founders, and customers. Keep the subject centered, avoid tiny text, and do not add social app UI elements.",
  ],
  firstRunNudge: "Drop your headshot, brand image, or work sample here ->",
  cropTips: {
    crop: {
      label: "Crop guard",
      body: "LinkedIn cover images can lose a narrow strip along the top and bottom. Keep important details out of these 30-40px edges.",
    },
    avatar: {
      label: "Profile photo overlay",
      body: "LinkedIn places a large profile photo over the lower-left banner area. On a 1584x396 export, keep roughly the lower-left 300x190 visible area quiet.",
    },
    "side-crop": {
      label: "Mobile side crop",
      body: "LinkedIn mobile clips the left and right edges more aggressively, leaving about 1200x360 visible. Keep key content centered.",
    },
  },
};
