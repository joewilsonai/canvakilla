import type { PlatformConfig } from "./types";

export const xPlatform: PlatformConfig = {
  id: "x",
  route: "/x",
  tabLabel: "X",
  brandEyebrow: "Canva sucks, Introducing:",
  appName: "CanvaKilla.com",
  quickStartKicker: "Make an X-safe visual",
  quickStartTitle: "Upload a reference, write the change, hit Iterate.",
  quickStartBody:
    "The prompt already protects the avatar crop, desktop crop, and mobile follow-button zones.",
  bannerLabel: "X banner",
  profileLabel: "X profile picture",
  platformName: "X",
  bannerSize: { width: 1500, height: 500, label: "1500x500" },
  profileSizeLabel: "1024x1024",
  bannerAspectRatio: "3:1",
  bannerProofName: "x-banner-template-proof-1500x500.png",
  bannerDownloadName: "x-banner-1500x500.png",
  profileProofName: "x-profile-picture-circle-proof-1024x1024.png",
  profileDownloadName: "x-profile-picture-1024x1024.png",
  bannerPrompts: [
    "Turn this into standalone X banner artwork with a sharp center-right focal point, clean negative space near the avatar area, nothing important in the lower-left AVATAR quiet zone or lower-right MOBILE ACTION quiet zone, and no X/Twitter UI buttons, handles, icons, or overlay chrome baked into the image.",
    "Make this image feel like a premium tech founder profile banner. Keep the subject recognizable, add cinematic light, keep the lower-left AVATAR zone plus lower-right MOBILE ACTION zone empty of important details, and do not add any social app UI elements.",
    "Create a bold editorial X header artwork from this image with crisp contrast, a clean right-side title area, no faces/logos/readable text in the AVATAR or MOBILE ACTION quiet zones, and no screenshot-like X/Twitter interface elements.",
  ],
  profilePrompts: [
    "Turn this into standalone X profile picture artwork with a centered face, clean circular crop, strong contrast, a crisp small-size read, and no X/Twitter UI chrome or badges baked into the image.",
    "Create a premium founder-style avatar from this image. Keep the person recognizable, improve lighting, simplify the background, make it work as a circle, and do not add social app UI elements.",
    "Make this profile picture feel bold and editorial while preserving likeness. Keep the subject centered, avoid tiny text or important details near the corners, and do not add verification badges, rings, handles, or overlay buttons.",
  ],
  firstRunNudge: "Drop your headshot or any reference image here ->",
  cropTips: {
    crop: {
      label: "Crop guard",
      body: "X may crop the top and bottom 60 pixels of your banner on certain displays. Keep important details out of these strips.",
    },
    avatar: {
      label: "Avatar quiet zone",
      body: "Your profile picture overlaps this area as a circle. Anything placed here gets covered, so treat it as visually quiet space.",
    },
    "mobile-action": {
      label: "Mobile action zone",
      body: "X mobile shows Follow, Edit profile, or Message buttons over this area. Keep it quiet so the buttons do not fight your design.",
    },
  },
};
