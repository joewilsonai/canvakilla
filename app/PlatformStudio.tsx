"use client";

import {
  ArrowLeft,
  BarChart3,
  BadgeCheck,
  Bell,
  Bookmark,
  Briefcase,
  CalendarDays,
  CircleEllipsis,
  Download,
  Eye,
  EyeOff,
  FileText,
  Heart,
  Home as HomeIcon,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Navigation,
  Pencil,
  Pin,
  Plus,
  RefreshCcw,
  Repeat2,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Smartphone,
  Trash2,
  Upload,
  UserRound,
  X as XIcon,
} from "lucide-react";
import Link from "next/link";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_IMAGE_MODEL_ID,
  IMAGE_MODEL_OPTIONS,
  normalizeImageModelId,
} from "../lib/image-models";
import {
  PLATFORM_CONFIGS,
  PLATFORM_IDS,
  type CropTipId,
  type EditTarget,
  type PlatformConfig,
  type PlatformId,
} from "../lib/platforms";
import { captureClientEvent } from "../lib/posthog-client";
import {
  drawBannerProof,
  drawProfileProof,
  getPromptTargetHint,
} from "./studio/canvas-renderers";
import {
  dataUrlToFile,
  drawCoverImage,
  getDataUrlBytes,
  readFileAsDataUrl,
} from "./studio/client-images";
import {
  getNextReferenceNumber,
  normalizeReferenceItems,
  removeAllReferenceInstructions,
  syncReferenceInstructions,
} from "./studio/references";
import type {
  GenerateResponse,
  HistoryItem,
  PersistedWorkspace,
  PreviewMode,
  ReferenceItem,
  UploadImageKind,
} from "./studio/types";

function GrokIcon({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      height={size}
      viewBox="0 0 512 509.641"
      width={size}
    >
      <path
        d="M213.235 306.019l178.976-180.002v.169l51.695-51.763c-.924 1.32-1.86 2.605-2.785 3.89-39.281 54.164-58.46 80.649-43.07 146.922l-.09-.101c10.61 45.11-.744 95.137-37.398 131.836-46.216 46.306-120.167 56.611-181.063 14.928l42.462-19.675c38.863 15.278 81.392 8.57 111.947-22.03 30.566-30.6 37.432-75.159 22.065-112.252-2.92-7.025-11.67-8.795-17.792-4.263l-124.947 92.341zm-25.786 22.437l-.033.034L68.094 435.217c7.565-10.429 16.957-20.294 26.327-30.149 26.428-27.803 52.653-55.359 36.654-94.302-21.422-52.112-8.952-113.177 30.724-152.898 41.243-41.254 101.98-51.661 152.706-30.758 11.23 4.172 21.016 10.114 28.638 15.639l-42.359 19.584c-39.44-16.563-84.629-5.299-112.207 22.313-37.298 37.308-44.84 102.003-1.128 143.81z"
      />
    </svg>
  );
}

const WORKSPACE_DB = "x-banner-maker";
const WORKSPACE_STORE = "workspace";
const WORKSPACE_KEY = "current";
const FIRST_RUN_DONE_KEY = "canvakilla_first_run_done";
const DISMISSED_CROP_TIPS_KEY = "canvakilla_dismissed_crop_tips";
const MAX_REFERENCE_IMAGES_PER_RUN = 12;
const MAX_STORED_REFERENCE_IMAGES = 24;
const MAX_CLIENT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_CLIENT_TOTAL_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_GENERATION_UPLOAD_BYTES = 3.4 * 1024 * 1024;
const MIN_GENERATION_IMAGE_BYTES = 220 * 1024;
const ACCEPTED_CLIENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type RealTweet = {
  name: string;
  handle: string;
  text: string;
  likes: string;
  url?: string;
  avatarUrl: string;
  mediaUrl?: string;
  sourceLabel?: string;
};

const REAL_TWEETS: RealTweet[] = [
  {
    name: "popitforpoppa",
    handle: "popitforpoppa",
    text: "a dog's sigh is so hilarious because wtf is stressing you",
    likes: "295K",
    url: "https://x.com/popitforpoppa/status/1820243613248344201",
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1996044295023792128/F6muG7sC_400x400.jpg",
  },
  {
    name: "Ely Kreimendahl",
    handle: "ElyKreimendahl",
    text: "\"you're so funny\" thanks i did not have sex in high school",
    likes: "378K",
    url: "https://x.com/ElyKreimendahl/status/1301688787169312768",
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1672073016367357961/CPerGj_i_400x400.jpg",
  },
  {
    name: "Jordan Rutledge",
    handle: "JordanRutledge",
    text: "yea breakups are rough but have you ever played a card you thought was hilarious in cards against humanity and no one laughed",
    likes: "566K",
    url: "https://x.com/JordanRutledge/status/1251757804916019201",
    avatarUrl:
      "https://pbs.twimg.com/profile_images/965713858995392512/XWqz3usQ_400x400.jpg",
  },
  {
    name: "Scottie Beam",
    handle: "ScottieBeam",
    text: "To feel a SINGLE punch from your opponent and say... \"nah, you gotta be a man\" .. is mad funny to me. I'm sorry.",
    likes: "327K",
    url: "https://x.com/ScottieBeam/status/1819053663001944564",
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1600283165439967232/KZ5rP3NF_400x400.jpg",
  },
  {
    name: "Parker Lawyer",
    handle: "Parkerlawyer",
    text: "My husband went to a lawyer luncheon thing and the lawyer he sat beside turned out to be my ex boyfriend from college. When they realized the connection he told my husband, \"She always had me\nlaughing. Is she still funny?\" And my sweet husband said, \"Not in the slightest.\"",
    likes: "276K",
    url: "https://x.com/Parkerlawyer/status/1597699243925389312",
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1993550865609756673/Iq16daOU_400x400.jpg",
  },
  {
    name: "Halle Berry",
    handle: "halleberry",
    text: "😂😂 I'm logging off",
    likes: "75K",
    url: "https://x.com/halleberry/status/2051337943709831363",
    avatarUrl:
      "https://pbs.twimg.com/profile_images/1514334973351927820/ezP0hT_Z_400x400.jpg",
  },
  {
    name: "Rate Limit Support Group",
    handle: "ratelimitclub",
    text: "claude code hit a limit and the whole room suddenly learned what pacing means",
    likes: "124K",
    avatarUrl: "/icon.svg",
    sourceLabel: "demo",
  },
  {
    name: "my CLAUDE.md",
    handle: "claudemd",
    text: "i put one instruction in CLAUDE.md and now every repo is spiritually a settings panel",
    likes: "38K",
    avatarUrl: "/icon.svg",
    sourceLabel: "demo",
  },
  {
    name: "agent recursion dept.",
    handle: "agentrecursing",
    text: "the agent asked the agent to ask the agent if the agent was still working",
    likes: "52K",
    avatarUrl: "/icon.svg",
    sourceLabel: "demo",
  },
  {
    name: "copilot survivor",
    handle: "copilothaha",
    text: "copilot suggested deleting the code and honestly i respect a bold pivot",
    likes: "89K",
    avatarUrl: "/icon.svg",
    sourceLabel: "demo",
  },
];

function RealTweetCard({
  tweet,
  variant = "desktop",
  pinned = false,
}: {
  tweet: RealTweet;
  variant?: "desktop" | "mobile";
  pinned?: boolean;
}) {
  const className =
    variant === "mobile" ? "x-mobile-post x-real-tweet" : "x-post x-real-tweet";
  const avatarSize = variant === "mobile" ? 42 : 44;
  const avatar = (
    <img
      src={tweet.avatarUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      width={avatarSize}
      height={avatarSize}
    />
  );

  return (
    <article className={className}>
      {tweet.url ? (
        <a
          className="x-post-avatar"
          href={`https://x.com/${tweet.handle}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`${tweet.name} on X`}
        >
          {avatar}
        </a>
      ) : (
        <span className="x-post-avatar" aria-hidden="true">
          {avatar}
        </span>
      )}
      <div>
        {pinned && (
          <p className="pinned">
            <Pin size={17} aria-hidden="true" />
            Pinned
          </p>
        )}
        <p className="x-tweet-byline">
          {tweet.url ? (
            <a href={tweet.url} target="_blank" rel="noreferrer">
              <strong>{tweet.name}</strong>{" "}
              <span>@{tweet.handle} · {tweet.sourceLabel || "from X"}</span>
            </a>
          ) : (
            <span>
              <strong>{tweet.name}</strong>{" "}
              <span>@{tweet.handle} · {tweet.sourceLabel || "demo"}</span>
            </span>
          )}
        </p>
        <p className="x-tweet-text">{tweet.text}</p>
        {tweet.mediaUrl && tweet.url && (
          <a
            className="x-tweet-media"
            href={tweet.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${tweet.name}'s tweet media on X`}
          >
            <img
              src={tweet.mediaUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </a>
        )}
        <div className="x-post-actions">
          <MessageCircle size={17} aria-hidden="true" />
          <Repeat2 size={17} aria-hidden="true" />
          <span className="x-like-count">
            <Heart size={17} aria-hidden="true" />
            {tweet.likes}
          </span>
          <BarChart3 size={17} aria-hidden="true" />
          <Bookmark size={17} aria-hidden="true" />
          <Share2 size={17} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function CropGuardTooltip({
  id,
  platform,
  tip,
  dismissed,
  onDismiss,
}: {
  id: CropTipId;
  platform: PlatformId;
  tip?: { label: string; body: string };
  dismissed: boolean;
  onDismiss: (id: CropTipId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (dismissed || !tip) return null;

  return (
    <span className="crop-tip">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={`Explain ${tip.label}`}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => {
            const nextOpen = !open;
            if (nextOpen) {
              captureClientEvent("crop_tip_opened", { tip: id, platform });
            }
            return nextOpen;
          });
        }}
      >
        ?
      </button>
      {isOpen && (
        <span className="crop-tip-popover" role="note">
          <strong>{tip.label}</strong>
          <small>{tip.body}</small>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              captureClientEvent("crop_tip_dismissed", { tip: id, platform });
              onDismiss(id);
            }}
          >
            Got it
          </button>
        </span>
      )}
    </span>
  );
}

type PlatformPreviewProps = {
  config: PlatformConfig;
  currentImage: string;
  profileImage: string;
  editTarget: EditTarget;
  templateVisible: boolean;
  dismissedCropTips: CropTipId[];
  onDismissCropTip: (id: CropTipId) => void;
  onMoveActiveToReferences: () => void;
  references: ReferenceItem[];
};

type GenerationSourceMode =
  | "from_scratch"
  | "current_only"
  | "refs_only"
  | "current_plus_refs";

function getGenerationSourceMode(
  hasActiveImage: boolean,
  selectedReferenceCount: number,
): GenerationSourceMode {
  if (hasActiveImage && selectedReferenceCount > 0) return "current_plus_refs";
  if (hasActiveImage) return "current_only";
  if (selectedReferenceCount > 0) return "refs_only";
  return "from_scratch";
}

function getSourceModeLabel(mode: GenerationSourceMode, targetName: string) {
  if (mode === "current_plus_refs") return `Current ${targetName} + clicked refs`;
  if (mode === "current_only") return `Current ${targetName}`;
  if (mode === "refs_only") return "Clicked refs only";
  return "Prompt only";
}

function MoveToReferencesButton({
  targetName,
  onClick,
  className = "",
}: {
  targetName: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`move-to-refs-button ${className}`.trim()}
      type="button"
      onClick={onClick}
      title={`Move current ${targetName} out of the preview and into references`}
      aria-label={`Move current ${targetName} out of preview and into references`}
    >
      <ImagePlus size={15} aria-hidden="true" />
      <span>Move to refs</span>
    </button>
  );
}

function LinkedInTemplateLayer({
  config,
  dismissedCropTips,
  onDismissCropTip,
  mobile = false,
}: {
  config: PlatformConfig;
  dismissedCropTips: CropTipId[];
  onDismissCropTip: (id: CropTipId) => void;
  mobile?: boolean;
}) {
  return (
    <div
      className={`template-layer linkedin-template${mobile ? " is-mobile" : ""}`}
      aria-label="LinkedIn crop guard template"
    >
      <div className="crop-guide top">
        <span>
          crop guard
          <CropGuardTooltip
            id="crop"
            platform={config.id}
            tip={config.cropTips.crop}
            dismissed={dismissedCropTips.includes("crop")}
            onDismiss={onDismissCropTip}
          />
        </span>
      </div>
      <div className="crop-guide bottom">
        <span>
          crop guard
          <CropGuardTooltip
            id="crop"
            platform={config.id}
            tip={config.cropTips.crop}
            dismissed={dismissedCropTips.includes("crop")}
            onDismiss={onDismissCropTip}
          />
        </span>
      </div>
      <div className="linkedin-side-crop left">
        <span>
          side crop
          <CropGuardTooltip
            id="side-crop"
            platform={config.id}
            tip={config.cropTips["side-crop"]}
            dismissed={dismissedCropTips.includes("side-crop")}
            onDismiss={onDismissCropTip}
          />
        </span>
      </div>
      <div className="linkedin-side-crop right">
        <span>
          side crop
          <CropGuardTooltip
            id="side-crop"
            platform={config.id}
            tip={config.cropTips["side-crop"]}
            dismissed={dismissedCropTips.includes("side-crop")}
            onDismiss={onDismissCropTip}
          />
        </span>
      </div>
      <div className="linkedin-safe-zone">
        <span>mobile safe zone</span>
      </div>
      <div className="linkedin-profile-zone">
        <span className="sr-only">LinkedIn profile photo overlay zone</span>
      </div>
      <div className="linkedin-profile-label">
        <span>
          profile photo
          <CropGuardTooltip
            id="avatar"
            platform={config.id}
            tip={config.cropTips.avatar}
            dismissed={dismissedCropTips.includes("avatar")}
            onDismiss={onDismissCropTip}
          />
        </span>
      </div>
    </div>
  );
}

function LinkedInBannerPreview({
  config,
  currentImage,
  templateVisible,
  dismissedCropTips,
  onDismissCropTip,
  mobile = false,
}: Pick<
  PlatformPreviewProps,
  | "config"
  | "currentImage"
  | "templateVisible"
  | "dismissedCropTips"
  | "onDismissCropTip"
> & {
  mobile?: boolean;
}) {
  return (
    <div className="linkedin-banner" data-empty={!currentImage}>
      {currentImage ? (
        <img src={currentImage} alt="Current LinkedIn banner preview" />
      ) : (
        <div className="empty-state">
          <ImagePlus size={mobile ? 28 : 34} aria-hidden="true" />
          <span>Generate a LinkedIn cover to preview crop safety</span>
        </div>
      )}
      {templateVisible && (
        <LinkedInTemplateLayer
          config={config}
          mobile={mobile}
          dismissedCropTips={dismissedCropTips}
          onDismissCropTip={onDismissCropTip}
        />
      )}
    </div>
  );
}

function LinkedInAvatar({
  editTarget,
  profileImage,
  mobile = false,
}: {
  editTarget: EditTarget;
  profileImage: string;
  mobile?: boolean;
}) {
  return (
    <div
      className={`linkedin-avatar${mobile ? " is-mobile" : ""}${
        editTarget === "profile" ? " is-editing" : ""
      }`}
    >
      {profileImage ? <img src={profileImage} alt="" /> : <span>JW</span>}
    </div>
  );
}

function LinkedInDesktopPreview(props: PlatformPreviewProps) {
  return (
    <div className="linkedin-desktop-preview">
      <header className="linkedin-top-nav" aria-label="LinkedIn top navigation preview">
        <strong className="linkedin-logo">in</strong>
        <div className="linkedin-search">
          <Search size={17} aria-hidden="true" />
          <span>I'm looking for...</span>
        </div>
        <span>
          <HomeIcon size={22} aria-hidden="true" />
          Home
        </span>
        <span>
          <UserRound size={22} aria-hidden="true" />
          My Network
        </span>
        <span>
          <Briefcase size={22} aria-hidden="true" />
          Jobs
        </span>
        <span>
          <MessageCircle size={22} aria-hidden="true" />
          Messaging
        </span>
        <span>
          <Bell size={22} aria-hidden="true" />
          Notifications
        </span>
        <span>
          <span className="linkedin-mini-me">
            {props.profileImage ? <img src={props.profileImage} alt="" /> : null}
          </span>
          Me
        </span>
      </header>

      <div className="linkedin-page-grid">
        <div className="linkedin-feed-column">
          <section className="linkedin-card linkedin-profile-card">
            <LinkedInBannerPreview {...props} />
            <span className="linkedin-edit-dot" aria-hidden="true">
              <Pencil size={18} />
            </span>
            <LinkedInAvatar
              editTarget={props.editTarget}
              profileImage={props.profileImage}
            />
            {props.profileImage && props.editTarget === "profile" && (
              <MoveToReferencesButton
                className="preview-move-button linkedin-avatar-move-button"
                targetName={props.config.profileLabel}
                onClick={props.onMoveActiveToReferences}
              />
            )}
            <div className="linkedin-profile-tools" aria-hidden="true">
              <span className="linkedin-profile-badge">in</span>
              <Pencil size={22} />
            </div>
            <div className="linkedin-profile-copy">
              <div className="linkedin-profile-heading">
                <div>
                  <h2>
                    Joe Wilson <span className="linkedin-pronouns">He/Him</span>
                  </h2>
                  <p>
                    AI strategist + founder of AI Builders Club · 25 yrs of
                    software at Microsoft, Amazon, Rapsodo · Not just talking
                    about the future. Shipping it.
                  </p>
                </div>
                <div className="linkedin-affiliations" aria-hidden="true">
                  <span>Obey</span>
                  <span>Southeast Missouri State University</span>
                </div>
              </div>
              <p className="linkedin-muted">
                Greater St. Louis · <span className="linkedin-link">Contact info</span>
              </p>
              <p className="linkedin-link">2,448 followers · 500+ connections</p>
              <div className="linkedin-actions">
                <span>Open to</span>
                <span>Add section</span>
                <span>Visit my website</span>
                <span>...</span>
              </div>
            </div>
          </section>

          <section className="linkedin-card linkedin-post-card">
            <div className="linkedin-post-header">
              <LinkedInAvatar
                editTarget="banner"
                profileImage={props.profileImage}
                mobile
              />
              <div className="linkedin-post-author">
                <p>
                  <strong>Joe Wilson</strong>
                  <span className="linkedin-post-badge">in</span>
                  <span>· You</span>
                </p>
                <small>
                  AI strategist + founder of AI Builders Club · 25 yrs of
                  software at Microsoft, ...
                </small>
                <a>Visit my website</a>
              </div>
              <MoreHorizontal size={21} aria-hidden="true" />
            </div>
            <p className="linkedin-post-body">
              The profile banner should make the first impression before the crop
              math gets a vote. CanvaKilla makes the invisible crop guards obvious
              before you publish.
            </p>
            <div className="linkedin-post-social">
              <span className="linkedin-reaction-icons" aria-hidden="true">
                <i />
                <i />
              </span>
              <span>Kramer and 7 others</span>
              <span>2 comments</span>
            </div>
            <div className="linkedin-post-actions">
              <span>
                <Heart size={18} aria-hidden="true" />
                Like
              </span>
              <span>
                <MessageCircle size={18} aria-hidden="true" />
                Comment
              </span>
              <span>
                <Repeat2 size={18} aria-hidden="true" />
                Repost
              </span>
              <span>
                <Navigation size={18} aria-hidden="true" />
                Send
              </span>
            </div>
            <div className="linkedin-post-analytics">
              <strong>
                <BarChart3 size={18} aria-hidden="true" />
                599 impressions
              </strong>
              <a>View analytics</a>
            </div>
            <div className="linkedin-comment-box">
              <LinkedInAvatar
                editTarget="banner"
                profileImage={props.profileImage}
                mobile
              />
              <span>
                Add a comment...
                <ImagePlus size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="linkedin-reaction-row" aria-hidden="true">
              {["TK", "BK", "AK", "DA", "SA", "JW", "BC"].map((initials) => (
                <span key={initials}>{initials}</span>
              ))}
              <strong>...</strong>
            </div>
            <small className="linkedin-comment-sort">Most relevant ▾</small>
            <div className="linkedin-comment-thread">
              <div className="linkedin-comment">
                <span className="linkedin-comment-avatar">TK</span>
                <div>
                  <p>
                    <strong>George Kostanza</strong>
                    <small>1st · 6d · ··</small>
                  </p>
                  <span>
                    This is exactly the thing people miss. Looks fine on desktop,
                    then mobile eats the punchline.
                  </span>
                  <small>Like · Reply · 1</small>
                </div>
              </div>
              <div className="linkedin-comment is-reply">
                <LinkedInAvatar
                  editTarget="banner"
                  profileImage={props.profileImage}
                  mobile
                />
                <div>
                  <p>
                    <strong>Joe Wilson</strong>
                    <em>Author</em>
                    <small>6d · ··</small>
                  </p>
                  <span>
                    Exactly. CanvaKilla is just making the invisible crop math
                    visible before you ship the banner.
                  </span>
                  <small>Like · Reply · 31</small>
                </div>
              </div>
            </div>
          </section>

          <section className="linkedin-card linkedin-suggested-card">
            <h3>Suggested for you</h3>
            <p className="linkedin-private">Private to you</p>
            <div className="linkedin-suggestion-grid">
              <div>
                <strong>Is your current title at Obey Founder & Chief Strategist?</strong>
                <p>
                  It's important to keep your profile current so people can find
                  and connect with you.
                </p>
                <span>Confirm current position</span>
              </div>
              <div>
                <strong>Add projects that showcase your skills</strong>
                <p>
                  Show recruiters how you put your skills to use by adding
                  projects to your profile.
                </p>
                <span>Add a project</span>
              </div>
            </div>
          </section>
        </div>

        <div className="linkedin-right-rail">
          <section className="linkedin-card linkedin-profile-settings">
            <h3>Profile language</h3>
            <p>English</p>
            <hr />
            <h3>Public profile & URL</h3>
            <p>www.linkedin.com/in/joewilsonjr</p>
          </section>
          <section className="linkedin-card linkedin-ad-card">
            <div className="linkedin-ad-logo">
              <img src="/abc-logo-final-joe.jpeg" alt="" />
            </div>
            <strong>AI Builders Club</strong>
            <p>Do you want to learn AI by doing?</p>
            <span>Follow</span>
          </section>
          <section className="linkedin-card linkedin-viewers-card">
            <small>Premium</small>
            <h3>Who your viewers also viewed</h3>
            {[
              "Sam Altman",
              "Dario Amodei",
              "Boris Cherny",
              "Andrej Karpathy",
              "Chungin (Roy) Lee",
            ].map(
              (name) => (
                <p key={name}>
                  <strong>{name}</strong>
                  <span>1st · Message</span>
                </p>
              ),
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function LinkedInMobilePreview(props: PlatformPreviewProps) {
  return (
    <div className="linkedin-mobile-stage">
      <div className="linkedin-phone-preview">
        <div className="linkedin-mobile-topbar">
          <strong className="linkedin-logo">in</strong>
          <span>
            <Search size={18} aria-hidden="true" />
            Search
          </span>
          <MessageCircle size={20} aria-hidden="true" />
        </div>
        <section className="linkedin-mobile-profile-card">
          <LinkedInBannerPreview {...props} mobile />
          <LinkedInAvatar
            editTarget={props.editTarget}
            profileImage={props.profileImage}
            mobile
          />
          {props.profileImage && props.editTarget === "profile" && (
            <MoveToReferencesButton
              className="preview-move-button linkedin-mobile-avatar-move-button"
              targetName={props.config.profileLabel}
              onClick={props.onMoveActiveToReferences}
            />
          )}
          <div className="linkedin-mobile-copy">
            <h2>
              Joe Wilson <span className="linkedin-pronouns">He/Him</span>
            </h2>
            <p>
              AI strategist + founder of AI Builders Club · 25 yrs of software
              at Microsoft, Amazon, Rapsodo · Not just talking about the future.
              Shipping it.
            </p>
            <small>Greater St. Louis · 2,448 followers · 500+ connections</small>
            <div className="linkedin-actions">
              <span>Connect</span>
              <span>Message</span>
            </div>
          </div>
        </section>
        <section className="linkedin-card linkedin-about-card">
          <h3>About</h3>
          <p>
            A LinkedIn cover should stay readable after the profile photo and
            mobile crop get involved.
          </p>
        </section>
        <section className="linkedin-card linkedin-post-card">
          <div className="linkedin-post-byline">
            <LinkedInAvatar
              editTarget="banner"
              profileImage={props.profileImage}
              mobile
            />
            <span>
              <strong>Joe Wilson</strong>
              <small>CanvaKilla · now</small>
            </span>
          </div>
          <p>Professional banner, crop-safe by default.</p>
        </section>
      </div>
    </div>
  );
}

function openWorkspaceDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DB, 1);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WORKSPACE_STORE)) {
        request.result.createObjectStore(WORKSPACE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteWorkspaceDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(WORKSPACE_DB);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Workspace storage is busy."));
  });
}

async function readWorkspaceState(workspaceKey: string) {
  if (typeof indexedDB === "undefined") return null;

  let db: IDBDatabase;
  try {
    db = await openWorkspaceDb();
  } catch {
    return null;
  }

  try {
    return await new Promise<PersistedWorkspace | null>((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, "readonly");
      const request = transaction.objectStore(WORKSPACE_STORE).get(workspaceKey);

      request.onsuccess = () => {
        resolve((request.result as PersistedWorkspace | undefined) || null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writeWorkspaceState(workspaceKey: string, state: PersistedWorkspace) {
  if (typeof indexedDB === "undefined") return;

  let db: IDBDatabase;
  try {
    db = await openWorkspaceDb();
  } catch {
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, "readwrite");

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore(WORKSPACE_STORE).put(state, workspaceKey);
    });
  } finally {
    db.close();
  }
}

function getGenerationErrorKind(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "rate_limited";
  }
  if (normalized.includes("unavailable") || normalized.includes("api key")) {
    return "provider_unavailable";
  }
  if (normalized.includes("too large") || normalized.includes("size")) {
    return "payload_limit";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "network";
  }
  if (normalized.includes("no image")) {
    return "empty_response";
  }

  return "generation_failed";
}

async function readGeneratePayload(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {} as GenerateResponse;

  try {
    return JSON.parse(text) as GenerateResponse;
  } catch {
    const normalized = text.toLowerCase();
    if (response.status === 413 || normalized.includes("request entity")) {
      return {
        error:
          "That run has too much image data. Remove a few references or try again with fewer source images.",
      };
    }

    return {
      error: text.replace(/\s+/g, " ").trim().slice(0, 240) || "Generation failed.",
    };
  }
}

export default function PlatformStudio({ platform }: { platform: PlatformId }) {
  const config = PLATFORM_CONFIGS[platform];
  const workspaceKey = platform === "x" ? WORKSPACE_KEY : `${WORKSPACE_KEY}-${platform}`;
  const firstRunDoneKey =
    platform === "x" ? FIRST_RUN_DONE_KEY : `${FIRST_RUN_DONE_KEY}_${platform}`;
  const dismissedCropTipsKey =
    platform === "x"
      ? DISMISSED_CROP_TIPS_KEY
      : `${DISMISSED_CROP_TIPS_KEY}_${platform}`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget>("banner");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [profileImage, setProfileImage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [currentImage, setCurrentImage] = useState("");
  const [prompt, setPrompt] = useState(config.bannerPrompts[0]);
  const [model, setModel] = useState(DEFAULT_IMAGE_MODEL_ID);
  const [templateVisible, setTemplateVisible] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [profileHistory, setProfileHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [firstRunDone, setFirstRunDone] = useState(false);
  const [dismissedCropTips, setDismissedCropTips] = useState<CropTipId[]>([]);
  const [lastMovedTarget, setLastMovedTarget] = useState<EditTarget | null>(null);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  const activeImage = editTarget === "profile" ? profileImage : currentImage;
  const activeHistory = editTarget === "profile" ? profileHistory : history;
  const activePromptStarters =
    editTarget === "profile" ? config.profilePrompts : config.bannerPrompts;
  const activeTargetName =
    editTarget === "profile" ? config.profileLabel : config.bannerLabel;
  const activeSize =
    editTarget === "profile" ? config.profileSizeLabel : config.bannerSize.label;
  const previewModeLabel = previewMode === "mobile" ? "Mobile" : "Desktop";
  const selectedReferences = references.filter((reference) =>
    selectedReferenceIds.includes(reference.id),
  );
  const runReferences = (editTarget === "banner" ? selectedReferences : [])
    .slice(0, MAX_REFERENCE_IMAGES_PER_RUN);
  const canGenerate = workspaceLoaded && prompt.trim().length > 0 && !isGenerating;
  const canExport = Boolean(activeImage);
  const showFirstRunNudge = !firstRunDone && references.length === 0 && !activeImage;
  const sourceMode = getGenerationSourceMode(Boolean(activeImage), runReferences.length);
  const sourceModeLabel = getSourceModeLabel(sourceMode, activeTargetName);
  const parkedReferenceCount = Math.max(0, references.length - runReferences.length);
  const primaryActionLabel = !workspaceLoaded
    ? "Loading workspace"
    : activeImage
      ? `Iterate Current ${editTarget === "profile" ? "Profile" : "Banner"}`
      : `Create ${editTarget === "profile" ? "Profile" : "Banner"}`;
  const sourceSummary = [
    activeImage ? `Iterating current ${activeTargetName}` : `Creating ${activeTargetName}`,
    runReferences.length
      ? `using ${runReferences.length} selected reference${
          runReferences.length === 1 ? "" : "s"
        }`
      : references.length
        ? `${references.length} saved reference${
            references.length === 1 ? "" : "s"
          } parked`
        : "no references selected",
  ].join(" · ");

  const selectedModelLabel = useMemo(() => {
    return (
      IMAGE_MODEL_OPTIONS.find((item) => item.id === model)?.label || "Image model"
    );
  }, [model]);

  function markFirstRunDone() {
    if (firstRunDone) return;
    setFirstRunDone(true);
    window.localStorage.setItem(firstRunDoneKey, "1");
  }

  function dismissCropTip(id: CropTipId) {
    setDismissedCropTips((items) => {
      if (items.includes(id)) return items;
      const nextItems = [...items, id];
      window.localStorage.setItem(dismissedCropTipsKey, JSON.stringify(nextItems));
      return nextItems;
    });
  }

  useEffect(() => {
    let isMounted = true;

    setFirstRunDone(window.localStorage.getItem(firstRunDoneKey) === "1");
    try {
      const dismissed = JSON.parse(
        window.localStorage.getItem(dismissedCropTipsKey) || "[]",
      ) as CropTipId[];
      if (Array.isArray(dismissed)) {
        setDismissedCropTips(
          dismissed.filter((id): id is CropTipId => id in config.cropTips),
        );
      }
    } catch {
      setDismissedCropTips([]);
    }

    readWorkspaceState(workspaceKey)
      .then((savedState) => {
        if (!isMounted || !savedState) return;

        let restoredReferences: ReferenceItem[] = [];
        let restoredSelectedReferenceIds: string[] = [];

        if (Array.isArray(savedState.references) && savedState.references.length) {
          restoredReferences = normalizeReferenceItems(savedState.references).slice(
            0,
            MAX_STORED_REFERENCE_IMAGES,
          );
          setReferences(restoredReferences);
        } else if (savedState.sourceImage) {
          restoredReferences = [
            {
              id: "legacy-reference",
              image: savedState.sourceImage,
              name: savedState.sourceName || "reference image",
              label: "R1",
              createdAt: "Saved",
            },
          ];
          setReferences(restoredReferences);
        }

        if (Array.isArray(savedState.selectedReferenceIds)) {
          const restoredReferenceIds = new Set(
            restoredReferences.map((reference) => reference.id),
          );
          restoredSelectedReferenceIds = savedState.selectedReferenceIds
            .filter((id) => restoredReferenceIds.has(id))
            .slice(0, MAX_REFERENCE_IMAGES_PER_RUN);
          setSelectedReferenceIds(restoredSelectedReferenceIds);
        }

        setProfileImage(savedState.profileImage || "");
        setProfileName(savedState.profileName || "");
        setCurrentImage(savedState.currentImage || "");
        const restoredTarget: EditTarget =
          savedState.editTarget === "profile" ? "profile" : "banner";
        const restoredPrompt =
          savedState.prompt ||
          (restoredTarget === "profile"
            ? config.profilePrompts[0]
            : config.bannerPrompts[0]);
        const normalizedPrompt =
          restoredTarget === "profile" && config.bannerPrompts.includes(restoredPrompt)
            ? config.profilePrompts[0]
            : restoredTarget === "banner" && config.profilePrompts.includes(restoredPrompt)
              ? config.bannerPrompts[0]
              : restoredPrompt;
        setPrompt(
          restoredTarget === "banner"
            ? syncReferenceInstructions(
                normalizedPrompt,
                restoredReferences.filter((reference) =>
                  restoredSelectedReferenceIds.includes(reference.id),
                ),
              )
            : removeAllReferenceInstructions(normalizedPrompt),
        );
        setModel(normalizeImageModelId(savedState.model || DEFAULT_IMAGE_MODEL_ID));
        setEditTarget(restoredTarget);
        setPreviewMode(
          savedState.previewMode === "mobile" ? "mobile" : "desktop",
        );
        setTemplateVisible(savedState.templateVisible ?? true);
        setHistory(Array.isArray(savedState.history) ? savedState.history : []);
        setProfileHistory(
          Array.isArray(savedState.profileHistory) ? savedState.profileHistory : [],
        );

        if (savedState.currentImage) {
          setStatus("Restored saved banner");
        } else if (savedState.sourceImage || savedState.references?.length) {
          setStatus("Restored saved reference");
        }
      })
      .catch(() => {
        if (isMounted) setStatus("Local restore unavailable");
      })
      .finally(() => {
        if (isMounted) setWorkspaceLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, [
    config.bannerPrompts,
    config.profilePrompts,
    dismissedCropTipsKey,
    firstRunDoneKey,
    workspaceKey,
  ]);

  useEffect(() => {
    if (!workspaceLoaded) return;

    const saveTimer = window.setTimeout(() => {
      writeWorkspaceState(workspaceKey, {
        editTarget,
        previewMode,
        references,
        selectedReferenceIds,
        sourceImage: references[0]?.image || "",
        sourceName: references[0]?.name || "",
        profileImage,
        profileName,
        currentImage,
        prompt,
        model,
        templateVisible,
        history,
        profileHistory,
      }).catch(() => setStatus("Could not autosave locally"));
    }, 300);

    return () => window.clearTimeout(saveTimer);
  }, [
    currentImage,
    editTarget,
    history,
    model,
    profileImage,
    profileHistory,
    profileName,
    prompt,
    previewMode,
    references,
    selectedReferenceIds,
    templateVisible,
    workspaceKey,
    workspaceLoaded,
  ]);

  useEffect(() => {
    const referenceIds = new Set(references.map((reference) => reference.id));
    const nextIds = selectedReferenceIds
      .filter((id) => referenceIds.has(id))
      .slice(0, MAX_REFERENCE_IMAGES_PER_RUN);

    if (
      nextIds.length === selectedReferenceIds.length &&
      nextIds.every((id, index) => id === selectedReferenceIds[index])
    ) {
      return;
    }

    const nextSelectedReferences = references.filter((reference) =>
      nextIds.includes(reference.id),
    );
    setSelectedReferenceIds(nextIds);
    setPrompt((value) => syncReferenceInstructions(value, nextSelectedReferences));
  }, [references, selectedReferenceIds]);

  async function handleFiles(files: FileList | null) {
    const selectedFiles = Array.from(files || []);
    const imageFiles = selectedFiles.filter((file) =>
      ACCEPTED_CLIENT_IMAGE_TYPES.has(file.type),
    );

    if (!imageFiles.length) return;
    if (imageFiles.length !== selectedFiles.length) {
      setError("Only PNG, JPEG, and WebP images can be added.");
      return;
    }

    if (imageFiles.length > MAX_REFERENCE_IMAGES_PER_RUN) {
      setError(`Add at most ${MAX_REFERENCE_IMAGES_PER_RUN} references at a time.`);
      return;
    }

    const oversizedFile = imageFiles.find(
      (file) => file.size > MAX_CLIENT_IMAGE_BYTES,
    );
    if (oversizedFile) {
      setError(`Keep each image under 8MB. ${oversizedFile.name} is too large.`);
      return;
    }

    const existingBytes = references.reduce(
      (total, reference) => total + getDataUrlBytes(reference.image),
      0,
    );
    const newBytes = imageFiles.reduce((total, file) => total + file.size, 0);
    if (existingBytes + newBytes > MAX_CLIENT_TOTAL_IMAGE_BYTES) {
      setError("Keep saved references under 32MB total. Remove a few or use smaller files.");
      return;
    }

    const startNumber = getNextReferenceNumber(references);
    const nextReferences = await Promise.all(
      imageFiles.map(async (file, index) => ({
        id: crypto.randomUUID(),
        image: await readFileAsDataUrl(file),
        name: file.name,
        label: `R${startNumber + index + 1}`,
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    );

    setReferences((items) =>
      [...nextReferences.reverse(), ...items].slice(0, MAX_STORED_REFERENCE_IMAGES),
    );
    captureClientEvent("reference_images_added", {
      count: imageFiles.length,
      platform,
    });
    markFirstRunDone();
    setError("");
    setStatus(
      imageFiles.length === 1
        ? "Reference added and parked until clicked"
        : `${imageFiles.length} references added and parked until clicked`,
    );
  }

  async function handleProfileFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPTED_CLIENT_IMAGE_TYPES.has(file.type)) {
      setError("Choose a PNG, JPEG, or WebP profile image.");
      return;
    }

    if (file.size > MAX_CLIENT_IMAGE_BYTES) {
      setError("Keep the profile image under 8MB.");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setProfileImage(dataUrl);
    setProfileName(file.name);
    setProfileHistory([]);
    setLastMovedTarget(null);
    captureClientEvent("source_image_uploaded", { target: "profile", platform });
    markFirstRunDone();
    setError("");
    setStatus("Profile photo loaded");
  }

  function switchEditTarget(nextTarget: EditTarget) {
    const currentStarters =
      editTarget === "profile" ? config.profilePrompts : config.bannerPrompts;
    const nextStarters =
      nextTarget === "profile" ? config.profilePrompts : config.bannerPrompts;

    setEditTarget(nextTarget);
    setPrompt((value) => {
      const nextPrompt = currentStarters.includes(value) ? nextStarters[0] : value;
      return nextTarget === "profile"
        ? removeAllReferenceInstructions(nextPrompt)
        : syncReferenceInstructions(nextPrompt, selectedReferences);
    });
    captureClientEvent("edit_target_switched", { target: nextTarget, platform });
    setStatus(
      nextTarget === "profile"
        ? "Profile editing enabled"
        : "Banner editing enabled",
    );
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  }

  function handleReferenceClick(reference: ReferenceItem) {
    if (editTarget === "profile") {
      setProfileImage(reference.image);
      setProfileName(reference.name);
      setProfileHistory([]);
      setError("");
      setStatus(`${reference.label} loaded as the profile edit source`);
      captureClientEvent("reference_loaded_as_profile_source", {
        reference_label: reference.label,
        platform,
      });
      return;
    }

    const isSelected = selectedReferenceIds.includes(reference.id);
    const nextSelectedIds = isSelected
      ? selectedReferenceIds.filter((id) => id !== reference.id)
      : [reference.id, ...selectedReferenceIds.filter((id) => id !== reference.id)]
          .slice(0, MAX_REFERENCE_IMAGES_PER_RUN);
    const nextSelectedReferences = references.filter((item) =>
      nextSelectedIds.includes(item.id),
    );
    setSelectedReferenceIds(nextSelectedIds);
    setPrompt((value) => syncReferenceInstructions(value, nextSelectedReferences));

    if (isSelected) {
      setStatus(`${reference.label} parked again`);
      captureClientEvent("reference_deselected_for_generation", {
        reference_label: reference.label,
        target: editTarget,
        platform,
      });
      return;
    }

    captureClientEvent("reference_selected_for_generation", {
      reference_label: reference.label,
      target: editTarget,
      platform,
    });
    setStatus(`${reference.label} selected for the next banner run`);
  }

  async function generateImage() {
    if (!canGenerate) return;

    const promptTargetHint = getPromptTargetHint(prompt);
    if (promptTargetHint && promptTargetHint !== editTarget) {
      const hintedTargetName =
        promptTargetHint === "profile" ? config.profileLabel : config.bannerLabel;
      setError(
        `This prompt looks like a ${hintedTargetName}. Switch to ${
          promptTargetHint === "profile" ? "Profile" : "Banner"
        } mode first.`,
      );
      captureClientEvent("wrong_mode_prompt_blocked", {
        target: editTarget,
        platform,
      });
      setStatus("Wrong edit mode");
      return;
    }

    setIsGenerating(true);
    setError("");
    setStatus(`${selectedModelLabel} is composing · ${sourceSummary}`);
    const generationEvent = {
      model,
      target: editTarget,
      platform,
      has_current_image: Boolean(activeImage),
      reference_count: runReferences.length,
      selected_reference_count: selectedReferenceIds.length,
      source_mode: sourceMode,
    };
    captureClientEvent("generation_started", generationEvent);
    if (lastMovedTarget === editTarget) {
      captureClientEvent("generation_started_after_move", generationEvent);
    }
    setLastMovedTarget(null);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("model", model);
      formData.append("target", editTarget);
      formData.append("platform", platform);
      const attachedImageCount =
        (editTarget === "banner" && currentImage ? 1 : 0) +
        (editTarget === "profile" && profileImage ? 1 : 0) +
        runReferences.length;
      const imageByteBudget = Math.max(
        MIN_GENERATION_IMAGE_BYTES,
        Math.floor(MAX_GENERATION_UPLOAD_BYTES / Math.max(1, attachedImageCount) - 8_192),
      );
      let uploadBytes = 0;
      const appendUploadImage = async (
        key: string,
        dataUrl: string,
        name: string,
        kind: UploadImageKind,
      ) => {
        const file = await dataUrlToFile(
          dataUrl,
          name,
          kind,
          imageByteBudget,
          config.bannerSize,
        );
        uploadBytes += file.size;

        if (uploadBytes > MAX_GENERATION_UPLOAD_BYTES) {
          throw new Error(
            "That run has too much image data. Remove a few references or try again with fewer source images.",
          );
        }

        formData.append(key, file);
      };

      if (editTarget === "banner" && currentImage) {
        await appendUploadImage(
          "currentImage",
          currentImage,
          `${platform}-banner-current.jpg`,
          "banner",
        );
      }

      if (editTarget === "profile" && profileImage) {
        await appendUploadImage(
          "currentImage",
          profileImage,
          `${platform}-profile-current.jpg`,
          "profile",
        );
      }

      for (const reference of runReferences) {
        await appendUploadImage(
          "referenceImages",
          reference.image,
          `${reference.label}-${reference.name}`,
          "reference",
        );
        formData.append("referenceLabels", reference.label);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const payload = await readGeneratePayload(response);

      if (!response.ok || !payload.imageBase64) {
        throw new Error(payload.error || "No image returned.");
      }

      let nextImage = `data:${payload.mimeType || "image/png"};base64,${
        payload.imageBase64
      }`;

      const nextItem: HistoryItem = {
        id: crypto.randomUUID(),
        image: nextImage,
        prompt: prompt.trim(),
        model: payload.model || model,
        createdAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      if (editTarget === "profile") {
        setProfileImage(nextImage);
        setProfileName("AI profile picture");
        setProfileHistory((items) => [nextItem, ...items].slice(0, 8));
      } else {
        setCurrentImage(nextImage);
        setHistory((items) => [nextItem, ...items].slice(0, 8));
      }

      captureClientEvent("image_generated", {
        model: payload.model || model,
        target: editTarget,
        platform,
        has_current_image: editTarget === "banner" ? !!currentImage : !!profileImage,
        reference_count: runReferences.length,
        selected_reference_count: selectedReferenceIds.length,
        source_mode: sourceMode,
        prompt_renderer_used: false,
      });
      markFirstRunDone();

      setStatus(
        editTarget === "profile"
          ? "Profile result loaded for next iteration"
          : "Banner result loaded for next iteration",
      );
    } catch (generationError) {
      const errorMessage =
        generationError instanceof Error ? generationError.message : "Generation failed.";
      captureClientEvent("image_generation_failed", {
        model,
        target: editTarget,
        platform,
        error_kind: getGenerationErrorKind(errorMessage),
      });
      setError(errorMessage);
      setStatus("Needs attention");
    } finally {
      setIsGenerating(false);
    }
  }

  async function downloadImage(withTemplate: boolean) {
    if (!activeImage) return;

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = editTarget === "profile" ? 1024 : config.bannerSize.width;
      canvas.height = editTarget === "profile" ? 1024 : config.bannerSize.height;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#111111";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawCoverImage(context, image, canvas.width, canvas.height);

      if (withTemplate && editTarget === "profile") {
        drawProfileProof(context);
      } else if (withTemplate) {
        drawBannerProof(context, platform);
      }

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download =
        editTarget === "profile"
          ? withTemplate
            ? config.profileProofName
            : config.profileDownloadName
          : withTemplate
            ? config.bannerProofName
            : config.bannerDownloadName;
      link.click();
      captureClientEvent("image_downloaded", {
        target: editTarget,
        with_template: withTemplate,
        platform,
      });
      setStatus(
        withTemplate
          ? `${editTarget === "profile" ? "Profile" : "Banner"} proof exported`
          : `${editTarget === "profile" ? "Profile" : "Banner"} PNG exported`,
      );
    };
    image.onerror = () => setError("Could not export this image.");
    image.src = activeImage;
  }

  async function downloadProfilePicture() {
    if (!profileImage) return;

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#111111";
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawCoverImage(context, image, canvas.width, canvas.height);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = config.profileDownloadName;
      link.click();
      captureClientEvent("image_downloaded", {
        target: "profile",
        with_template: false,
        source: editTarget === "profile" ? "active_export" : "persistent_button",
        platform,
      });
      setStatus("Profile PNG exported");
    };
    image.onerror = () => setError("Could not export this profile image.");
    image.src = profileImage;
  }

  function resetWork() {
    if (editTarget === "profile") {
      setProfileImage("");
      setProfileName("");
      setProfileHistory([]);
    } else {
      setCurrentImage("");
      setHistory([]);
    }

    setError("");
    setLastMovedTarget(null);
    setStatus(
      references.length
        ? `${editTarget === "profile" ? "Profile" : "Banner"} cleared; references kept`
        : "Ready",
    );
  }

  function moveActiveImageToReferences() {
    const imageToMove = activeImage;
    const targetToMove = editTarget;
    const targetName =
      targetToMove === "profile" ? config.profileLabel : config.bannerLabel;
    const movedName =
      targetToMove === "profile"
        ? "moved-profile.png"
        : `moved-${platform}-banner.png`;

    if (!imageToMove) return;

    captureClientEvent("move_to_references_clicked", {
      target: targetToMove,
      platform,
    });

    const movedImageBytes = getDataUrlBytes(imageToMove);
    if (movedImageBytes > MAX_CLIENT_TOTAL_IMAGE_BYTES) {
      setError(`That ${targetName} is too large to save as a reference.`);
      return;
    }

    const createdAt = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setReferences((items) => {
      const withoutDuplicate = items.filter((item) => item.image !== imageToMove);
      const movedReference: ReferenceItem = {
        id: crypto.randomUUID(),
        image: imageToMove,
        name: movedName,
        label: `R${getNextReferenceNumber(withoutDuplicate) + 1}`,
        createdAt,
      };
      const nextItems = [movedReference, ...withoutDuplicate].slice(
        0,
        MAX_STORED_REFERENCE_IMAGES,
      );
      let totalBytes = nextItems.reduce(
        (total, reference) => total + getDataUrlBytes(reference.image),
        0,
      );

      while (
        totalBytes > MAX_CLIENT_TOTAL_IMAGE_BYTES &&
        nextItems.length > 1
      ) {
        const removedReference = nextItems.pop();
        totalBytes -= removedReference
          ? getDataUrlBytes(removedReference.image)
          : 0;
      }

      return nextItems;
    });
    if (targetToMove === "profile") {
      setProfileImage("");
      setProfileName("");
      setProfileHistory([]);
    } else {
      setCurrentImage("");
      setHistory([]);
    }
    setLastMovedTarget(targetToMove);
    setError("");
    setStatus(`${targetName} moved to references and parked until clicked`);
    captureClientEvent("current_image_moved_to_references", {
      target: targetToMove,
      platform,
    });
  }

  async function clearAllLocalData() {
    const confirmed = window.confirm(
      "Clear all local CanvaKilla data from this browser? This removes saved references, profile photos, generated images, prompts, and history.",
    );

    if (!confirmed) return;

    setReferences([]);
    setSelectedReferenceIds([]);
    setProfileImage("");
    setProfileName("");
    setCurrentImage("");
    setPrompt(config.bannerPrompts[0]);
    setModel(DEFAULT_IMAGE_MODEL_ID);
    setTemplateVisible(true);
    setEditTarget("banner");
    setPreviewMode("desktop");
    setHistory([]);
    setProfileHistory([]);
    setLastMovedTarget(null);
    setFirstRunDone(false);
    setDismissedCropTips([]);
    setError("");

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("canvakilla-session-id");
      window.localStorage.removeItem(firstRunDoneKey);
      window.localStorage.removeItem(dismissedCropTipsKey);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (profileInputRef.current) profileInputRef.current.value = "";

    try {
      await deleteWorkspaceDb();
      setStatus("Local images, prompts, and history cleared");
    } catch {
      setStatus("Cleared current view; reload if local storage was busy");
    }
  }

  return (
    <main className={`app-shell platform-${platform}`}>
      <section className="workspace" aria-label={`${config.platformName} banner maker`}>
        <section className="control-panel">
          <nav className="platform-tabs" aria-label="Platform">
            {PLATFORM_IDS.map((platformId) => {
              const item = PLATFORM_CONFIGS[platformId];
              return (
                <Link
                  className={platformId === platform ? "is-active" : ""}
                  href={item.route}
                  key={platformId}
                  aria-current={platformId === platform ? "page" : undefined}
                >
                  {item.tabLabel}
                </Link>
              );
            })}
          </nav>

          <div className="brand-bar">
            <div className="brand-title">
              <img src="/logo.svg" alt="" aria-hidden="true" />
              <p className="eyebrow">{config.brandEyebrow}</p>
              <h1>{config.appName}</h1>
            </div>
            <span className="size-pill">{activeSize}</span>
          </div>

          <div className="quick-start-card" aria-label="How to use CanvaKilla">
            <span className="quick-start-kicker">{config.quickStartKicker}</span>
            <strong>{config.quickStartTitle}</strong>
            <p>{config.quickStartBody}</p>
          </div>

          <div className="target-switch" role="group" aria-label="Edit target">
            <button
              className={editTarget === "banner" ? "is-active" : ""}
              type="button"
              aria-pressed={editTarget === "banner"}
              onClick={() => switchEditTarget("banner")}
            >
              <Layers size={16} aria-hidden="true" />
              Banner
            </button>
            <button
              className={editTarget === "profile" ? "is-active" : ""}
              type="button"
              aria-pressed={editTarget === "profile"}
              onClick={() => switchEditTarget("profile")}
            >
              <ImagePlus size={16} aria-hidden="true" />
              Profile
            </button>
          </div>

          <label
            className="upload-zone"
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
            />
            <span className="upload-icon">
              <Upload size={20} aria-hidden="true" />
            </span>
            <span>
              <strong>Upload references</strong>
              <small>
                {showFirstRunNudge
                  ? config.firstRunNudge
                  : "Newest stays on top"}
              </small>
            </span>
          </label>

          {references.length > 0 && (
            <div className="reference-stack" aria-label="Uploaded references">
              {references.map((reference) => {
                const isSelected = selectedReferenceIds.includes(reference.id);
                const isProfileSource =
                  editTarget === "profile" && profileImage === reference.image;
                return (
                  <button
                    className={`reference-card${
                      (editTarget === "banner" && isSelected) || isProfileSource
                        ? " is-selected"
                        : ""
                    }`}
                    key={reference.id}
                    type="button"
                    aria-pressed={
                      editTarget === "banner" ? isSelected : undefined
                    }
                    onClick={() => handleReferenceClick(reference)}
                    title={
                      editTarget === "profile"
                        ? `Load ${reference.label} as the profile edit source`
                        : isSelected
                          ? `Remove ${reference.label} from the next banner prompt`
                          : `Use ${reference.label} in the next banner prompt`
                    }
                  >
                    <img src={reference.image} alt="" />
                    <span>
                      <strong>{reference.label}</strong>
                      <small>{reference.name}</small>
                      <em>
                        {editTarget === "profile"
                          ? isProfileSource
                            ? "Profile source"
                            : "Click to edit as profile"
                          : isSelected
                            ? "Selected for next run"
                            : "Parked until clicked"}
                      </em>
                      {((editTarget === "banner" && isSelected) ||
                        isProfileSource) && (
                        <b>
                          <BadgeCheck size={12} aria-hidden="true" />
                          {isProfileSource ? "Profile source" : "Using"}
                        </b>
                      )}
                    </span>
                  </button>
                );
              })}
              {references.length > MAX_REFERENCE_IMAGES_PER_RUN && (
                <p className="reference-limit">
                  Up to {MAX_REFERENCE_IMAGES_PER_RUN} clicked references can be
                  sent per run.
                </p>
              )}
            </div>
          )}

          <label
            className={`profile-upload${
              editTarget === "profile" ? " is-active" : ""
            }`}
          >
            <input
              ref={profileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => handleProfileFiles(event.target.files)}
            />
            <span className="profile-thumb" data-empty={!profileImage}>
              {profileImage ? (
                <img src={profileImage} alt="" />
              ) : (
                <ImagePlus size={18} aria-hidden="true" />
              )}
            </span>
            <span>
              <strong>{profileName || "Upload profile pic"}</strong>
              <small>
                {editTarget === "profile"
                  ? "Current profile edit source"
                  : "Preview overlay and edit source"}
              </small>
            </span>
          </label>

          <button
            className="profile-download-button"
            type="button"
            onClick={downloadProfilePicture}
            disabled={!profileImage}
            title="Download current profile picture PNG"
          >
            <Download size={16} aria-hidden="true" />
            Download Profile PNG
          </button>

          <div className="field-stack">
            <div className="field-row">
              <label htmlFor="model">Model</label>
              <select
                id="model"
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  captureClientEvent("model_changed", {
                    model: event.target.value,
                    platform,
                  });
                }}
              >
                {IMAGE_MODEL_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="prompt-field" htmlFor="prompt">
              <span>Next {activeTargetName} edit</span>
              <textarea
                ref={promptRef}
                id="prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={
                  showFirstRunNudge
                    ? editTarget === "profile"
                      ? 'Try: "Make this a polished professional headshot"\nTry: "Clean background, square format, circular crop"'
                      : 'Try: "Make this more dramatic"\nTry: "Add a sci-fi feel"'
                    : `Describe the next ${activeTargetName} edit`
                }
                rows={8}
              />
              <small className="source-helper">
                {activeImage
                  ? `Current ${activeTargetName} is sent when you iterate. Park it first for a prompt-only run.`
                  : `No current ${activeTargetName} yet.`}{" "}
                {editTarget === "profile"
                  ? "Click a reference to load it as the profile edit source."
                  : "Click a reference to call it out in the prompt."}{" "}
                {sourceSummary}.
              </small>
            </label>

            <div className="run-preflight" aria-label="Next generation source">
              <span>Next run will use</span>
              <strong>{sourceModeLabel}</strong>
              <div>
                <em>{activeImage ? "Active image sent" : "No active image"}</em>
                <em>
                  {runReferences.length
                    ? `${runReferences.length} clicked ref${
                        runReferences.length === 1 ? "" : "s"
                      } sent`
                    : "No clicked refs sent"}
                </em>
                {parkedReferenceCount > 0 && (
                  <em>
                    {parkedReferenceCount} parked ref
                    {parkedReferenceCount === 1 ? "" : "s"} not sent
                  </em>
                )}
              </div>
              {activeImage && (
                <button
                  className="source-action"
                  type="button"
                  onClick={moveActiveImageToReferences}
                >
                  <ImagePlus size={14} aria-hidden="true" />
                  Start fresh: park current
                </button>
              )}
            </div>

            <div className="prompt-chips" aria-label="Prompt starters">
              {activePromptStarters.map((starter, index) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => {
                    setPrompt(
                      editTarget === "banner"
                        ? syncReferenceInstructions(starter, runReferences)
                        : starter,
                    );
                    captureClientEvent("prompt_starter_clicked", {
                      starter_index: index,
                      target: editTarget,
                      platform,
                    });
                  }}
                  title={`Prompt ${index + 1}`}
                >
                  <Sparkles size={14} aria-hidden="true" />
                  {index + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="action-grid">
            <button
              className="primary-action"
              type="button"
              onClick={generateImage}
              disabled={!canGenerate}
            >
              {isGenerating ? (
                <Loader2 className="spin" size={18} aria-hidden="true" />
              ) : (
                <Sparkles size={18} aria-hidden="true" />
              )}
              {primaryActionLabel}
            </button>
            <button
              className="icon-action"
              type="button"
              onClick={() =>
                setTemplateVisible((visible) => {
                  const nextVisible = !visible;
                  captureClientEvent("template_toggled", {
                    platform,
                    visible: nextVisible,
                  });
                  return nextVisible;
                })
              }
              title="Toggle template"
            >
              {templateVisible ? (
                <Eye size={18} aria-hidden="true" />
              ) : (
                <EyeOff size={18} aria-hidden="true" />
              )}
              Template
            </button>
            <button
              className="icon-action"
              type="button"
              onClick={() => downloadImage(false)}
              disabled={!canExport}
              title={`Export ${activeTargetName} PNG`}
            >
              <Download size={18} aria-hidden="true" />
              {editTarget === "profile" ? "Profile PNG" : "Banner PNG"}
            </button>
            <button
              className="icon-action"
              type="button"
              onClick={() => downloadImage(true)}
              disabled={!canExport}
              title={`Export ${activeTargetName} proof`}
            >
              <Layers size={18} aria-hidden="true" />
              Proof PNG
            </button>
          </div>

          <div className="privacy-control">
            <p>
              Local-only autosave keeps images, prompts, and history in this
              browser's IndexedDB.
            </p>
            <button type="button" onClick={clearAllLocalData}>
              <Trash2 size={16} aria-hidden="true" />
              Clear all local data
            </button>
          </div>

          <div className="status-line" aria-live="polite">
            <span className={error ? "status-dot danger" : "status-dot"} />
            <span>{error || status}</span>
          </div>
        </section>

        <section className={`preview-panel preview-${previewMode}`}>
          <div className="preview-toolbar">
            <button
              className="x-icon-button"
              type="button"
              onClick={resetWork}
              title="Clear generated result"
            >
              <RefreshCcw size={18} aria-hidden="true" />
            </button>
            <div>
              <h2>
                {previewModeLabel} {config.platformName} Preview
              </h2>
              <span>
                {activeHistory.length} {activeTargetName} iterations
              </span>
            </div>
            <div
              className="preview-mode-switch"
              role="group"
              aria-label="Preview layout"
            >
              <button
                className={previewMode === "desktop" ? "is-active" : ""}
                type="button"
                aria-pressed={previewMode === "desktop"}
                onClick={() => setPreviewMode("desktop")}
              >
                <Monitor size={16} aria-hidden="true" />
                Desktop
              </button>
              <button
                className={previewMode === "mobile" ? "is-active" : ""}
                type="button"
                aria-pressed={previewMode === "mobile"}
                onClick={() => setPreviewMode("mobile")}
              >
                <Smartphone size={16} aria-hidden="true" />
                Mobile
              </button>
            </div>
          </div>

          {platform === "linkedin" ? (
            previewMode === "desktop" ? (
              <LinkedInDesktopPreview
                config={config}
                currentImage={currentImage}
                profileImage={profileImage}
                editTarget={editTarget}
                templateVisible={templateVisible}
                dismissedCropTips={dismissedCropTips}
                onDismissCropTip={dismissCropTip}
                onMoveActiveToReferences={moveActiveImageToReferences}
                references={references}
              />
            ) : (
              <LinkedInMobilePreview
                config={config}
                currentImage={currentImage}
                profileImage={profileImage}
                editTarget={editTarget}
                templateVisible={templateVisible}
                dismissedCropTips={dismissedCropTips}
                onDismissCropTip={dismissCropTip}
                onMoveActiveToReferences={moveActiveImageToReferences}
                references={references}
              />
            )
          ) : previewMode === "desktop" ? (
            <div className="x-desktop-preview">
              <nav className="x-left-nav" aria-label="X preview navigation">
                <XIcon className="x-logo" size={32} aria-hidden="true" />
                <span className="x-nav-item is-active">
                  <HomeIcon size={24} aria-hidden="true" />
                  Home
                </span>
                <span className="x-nav-item">
                  <Search size={24} aria-hidden="true" />
                  Explore
                </span>
                <span className="x-nav-item">
                  <Bell size={24} aria-hidden="true" />
                  Notifications
                </span>
                <span className="x-nav-item">
                  <MessageCircle size={24} aria-hidden="true" />
                  Chat
                </span>
                <span className="x-nav-item">
                  <GrokIcon size={24} />
                  SuperGrok
                </span>
                <span className="x-nav-item">
                  <BadgeCheck size={24} aria-hidden="true" />
                  Premium+
                </span>
                <span className="x-nav-item">
                  <Bookmark size={24} aria-hidden="true" />
                  Bookmarks
                </span>
                <span className="x-nav-item">
                  <Rocket size={24} aria-hidden="true" />
                  Creator Studio
                </span>
                <span className="x-nav-item">
                  <FileText size={24} aria-hidden="true" />
                  Articles
                </span>
                <span className="x-nav-item">
                  <UserRound size={24} aria-hidden="true" />
                  Profile
                </span>
                <span className="x-nav-item">
                  <CircleEllipsis size={24} aria-hidden="true" />
                  More
                </span>
                <span className="x-post-button" aria-hidden="true">
                  Post
                </span>
                <div className="x-account-mini">
                  <span className="x-account-avatar">
                    {profileImage ? <img src={profileImage} alt="" /> : null}
                  </span>
                  <span>
                    <strong>Joe Wilson</strong>
                    <small>@joewilsonai</small>
                  </span>
                  <MoreHorizontal size={18} aria-hidden="true" />
                </div>
              </nav>

              <div className="x-center-column">
                <div className="x-real-topbar">
                  <span className="x-round-button" aria-hidden="true">
                    <ArrowLeft size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>
                      Banner Preview <span className="verified-badge">✓</span>
                    </h2>
                    <span>11.2K posts</span>
                  </div>
                  <div className="x-real-topbar-actions">
                    <GrokIcon size={22} />
                    <Search size={22} aria-hidden="true" />
                  </div>
                </div>

                <div className="x-real-banner" data-empty={!currentImage}>
                  {currentImage ? (
                    <img src={currentImage} alt="Current X banner preview" />
                  ) : (
                    <div className="empty-state">
                      <ImagePlus size={34} aria-hidden="true" />
                      <span>
                        {references.length
                          ? "References ready. Iterate to create a banner"
                          : "Upload a reference image or generate from text"}
                      </span>
                    </div>
                  )}

                  {templateVisible && (
                    <div className="template-layer" aria-label="X crop guard template">
                      <div className="crop-guide top">
                        <span>
                          crop guard
                          <CropGuardTooltip
                            id="crop"
                            platform={config.id}
                            tip={config.cropTips.crop}
                            dismissed={dismissedCropTips.includes("crop")}
                            onDismiss={dismissCropTip}
                          />
                        </span>
                      </div>
                      <div className="crop-guide bottom">
                        <span>
                          crop guard
                          <CropGuardTooltip
                            id="crop"
                            platform={config.id}
                            tip={config.cropTips.crop}
                            dismissed={dismissedCropTips.includes("crop")}
                            onDismiss={dismissCropTip}
                          />
                        </span>
                      </div>
                      <div className="quiet-zone">
                        <span>
                          avatar zone
                          <CropGuardTooltip
                            id="avatar"
                            platform={config.id}
                            tip={config.cropTips.avatar}
                            dismissed={dismissedCropTips.includes("avatar")}
                            onDismiss={dismissCropTip}
                          />
                        </span>
                      </div>
                      <div className="mobile-action-zone">
                        <span>
                          mobile action
                          <CropGuardTooltip
                            id="mobile-action"
                            platform={config.id}
                            tip={config.cropTips["mobile-action"]}
                            dismissed={dismissedCropTips.includes("mobile-action")}
                            onDismiss={dismissCropTip}
                          />
                        </span>
                      </div>
                      <div className="content-rail">
                        <span>primary content</span>
                      </div>
                    </div>
                  )}
                </div>

                <section className="x-real-profile">
                  <div
                    className={`x-real-avatar${
                      editTarget === "profile" ? " is-editing" : ""
                    }`}
                  >
                    {profileImage ? (
                      <img src={profileImage} alt="" />
                    ) : (
                      <span>JW</span>
                    )}
                  </div>
                  {profileImage && editTarget === "profile" && (
                    <MoveToReferencesButton
                      className="preview-move-button x-avatar-move-button"
                      targetName={config.profileLabel}
                      onClick={moveActiveImageToReferences}
                    />
                  )}
                  <div className="x-real-actions">
                    <span className="x-round-button" aria-hidden="true">
                      <CircleEllipsis size={20} aria-hidden="true" />
                    </span>
                    <span className="x-round-button" aria-hidden="true">
                      <MessageCircle size={20} aria-hidden="true" />
                    </span>
                    <span className="x-follow-button" aria-hidden="true">
                      Follow
                    </span>
                  </div>
                  <h3>
                    Joe Wilson <span className="verified-badge">✓</span>
                  </h3>
                  <p className="x-handle">@joewilsonai</p>
                  <p className="x-bio">
                    Banner-safe AI visuals. References reusable. Crop math, solved.
                  </p>
                  <div className="x-meta-row">
                    <span>
                      <MapPin size={16} aria-hidden="true" />
                      San Francisco
                    </span>
                    <span>
                      <Link2 size={16} aria-hidden="true" />
                      joewilson.ai
                    </span>
                    <span>
                      <CalendarDays size={16} aria-hidden="true" />
                      Joined May 2026
                    </span>
                  </div>
                  <p className="x-follows">
                    <strong>1,744</strong> Following <strong>13.8K</strong>{" "}
                    Followers
                  </p>
                </section>

                <div className="x-tabs" aria-label="Profile tabs">
                  <span className="is-active">Posts</span>
                  <span>Replies</span>
                  <span>Highlights</span>
                  <span>Media</span>
                </div>

                {REAL_TWEETS.map((tweet) => (
                  <RealTweetCard key={`${tweet.handle}-${tweet.likes}`} tweet={tweet} />
                ))}
              </div>

	              <div className="x-right-rail">
                <div className="x-search-box">
                  <Search size={18} aria-hidden="true" />
                  <span>Search</span>
                </div>
                <section>
                  <h3>You might like</h3>
                  <div className="x-suggested-user">
                    <span className="x-suggested-avatar" />
                    <span>
                      <strong>
                        is the dog ok <span className="verified-badge">✓</span>
                      </strong>
                      <small>@is_dog_ok</small>
                      <small>investigating dogs in viral videos. day 1,247.</small>
                    </span>
                    <span className="x-follow-button" aria-hidden="true">Follow</span>
                  </div>
                  <div className="x-suggested-user">
                    <span className="x-suggested-avatar second" />
                    <span>
                      <strong>
                        the founder <span className="verified-badge">✓</span>
                      </strong>
                      <small>@hesthefounder</small>
                      <small>I am a founder. that is my job.</small>
                    </span>
                    <span className="x-follow-button" aria-hidden="true">Follow</span>
                  </div>
                  <div className="x-suggested-user">
                    <span className="x-suggested-avatar third" />
                    <span>
                      <strong>
                        Garfield's Lawyer{" "}
                        <span className="verified-badge">✓</span>
                      </strong>
                      <small>@garfieldlegal</small>
                      <small>litigating on behalf of Garfield since 2019.</small>
                    </span>
                    <span className="x-follow-button" aria-hidden="true">Follow</span>
                  </div>
                  <span className="x-link-button" aria-hidden="true">
                    Show more
                  </span>
                </section>
                <section>
                  <h3>What's happening</h3>
                  <p className="x-trend-item">
                    <span>Technology · Trending</span>
                    Copilot....hahahahaha
                    <small>89.4K posts</small>
                  </p>
                  <p className="x-trend-item">
                    <span>Developer Tools · Trending</span>
                    claude code rate limit sucks
                    <small>124K posts</small>
                  </p>
                  <p className="x-trend-item">
                    <span>AI Agents · Trending</span>
                    is the agent recursing
                    <small>4.7K posts</small>
                  </p>
                  <p className="x-trend-item">
                    <span>Trending in Dev</span>
                    my CLAUDE.md
                    <small>12.1K posts</small>
                  </p>
                  <span className="x-link-button" aria-hidden="true">
                    Show more
                  </span>
                </section>
	              </div>
            </div>
          ) : (
            <div className="mobile-stage">
              <div className="x-phone-preview">
                <div className="x-phone-status">
                  <span className="x-phone-status-left">
                    <strong>3:04</strong>
                    <Navigation size={16} aria-hidden="true" />
                  </span>
                  <span className="x-phone-status-right">
                    <span className="cell-bars" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>5G+</strong>
                    <span className="battery-low" aria-hidden="true">
                      <span>16</span>
                    </span>
                  </span>
                </div>
                <div className="x-phone-nav">
                  <span className="x-round-button" aria-hidden="true">
                    <ArrowLeft size={24} aria-hidden="true" />
                  </span>
                  <span>
                    <GrokIcon size={25} />
                    <Search size={25} aria-hidden="true" />
                    <CircleEllipsis size={25} aria-hidden="true" />
                  </span>
                </div>
                <div className="x-mobile-banner" data-empty={!currentImage}>
                  {currentImage ? (
                    <img src={currentImage} alt="Mobile X banner preview" />
                  ) : (
                    <div className="empty-state">
                      <ImagePlus size={30} aria-hidden="true" />
                      <span>Create a banner to preview mobile</span>
                    </div>
                  )}

	                  {templateVisible && (
	                    <div
	                      className="template-layer mobile-template"
	                      aria-label="Mobile X quiet-zone template"
	                    >
                      <div className="quiet-zone">
                        <span>
                          avatar
                          <CropGuardTooltip
                            id="avatar"
                            platform={config.id}
                            tip={config.cropTips.avatar}
                            dismissed={dismissedCropTips.includes("avatar")}
                            onDismiss={dismissCropTip}
                          />
                        </span>
                      </div>
                      <div className="mobile-action-zone">
                        <span>
                          mobile action
                          <CropGuardTooltip
                            id="mobile-action"
                            platform={config.id}
                            tip={config.cropTips["mobile-action"]}
                            dismissed={dismissedCropTips.includes("mobile-action")}
                            onDismiss={dismissCropTip}
                          />
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <section className="x-mobile-profile">
                  <div
                    className={`x-mobile-avatar${
                      editTarget === "profile" ? " is-editing" : ""
                    }`}
                  >
                    {profileImage ? (
                      <img src={profileImage} alt="" />
                    ) : (
                      <span>JW</span>
                    )}
                  </div>
                  {profileImage && editTarget === "profile" && (
                    <MoveToReferencesButton
                      className="preview-move-button x-mobile-avatar-move-button"
                      targetName={config.profileLabel}
                      onClick={moveActiveImageToReferences}
                    />
                  )}
                  <div className="x-mobile-actions">
                    <span className="x-round-button" aria-hidden="true">
                      <MessageCircle size={26} aria-hidden="true" />
                    </span>
                    <span className="x-follow-button" aria-hidden="true">
                      Follow
                    </span>
                  </div>
                  <h3>
                    Joe Wilson <span className="verified-badge">✓</span>
                  </h3>
                  <p className="x-handle">@joewilsonai</p>
                  <p className="x-mobile-bio">
                    Banner-safe AI visuals. References reusable. Crop math,
                    solved.
                  </p>
                  <div className="x-mobile-meta">
                    <span>
                      <MapPin size={18} aria-hidden="true" />
                      Philadelphia, PA
                    </span>
                    <span>
                      <Link2 size={18} aria-hidden="true" />
                      joewilson.ai/profile
                    </span>
                    <span>
                      <CalendarDays size={18} aria-hidden="true" />
                      Joined May 2026
                    </span>
                  </div>
                  <p className="x-follows">
                    <strong>584</strong> Following <strong>351.6K</strong>{" "}
                    Followers
                  </p>
                  <div className="x-mobile-social">
                    <span className="social-avatar-stack" aria-hidden="true">
                      <span className="social-avatar one" />
                      <span className="social-avatar two" />
                      <span className="social-avatar three" />
                    </span>
                    <p>Followed by Wes Roth, Vivi, Keith Sakata, MD, and 39 others</p>
                  </div>
                  <div className="x-tabs x-mobile-tabs">
                    <span className="is-active">Posts</span>
                    <span>Replies</span>
                    <span>Highlights</span>
                    <span>Videos</span>
                    <span>Photos</span>
                    <span>Articles</span>
                  </div>
                </section>

                {REAL_TWEETS.slice(0, 6).map((tweet, index) => (
                  <RealTweetCard
                    key={`${tweet.handle}-${tweet.likes}`}
                    tweet={tweet}
                    variant="mobile"
                    pinned={index === 0}
                  />
                ))}

                <div className="x-mobile-compose">
                  <Plus size={40} aria-hidden="true" />
                </div>
                <div className="x-mobile-tabbar">
                  <HomeIcon size={28} aria-hidden="true" />
                  <Search size={28} aria-hidden="true" />
                  <GrokIcon size={28} />
                  <Bell size={28} aria-hidden="true" />
                  <MessageCircle size={28} aria-hidden="true" />
                </div>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
