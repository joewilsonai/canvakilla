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
  PLATFORM_CONFIGS,
  PLATFORM_IDS,
  type CropTipId,
  type EditTarget,
  type PlatformConfig,
  type PlatformId,
} from "../lib/platforms";
import { captureClientEvent } from "../lib/posthog-client";

type HistoryItem = {
  id: string;
  image: string;
  prompt: string;
  model: string;
  createdAt: string;
};

type PreviewMode = "desktop" | "mobile";

type ReferenceItem = {
  id: string;
  image: string;
  name: string;
  label: string;
  createdAt: string;
};

type GenerateResponse = {
  imageBase64?: string;
  mimeType?: string;
  model?: string;
  error?: string;
};

type UploadImageKind = "banner" | "profile" | "reference";

type PersistedWorkspace = {
  editTarget?: EditTarget;
  previewMode?: PreviewMode;
  references?: ReferenceItem[];
  sourceImage: string;
  sourceName: string;
  profileImage: string;
  profileName: string;
  currentImage: string;
  prompt: string;
  model: string;
  templateVisible: boolean;
  history: HistoryItem[];
  profileHistory?: HistoryItem[];
};

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
const REFERENCE_UPLOAD_MAX_EDGE = 1400;
const PROFILE_UPLOAD_SIZE = 1024;
const ACCEPTED_CLIENT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MODELS = [
  {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
  },
  {
    id: "google/gemini-2.5-flash-image",
    label: "Nano Banana",
  },
];

const LEGACY_MODEL_IDS: Record<string, string> = {
  "gpt-image-2": "openai/gpt-5.4-image-2",
  "gemini-3.1-flash-image-preview": "google/gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image": "google/gemini-2.5-flash-image",
  "gemini-3-pro-image-preview": "google/gemini-3-pro-image-preview",
};

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
  tip,
  dismissed,
  onDismiss,
}: {
  id: CropTipId;
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
          setIsOpen((open) => !open);
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
  references: ReferenceItem[];
};

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
  "config" | "currentImage" | "templateVisible" | "dismissedCropTips" | "onDismissCropTip"
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

        <aside className="linkedin-right-rail" aria-label="LinkedIn right rail preview">
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
        </aside>
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

function normalizeModelId(modelId: string) {
  const nextModel = LEGACY_MODEL_IDS[modelId] || modelId;
  return MODELS.some((item) => item.id === nextModel) ? nextModel : MODELS[0].id;
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function getNextReferenceNumber(references: ReferenceItem[]) {
  return references.reduce((max, reference) => {
    const number = Number(reference.label.replace(/^R/, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
}

function normalizeReferenceItems(references: ReferenceItem[]) {
  return references.map((reference) => ({
    id: reference.id,
    image: reference.image,
    name: reference.name,
    label: reference.label,
    createdAt: reference.createdAt,
  }));
}

function getPromptReferenceLabels(prompt: string) {
  const labels = new Set<string>();

  for (const match of prompt.matchAll(/\bR(\d{1,3})\b/gi)) {
    labels.add(`R${Number(match[1])}`);
  }

  return labels;
}

function getReferenceInstruction(reference: ReferenceItem) {
  return `Use Reference ${reference.label} (${reference.name}) as a visual reference.`;
}

function removeReferenceInstruction(prompt: string, reference: ReferenceItem) {
  const escapedLabel = reference.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedName = reference.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exactLine = new RegExp(
    `\\n{0,2}Use Reference ${escapedLabel} \\(${escapedName}\\) as a visual reference\\.\\n{0,2}`,
    "g",
  );
  const genericLine = new RegExp(
    `\\n{0,2}Use Reference ${escapedLabel} \\([^\\n]+\\) as a visual reference\\.\\n{0,2}`,
    "g",
  );

  return prompt
    .replace(exactLine, "\n\n")
    .replace(genericLine, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

async function dataUrlToFile(
  dataUrl: string,
  name: string,
  kind: UploadImageKind,
  maxBytes: number,
  bannerSize: { width: number; height: number },
) {
  const image = await loadDataUrlImage(dataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare that image for generation.");
  }

  if (kind === "banner") {
    canvas.width = bannerSize.width;
    canvas.height = bannerSize.height;
    context.fillStyle = "#111111";
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawCoverImage(context, image, canvas.width, canvas.height);
  } else if (kind === "profile") {
    canvas.width = PROFILE_UPLOAD_SIZE;
    canvas.height = PROFILE_UPLOAD_SIZE;
    context.fillStyle = "#111111";
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawCoverImage(context, image, canvas.width, canvas.height);
  } else {
    const scale = Math.min(
      1,
      REFERENCE_UPLOAD_MAX_EDGE / image.naturalWidth,
      REFERENCE_UPLOAD_MAX_EDGE / image.naturalHeight,
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.fillStyle = "#111111";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }

  return canvasToUploadFile(canvas, name, maxBytes);
}

function loadDataUrlImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image for generation."));
    image.src = dataUrl;
  });
}

async function canvasToUploadFile(
  sourceCanvas: HTMLCanvasElement,
  name: string,
  maxBytes: number,
) {
  const qualities = [0.86, 0.74, 0.62, 0.5];
  let canvas = sourceCanvas;
  let lastBlob: Blob | null = null;

  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      lastBlob = blob;
      if (blob.size <= maxBytes) {
        return new File([blob], toJpegName(name), { type: "image/jpeg" });
      }
    }

    canvas = downscaleCanvas(canvas, 0.78);
  }

  if (!lastBlob) {
    throw new Error("Could not prepare that image for generation.");
  }

  return new File([lastBlob], toJpegName(name), { type: "image/jpeg" });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not prepare that image for generation."));
        }
      },
      type,
      quality,
    );
  });
}

function downscaleCanvas(sourceCanvas: HTMLCanvasElement, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const context = canvas.getContext("2d");

  if (!context) return sourceCanvas;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toJpegName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}.jpg`;
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

type TypeLockSpec = {
  headlineLines: string[];
  subline?: string;
};

function getPromptTargetHint(prompt: string): EditTarget | null {
  const normalized = prompt.toLowerCase();

  if (
    /\b(banner|cover|header)\b/.test(normalized) ||
    normalized.includes("1584x396") ||
    normalized.includes("1500x500") ||
    normalized.includes("wide editorial")
  ) {
    return "banner";
  }

  if (
    normalized.includes("profile picture") ||
    normalized.includes("profile photo") ||
    normalized.includes("headshot") ||
    normalized.includes("avatar") ||
    normalized.includes("circular crop") ||
    normalized.includes("square format")
  ) {
    return "profile";
  }

  return null;
}

function isPromptDirectiveLine(line: string) {
  return /^(make|add|then|under|aesthetic|flat|no |no,|strong|keep|lower-|lower |wide |dark |right side|on the|the single)\b/i.test(
    line,
  );
}

function trimInlineDirectiveTail(line: string) {
  return line
    .split(
      /\s+(?:Make the period|Add a short|Under the divider|Aesthetic:|Flat graphic|NO\s|No gradients|Strong negative|Keep all|Lower-left|Lower-right)\b/i,
    )[0]
    .trim();
}

function cleanExactTextLine(line: string) {
  return trimInlineDirectiveTail(line)
    .replace(/^["'“”]+/, "")
    .replace(/["'“”]+$/, "")
    .trim();
}

function extractReadingExactlyBlocks(prompt: string) {
  const blocks: string[][] = [];
  const marker = /reading exactly:/gi;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(prompt))) {
    const lines = prompt.slice(marker.lastIndex).split(/\r?\n/);
    const collected: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        if (collected.length) break;
        continue;
      }

      if (collected.length && isPromptDirectiveLine(line)) break;

      const cleanLine = cleanExactTextLine(line);
      if (cleanLine) collected.push(cleanLine);

      if (rawLine === lines[0] && !prompt.slice(marker.lastIndex).startsWith("\n")) {
        break;
      }
    }

    if (collected.length) blocks.push(collected);
  }

  return blocks;
}

function extractQuotedPromptText(prompt: string) {
  return [...prompt.matchAll(/["“]([^"”]+)["”]/g)].map((match) =>
    match[1].trim(),
  );
}

function getQuotedSubline(prompt: string) {
  const explicitSubline = prompt.match(
    /(?:smaller|muted|subline|below(?: the divider)?)[^"“]*["“]([^"”]+)["”]/i,
  )?.[1];
  if (explicitSubline) return explicitSubline.trim();

  return (
    extractQuotedPromptText(prompt).find((item) => {
      const normalized = item.toLowerCase();
      return (
        item.includes("\u2192") ||
        item.includes("->") ||
        normalized.includes("microsoft") ||
        normalized.includes("amazon") ||
        normalized.includes("rapsodo")
      );
    }) || ""
  );
}

function getQuotedHeadlineLines(prompt: string) {
  const subline = getQuotedSubline(prompt);
  const headline = extractQuotedPromptText(prompt).find((item) => {
    if (item === subline) return false;
    const normalized = item.toLowerCase();
    return (
      normalized !== "made with canvakilla.com" &&
      !normalized.includes("canvakilla.com") &&
      !item.includes("\u2192") &&
      !item.includes("->")
    );
  });

  if (!headline) return [];

  const sentenceLines = headline
    .split(/(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (sentenceLines.length > 1 && sentenceLines.length <= 4) {
    return sentenceLines;
  }

  return [headline];
}

function getTypeLockSpec(prompt: string, platform: PlatformId): TypeLockSpec | null {
  const normalized = prompt.toLowerCase();
  if (
    normalized.includes("not just talking about ai") &&
    normalized.includes("shipping it") &&
    normalized.includes("microsoft") &&
    normalized.includes("amazon") &&
    normalized.includes("rapsodo")
  ) {
    return {
      headlineLines: ["not just talking", "about AI.", "shipping it."],
      subline: "microsoft \u2192 amazon \u2192 rapsodo \u2192 solo",
    };
  }

  const exactBlocks = extractReadingExactlyBlocks(prompt);
  const headlineLines = exactBlocks[0]?.slice(0, 4) || getQuotedHeadlineLines(prompt);
  const subline = exactBlocks[1]?.join(" ") || getQuotedSubline(prompt);

  if (!headlineLines.length) return null;
  if (
    !normalized.includes("banner") &&
    !normalized.includes("cover") &&
    !normalized.includes("header") &&
    !normalized.includes(platform === "x" ? "x" : "linkedin")
  ) {
    return null;
  }

  if (
    !normalized.includes("monospace") &&
    !normalized.includes("typography") &&
    !normalized.includes("typewriter") &&
    !normalized.includes("editorial")
  ) {
    return null;
  }

  return { headlineLines, subline };
}

function drawSubtleGrid(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save();
  context.lineWidth = 1;

  for (let x = 0; x <= width; x += 24) {
    context.strokeStyle = x % 96 === 0 ? "rgba(246, 238, 218, 0.055)" : "rgba(246, 238, 218, 0.026)";
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  for (let y = 0; y <= height; y += 24) {
    context.strokeStyle = y % 96 === 0 ? "rgba(246, 238, 218, 0.05)" : "rgba(246, 238, 218, 0.024)";
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.restore();
}

function drawMonoText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  context.fillText(text, x, y);
}

function fitMonoFontSize(
  context: CanvasRenderingContext2D,
  lines: string[],
  weight: number,
  startSize: number,
  minSize: number,
  maxWidth: number,
) {
  let size = startSize;

  while (size > minSize) {
    context.font = `${weight} ${size}px 'IBM Plex Mono', 'SFMono-Regular', 'Roboto Mono', Consolas, monospace`;
    const widest = Math.max(...lines.map((line) => context.measureText(line).width));
    if (widest <= maxWidth) return size;
    size -= 2;
  }

  return minSize;
}

function getTypeLockLayout(platform: PlatformId) {
  if (platform === "x") {
    return {
      width: 1500,
      height: 500,
      safeRect: { x: 170, y: 60, width: 1120, height: 340 },
      textX: 620,
      maxRight: 1270,
      headlineStartSize: 58,
      headlineStartSizeDense: 54,
      headlineMinSize: 34,
      minFirstY: 104,
      twoLineFirstY: 170,
      dividerGap: 20,
      sublineGap: 42,
      maxSublineBaseline: 370,
      creditY: 382,
      creditMaxLeft: 1120,
    };
  }

  return {
    width: 1584,
    height: 396,
    safeRect: { x: 192, y: 34, width: 1200, height: 328 },
    textX: 760,
    maxRight: 1352,
    headlineStartSize: 56,
    headlineStartSizeDense: 48,
    headlineMinSize: 36,
    minFirstY: 86,
    twoLineFirstY: 148,
    dividerGap: 18,
    sublineGap: 38,
    maxSublineBaseline: 326,
    creditY: 358,
    creditMaxLeft: 1138,
  };
}

function renderTypeLockBanner(prompt: string, platform: PlatformId) {
  const spec = getTypeLockSpec(prompt, platform);
  if (!spec) return "";
  const layout = getTypeLockLayout(platform);

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");

  if (!context) return "";

  context.fillStyle = "#20201c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawSubtleGrid(context, canvas.width, canvas.height);

  context.fillStyle = "rgba(0, 0, 0, 0.1)";
  context.fillRect(
    layout.safeRect.x,
    layout.safeRect.y,
    layout.safeRect.width,
    layout.safeRect.height,
  );

  context.textBaseline = "alphabetic";
  context.textAlign = "left";
  const textX = layout.textX;
  const maxRight = layout.maxRight;
  const maxTextWidth = maxRight - textX;
  const headlineFontSize = fitMonoFontSize(
    context,
    spec.headlineLines,
    700,
    spec.headlineLines.length > 2
      ? layout.headlineStartSizeDense
      : layout.headlineStartSize,
    layout.headlineMinSize,
    maxTextWidth,
  );
  context.font =
    `700 ${headlineFontSize}px 'IBM Plex Mono', 'SFMono-Regular', 'Roboto Mono', Consolas, monospace`;
  context.fillStyle = "#f4ecd9";
  context.shadowColor = "rgba(0, 0, 0, 0.24)";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 1;

  const lineHeight = Math.round(headlineFontSize * 1.12);
  const firstY =
    spec.headlineLines.length <= 2
      ? layout.twoLineFirstY
      : Math.max(
          layout.minFirstY,
          layout.maxSublineBaseline -
            (spec.subline ? layout.sublineGap : 0) -
            layout.dividerGap -
            spec.headlineLines.length * lineHeight,
        );
  const redPeriodLineIndex = spec.headlineLines.length - 1;

  spec.headlineLines.forEach((line, index) => {
    const y = firstY + index * lineHeight;
    const shouldRedrawPeriod = index === redPeriodLineIndex && line.endsWith(".");
    const creamLine = shouldRedrawPeriod ? line.slice(0, -1) : line;

    context.fillStyle = "#f4ecd9";
    drawMonoText(context, creamLine, textX, y);

    if (shouldRedrawPeriod) {
      context.fillStyle = "#b5222e";
      drawMonoText(context, ".", textX + context.measureText(creamLine).width + 3, y);
    }
  });

  context.shadowColor = "transparent";
  context.fillStyle = "#b5222e";
  const dividerY =
    firstY + spec.headlineLines.length * lineHeight + layout.dividerGap;
  context.fillRect(textX, dividerY, 92, 5);

  if (spec.subline) {
    const sublineFontSize = fitMonoFontSize(
      context,
      [spec.subline],
      500,
      platform === "x" ? 30 : 28,
      18,
      maxTextWidth,
    );
    context.font =
      `500 ${sublineFontSize}px 'IBM Plex Mono', 'SFMono-Regular', 'Roboto Mono', Consolas, monospace`;
    context.fillStyle = "rgba(244, 236, 217, 0.48)";
    drawMonoText(context, spec.subline, textX, dividerY + layout.sublineGap);
  }

  context.font =
    "500 12px 'IBM Plex Mono', 'SFMono-Regular', 'Roboto Mono', Consolas, monospace";
  context.fillStyle = "rgba(244, 236, 217, 0.24)";
  const credit = "made with canvakilla.com";
  const creditX = Math.min(
    layout.creditMaxLeft,
    maxRight - context.measureText(credit).width,
  );
  drawMonoText(context, credit, creditX, layout.creditY);

  return canvas.toDataURL("image/png");
}

function drawBannerProof(context: CanvasRenderingContext2D, platform: PlatformId) {
  context.save();

  if (platform === "linkedin") {
    context.fillStyle = "rgba(255, 212, 0, 0.19)";
    context.fillRect(0, 0, 1584, 34);
    context.fillRect(0, 362, 1584, 34);

    context.fillStyle = "rgba(10, 102, 194, 0.18)";
    context.fillRect(0, 18, 192, 360);
    context.fillRect(1392, 18, 192, 360);

    context.strokeStyle = "rgba(10, 102, 194, 0.9)";
    context.lineWidth = 4;
    context.setLineDash([18, 14]);
    context.strokeRect(192, 18, 1200, 360);

    context.beginPath();
    context.arc(198, 360, 150, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 77, 109, 0.3)";
    context.fill();
    context.strokeStyle = "rgba(255, 77, 109, 0.96)";
    context.lineWidth = 5;
    context.stroke();

    context.setLineDash([]);
    context.font = "700 26px Arial";
    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.fillText("CROP GUARD", 34, 27);
    context.fillText("CROP GUARD", 34, 385);
    context.fillText("MOBILE SAFE ZONE", 612, 58);
    context.fillText("PROFILE PHOTO", 54, 198);
    context.font = "700 21px Arial";
    context.fillText("SIDE CROP", 28, 188);
    context.fillText("SIDE CROP", 1430, 188);
    context.restore();
    return;
  }

  context.fillStyle = "rgba(255, 235, 59, 0.2)";
  context.fillRect(0, 0, 1500, 60);
  context.fillRect(0, 440, 1500, 60);

  context.fillStyle = "rgba(0, 194, 168, 0.16)";
  context.fillRect(0, 270, 510, 230);

  context.strokeStyle = "rgba(0, 194, 168, 0.85)";
  context.lineWidth = 4;
  context.setLineDash([18, 14]);
  context.strokeRect(0, 270, 510, 230);

  context.fillStyle = "rgba(58, 111, 247, 0.22)";
  context.fillRect(1300, 400, 200, 100);

  context.strokeStyle = "rgba(58, 111, 247, 0.95)";
  context.lineWidth = 4;
  context.setLineDash([16, 12]);
  context.strokeRect(1300, 400, 200, 100);

  context.beginPath();
  context.arc(240, 410, 185, 0, Math.PI * 2);
  context.fillStyle = "rgba(255, 77, 109, 0.28)";
  context.fill();
  context.strokeStyle = "rgba(255, 77, 109, 0.95)";
  context.lineWidth = 5;
  context.stroke();

  context.setLineDash([]);
  context.font = "700 28px Arial";
  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.fillText("PROFILE MASK", 74, 418);
  context.fillText("MOBILE ACTION", 1264, 454);
  context.fillText("CROP GUARD", 34, 42);
  context.fillText("CROP GUARD", 34, 482);
  context.restore();
}

function drawProfileProof(context: CanvasRenderingContext2D) {
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.34)";
  context.fillRect(0, 0, 1024, 1024);
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.arc(512, 512, 456, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = "rgba(29, 155, 240, 0.96)";
  context.lineWidth = 8;
  context.setLineDash([28, 20]);
  context.beginPath();
  context.arc(512, 512, 456, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  context.font = "700 34px Arial";
  context.fillText("CIRCULAR CROP", 368, 970);
  context.restore();
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
  const [editTarget, setEditTarget] = useState<EditTarget>("banner");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [profileImage, setProfileImage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [currentImage, setCurrentImage] = useState("");
  const [prompt, setPrompt] = useState(config.bannerPrompts[0]);
  const [model, setModel] = useState(MODELS[0].id);
  const [templateVisible, setTemplateVisible] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [profileHistory, setProfileHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [firstRunDone, setFirstRunDone] = useState(false);
  const [dismissedCropTips, setDismissedCropTips] = useState<CropTipId[]>([]);
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
  const promptReferenceLabels = getPromptReferenceLabels(prompt);
  const runReferences = references
    .filter((reference) => promptReferenceLabels.has(reference.label))
    .slice(0, MAX_REFERENCE_IMAGES_PER_RUN);
  const canGenerate = prompt.trim().length > 0 && !isGenerating;
  const canExport = Boolean(activeImage);
  const showFirstRunNudge = !firstRunDone && references.length === 0 && !activeImage;
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
    return MODELS.find((item) => item.id === model)?.label || "Image model";
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

        if (Array.isArray(savedState.references) && savedState.references.length) {
          setReferences(
            normalizeReferenceItems(savedState.references).slice(
              0,
              MAX_STORED_REFERENCE_IMAGES,
            ),
          );
        } else if (savedState.sourceImage) {
          setReferences([
            {
              id: "legacy-reference",
              image: savedState.sourceImage,
              name: savedState.sourceName || "reference image",
              label: "R1",
              createdAt: "Saved",
            },
          ]);
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
        setPrompt(normalizedPrompt);
        setModel(normalizeModelId(savedState.model || MODELS[0].id));
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
    templateVisible,
    workspaceKey,
    workspaceLoaded,
  ]);

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
    setPrompt((value) =>
      currentStarters.includes(value) ? nextStarters[0] : value,
    );
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

    const instruction = getReferenceInstruction(reference);
    const textarea = promptRef.current;
    const currentPrompt = prompt;

    if (currentPrompt.includes(instruction)) {
      setPrompt((value) => removeReferenceInstruction(value, reference));
      setStatus(`${reference.label} parked again`);
      captureClientEvent("reference_deselected_for_generation", {
        reference_label: reference.label,
        target: editTarget,
        platform,
      });
      return;
    }

    if (!textarea) {
      setPrompt((value) => `${value.trim()}\n\n${instruction}`.trim());
      captureClientEvent("reference_selected_for_generation", {
        reference_label: reference.label,
        target: editTarget,
        platform,
      });
      setStatus(`${reference.label} selected for the next banner run`);
      return;
    }

    const start = textarea.selectionStart ?? currentPrompt.length;
    const end = textarea.selectionEnd ?? currentPrompt.length;
    const prefix = currentPrompt.slice(0, start);
    const suffix = currentPrompt.slice(end);
    const spacerBefore = prefix && !prefix.endsWith("\n") ? "\n\n" : "";
    const spacerAfter = suffix && !suffix.startsWith("\n") ? "\n\n" : "";
    const nextPrompt = `${prefix}${spacerBefore}${instruction}${spacerAfter}${suffix}`;

    setPrompt(nextPrompt);
    window.requestAnimationFrame(() => {
      const cursor = prefix.length + spacerBefore.length + instruction.length;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
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
      setStatus("Wrong edit mode");
      return;
    }

    setIsGenerating(true);
    setError("");
    setStatus(`${selectedModelLabel} is composing · ${sourceSummary}`);

    try {
      const lockedImage =
        editTarget === "banner" ? renderTypeLockBanner(prompt, platform) : "";
      if (lockedImage) {
        const nextItem: HistoryItem = {
          id: crypto.randomUUID(),
          image: lockedImage,
          prompt: prompt.trim(),
          model: "canvakilla-type-lock",
          createdAt: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        setCurrentImage(lockedImage);
        setHistory((items) => [nextItem, ...items].slice(0, 8));
        captureClientEvent("image_generated", {
          model: "canvakilla-type-lock",
          target: editTarget,
          platform,
          has_current_image: !!currentImage,
          reference_count: 0,
          prompt_renderer_used: true,
        });
        markFirstRunDone();
        console.info("CanvaKilla rendered a typography-safe banner locally", {
          platform,
          target: editTarget,
          promptPreview: prompt.trim().replace(/\s+/g, " ").slice(0, 120),
        });
        setStatus("Typography-safe banner rendered from the prompt");
        return;
      }

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

      await Promise.all(
        runReferences.map(async (reference) => {
          await appendUploadImage(
            "referenceImages",
            reference.image,
            `${reference.label}-${reference.name}`,
            "reference",
          );
          formData.append("referenceLabels", reference.label);
        }),
      );

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
    setStatus(
      references.length
        ? `${editTarget === "profile" ? "Profile" : "Banner"} cleared; references kept`
        : "Ready",
    );
  }

  function moveBannerToReferences() {
    if (!currentImage) return;

    const movedImageBytes = getDataUrlBytes(currentImage);
    if (movedImageBytes > MAX_CLIENT_TOTAL_IMAGE_BYTES) {
      setError("That banner is too large to save as a reference.");
      return;
    }

    const createdAt = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setReferences((items) => {
      const withoutDuplicate = items.filter((item) => item.image !== currentImage);
      const movedReference: ReferenceItem = {
        id: crypto.randomUUID(),
        image: currentImage,
        name: "moved-banner.png",
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
    setCurrentImage("");
    setError("");
    setStatus("Banner moved to references and parked until clicked");
    captureClientEvent("current_image_moved_to_references", {
      target: "banner",
      platform,
    });
  }

  async function clearAllLocalData() {
    const confirmed = window.confirm(
      "Clear all local CanvaKilla data from this browser? This removes saved references, profile photos, generated images, prompts, and history.",
    );

    if (!confirmed) return;

    setReferences([]);
    setProfileImage("");
    setProfileName("");
    setCurrentImage("");
    setPrompt(config.bannerPrompts[0]);
    setModel(MODELS[0].id);
    setTemplateVisible(true);
    setEditTarget("banner");
    setPreviewMode("desktop");
    setHistory([]);
    setProfileHistory([]);
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
        <aside className="control-panel">
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
                const isSelected = promptReferenceLabels.has(reference.label);
                const isProfileSource =
                  editTarget === "profile" && profileImage === reference.image;
                return (
                  <button
                    className={`reference-card${
                      isSelected || isProfileSource ? " is-selected" : ""
                    }`}
                    key={reference.id}
                    type="button"
                    aria-pressed={editTarget === "banner" ? isSelected : undefined}
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
                      {(isSelected || isProfileSource) && (
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
                {MODELS.map((item) => (
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
                  ? `Current ${activeTargetName} is always iterated.`
                  : `No current ${activeTargetName} yet.`}{" "}
                {editTarget === "profile"
                  ? "Click a reference to load it as the profile edit source."
                  : "Click a reference to call it out in the prompt."}{" "}
                {sourceSummary}.
              </small>
            </label>

            <div className="prompt-chips" aria-label="Prompt starters">
              {activePromptStarters.map((starter, index) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => {
                    setPrompt(starter);
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
              Iterate {editTarget === "profile" ? "Profile" : "Banner"}
            </button>
            <button
              className="icon-action"
              type="button"
              onClick={() => setTemplateVisible((visible) => !visible)}
              title="Toggle template"
            >
              {templateVisible ? (
                <Eye size={18} aria-hidden="true" />
              ) : (
                <EyeOff size={18} aria-hidden="true" />
              )}
              Template
            </button>
            {editTarget === "banner" && (
              <button
                className="icon-action"
                type="button"
                onClick={moveBannerToReferences}
                disabled={!currentImage}
                title={`Move current banner out of the ${config.platformName} preview and into references`}
              >
                <ImagePlus size={18} aria-hidden="true" />
                Move to Refs
              </button>
            )}
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
        </aside>

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

              <aside className="x-right-rail" aria-label="X preview sidebar">
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
              </aside>
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
