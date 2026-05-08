import type { PlatformId } from "./platforms/types.ts";

export function buildBannerTypographyInstructions(platform: PlatformId) {
  if (platform === "linkedin") {
    return [
      "If the user requests readable text, typography, quoted copy, taglines, or exact words, treat that copy as a primary subject of the artwork.",
      "Preserve user-provided text as exactly as possible: same words, casing, punctuation, symbols, and requested accent colors. Do not paraphrase, add extra words, swap symbols, or change punctuation.",
      "Respect requested typographic hierarchy, line grouping, alignment, and position unless it collides with a platform crop guard or quiet zone.",
      "Fit text by reducing type size, tracking, or line length rather than clipping it, making it unreadable, or pushing it into crop guards, side crops, profile overlays, or edit-button overlay areas.",
      "For LinkedIn, interpret top-right, right side, or bottom-right text placement as the right side of the central mobile-safe area, not the absolute canvas edge.",
      "Keep all LinkedIn readable text fully inside the central safe region: roughly x=420 to x=1320 and y=48 to y=330 on a 1584x396 canvas.",
      "For LinkedIn lower-right credits, wordmarks, or tiny metadata, keep the right edge no farther than x=1320 and the baseline above y=330, away from the far-right side-crop strip and bottom crop guard.",
      "Leave the absolute top-right corner clear enough for LinkedIn owner edit controls; do not place headline text under a top-right pencil/edit button.",
    ];
  }

  return [
    "If the user requests readable text, typography, quoted copy, taglines, or exact words, treat that copy as a primary subject of the artwork.",
    "Preserve user-provided text as exactly as possible: same words, casing, punctuation, symbols, and requested accent colors. Do not paraphrase, add extra words, swap symbols, or change punctuation.",
    "Respect requested typographic hierarchy, line grouping, alignment, and position unless it collides with a platform crop guard or quiet zone.",
    "Fit text by reducing type size, tracking, or line length rather than clipping it, making it unreadable, or pushing it into crop guards, side crops, avatar/profile overlays, or action-button quiet zones.",
    "For lower-right credits or tiny metadata on X, place them above the mobile action button quiet zone and away from the absolute lower-right corner.",
  ];
}

export function buildBannerOverlayExclusionInstructions(platform: PlatformId) {
  if (platform === "linkedin") {
    return [
      "Do not render a fake LinkedIn profile photo, avatar circle, portrait placeholder, headshot badge, initials circle, or profile-card mockup in the lower-left profile-photo overlay area.",
      "Leave the lower-left profile-photo overlap area as plain supporting artwork or negative space so the real LinkedIn profile photo can sit on top of it later.",
    ];
  }

  return [
    "Do not render a fake X/Twitter profile photo, avatar circle, portrait placeholder, initials circle, or profile-card mockup in the lower-left avatar quiet zone.",
    "Leave the lower-left avatar overlap area as plain supporting artwork or negative space so the real X profile picture can sit on top of it later.",
  ];
}
