"use client";

import {
  ArrowLeft,
  BarChart3,
  BadgeCheck,
  Bell,
  Bookmark,
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
  Pin,
  Plus,
  RefreshCcw,
  Repeat2,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Smartphone,
  Upload,
  UserRound,
  X as XIcon,
} from "lucide-react";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { captureClientEvent } from "../lib/posthog-client";

type HistoryItem = {
  id: string;
  image: string;
  prompt: string;
  model: string;
  createdAt: string;
};

type EditTarget = "banner" | "profile";
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
  note?: string;
  error?: string;
};

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
const CLIENT_SESSION_KEY = "canvakilla-session-id";
const MAX_REFERENCE_IMAGES_PER_RUN = 12;

const MODELS = [
  {
    id: "openai/gpt-5.4-image-2",
    label: "GPT Image 2",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
  },
  {
    id: "google/gemini-2.5-flash-image",
    label: "Nano Banana",
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
  },
];

const LEGACY_MODEL_IDS: Record<string, string> = {
  "gpt-image-2": "openai/gpt-5.4-image-2",
  "gemini-3.1-flash-image-preview": "google/gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image": "google/gemini-2.5-flash-image",
  "gemini-3-pro-image-preview": "google/gemini-3-pro-image-preview",
};

const BANNER_PROMPTS = [
  "Turn this into a polished X banner with a sharp center-right focal point, clean negative space near the avatar area, and nothing important in the lower-left AVATAR quiet zone or lower-right MOBILE ACTION quiet zone where X mobile overlays follow/message buttons.",
  "Make this image feel like a premium tech founder profile banner. Keep the subject recognizable, add cinematic light, and keep the lower-left AVATAR zone plus lower-right MOBILE ACTION zone empty of important details.",
  "Create a bold editorial X header from this image with crisp contrast, a clean right-side title area, and no faces, logos, or readable text in the AVATAR or MOBILE ACTION quiet zones.",
];

const PROFILE_PROMPTS = [
  "Turn this into a polished X profile picture with a centered face, clean circular crop, strong contrast, and a crisp small-size read.",
  "Create a premium founder-style avatar from this image. Keep the person recognizable, improve lighting, simplify the background, and make it work as a circle.",
  "Make this profile picture feel bold and editorial while preserving likeness. Keep the subject centered and avoid tiny text or important details near the corners.",
];

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

function normalizeModelId(modelId: string) {
  const nextModel = LEGACY_MODEL_IDS[modelId] || modelId;
  return MODELS.some((item) => item.id === nextModel) ? nextModel : MODELS[0].id;
}

function getClientSessionId() {
  if (typeof window === "undefined") return "server";

  const existingSession = window.localStorage.getItem(CLIENT_SESSION_KEY);
  if (existingSession) return existingSession;

  const nextSession = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_SESSION_KEY, nextSession);
  return nextSession;
}

async function readWorkspaceState() {
  if (typeof indexedDB === "undefined") return null;

  const db = await openWorkspaceDb();

  try {
    return await new Promise<PersistedWorkspace | null>((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, "readonly");
      const request = transaction.objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY);

      request.onsuccess = () => {
        resolve((request.result as PersistedWorkspace | undefined) || null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writeWorkspaceState(state: PersistedWorkspace) {
  if (typeof indexedDB === "undefined") return;

  const db = await openWorkspaceDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(WORKSPACE_STORE, "readwrite");

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore(WORKSPACE_STORE).put(state, WORKSPACE_KEY);
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

async function dataUrlToFile(dataUrl: string, name: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/png" });
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

function drawTemplate(context: CanvasRenderingContext2D) {
  context.save();
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

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget>("banner");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [profileImage, setProfileImage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [currentImage, setCurrentImage] = useState("");
  const [prompt, setPrompt] = useState(BANNER_PROMPTS[0]);
  const [model, setModel] = useState(MODELS[0].id);
  const [templateVisible, setTemplateVisible] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [profileHistory, setProfileHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");

  const activeImage = editTarget === "profile" ? profileImage : currentImage;
  const activeHistory = editTarget === "profile" ? profileHistory : history;
  const activePromptStarters =
    editTarget === "profile" ? PROFILE_PROMPTS : BANNER_PROMPTS;
  const activeTargetName = editTarget === "profile" ? "profile" : "banner";
  const activeSize = editTarget === "profile" ? "1024x1024" : "1500x500";
  const previewModeLabel = previewMode === "mobile" ? "Mobile" : "Desktop";
  const runReferences = references.slice(0, MAX_REFERENCE_IMAGES_PER_RUN);
  const canGenerate = prompt.trim().length > 0 && !isGenerating;
  const canExport = Boolean(activeImage);

  const selectedModelLabel = useMemo(() => {
    return MODELS.find((item) => item.id === model)?.label || "Image model";
  }, [model]);

  useEffect(() => {
    let isMounted = true;

    readWorkspaceState()
      .then((savedState) => {
        if (!isMounted || !savedState) return;

        if (Array.isArray(savedState.references) && savedState.references.length) {
          setReferences(savedState.references);
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
        setPrompt(savedState.prompt || BANNER_PROMPTS[0]);
        setModel(normalizeModelId(savedState.model || MODELS[0].id));
        setEditTarget(savedState.editTarget === "profile" ? "profile" : "banner");
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
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;

    const saveTimer = window.setTimeout(() => {
      writeWorkspaceState({
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
    workspaceLoaded,
  ]);

  async function handleFiles(files: FileList | null) {
    const imageFiles = Array.from(files || []).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (!imageFiles.length) return;
    if (imageFiles.length !== files?.length) {
      setError("Only PNG, JPEG, and WebP images were added.");
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

    setReferences((items) => [...nextReferences.reverse(), ...items]);
    captureClientEvent("reference_images_added", {
      count: imageFiles.length,
    });
    setError("");
    setStatus(
      imageFiles.length === 1
        ? "Reference added"
        : `${imageFiles.length} references added`,
    );
  }

  async function handleProfileFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a PNG, JPEG, or WebP profile image.");
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setProfileImage(dataUrl);
    setProfileName(file.name);
    setProfileHistory([]);
    captureClientEvent("source_image_uploaded", { target: "profile" });
    setError("");
    setStatus("Profile photo loaded");
  }

  function switchEditTarget(nextTarget: EditTarget) {
    const currentStarters =
      editTarget === "profile" ? PROFILE_PROMPTS : BANNER_PROMPTS;
    const nextStarters = nextTarget === "profile" ? PROFILE_PROMPTS : BANNER_PROMPTS;

    setEditTarget(nextTarget);
    setPrompt((value) =>
      currentStarters.includes(value) ? nextStarters[0] : value,
    );
    captureClientEvent("edit_target_switched", { target: nextTarget });
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

  function insertReferenceInstruction(reference: ReferenceItem) {
    const instruction = `Use Reference ${reference.label} (${reference.name}) as a visual reference.`;
    const textarea = promptRef.current;
    const currentPrompt = prompt;

    if (!textarea) {
      setPrompt((value) => `${value.trim()}\n\n${instruction}`.trim());
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
  }

  async function generateImage() {
    if (!canGenerate) return;

    setIsGenerating(true);
    setError("");
    setStatus(`${selectedModelLabel} is composing the ${activeTargetName}`);

    try {
      const formData = new FormData();
      formData.append("prompt", prompt.trim());
      formData.append("model", model);
      formData.append("target", editTarget);
      formData.append("sessionId", getClientSessionId());

      if (editTarget === "banner" && currentImage) {
        formData.append(
          "currentImage",
          await dataUrlToFile(currentImage, "x-banner-current.png"),
        );
      }

      if (editTarget === "profile" && profileImage) {
        formData.append(
          "currentImage",
          await dataUrlToFile(profileImage, "x-profile-current.png"),
        );
      }

      await Promise.all(
        runReferences.map(async (reference) => {
          formData.append(
            "referenceImages",
            await dataUrlToFile(reference.image, `${reference.label}-${reference.name}`),
          );
          formData.append("referenceLabels", reference.label);
        }),
      );

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "X-CanvaKilla-Session": getClientSessionId(),
        },
        body: formData,
      });
      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || !payload.imageBase64) {
        throw new Error(payload.error || "No image returned.");
      }

      const nextImage = `data:${payload.mimeType || "image/png"};base64,${
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
        has_current_image: editTarget === "banner" ? !!currentImage : !!profileImage,
        reference_count: runReferences.length,
      });

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
        error_message: errorMessage,
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
      canvas.width = editTarget === "profile" ? 1024 : 1500;
      canvas.height = editTarget === "profile" ? 1024 : 500;
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
        drawTemplate(context);
      }

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download =
        editTarget === "profile"
          ? withTemplate
            ? "x-profile-picture-circle-proof-1024x1024.png"
            : "x-profile-picture-1024x1024.png"
          : withTemplate
            ? "x-banner-template-proof-1500x500.png"
            : "x-banner-1500x500.png";
      link.click();
      captureClientEvent("image_downloaded", {
        target: editTarget,
        with_template: withTemplate,
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
      link.download = "x-profile-picture-1024x1024.png";
      link.click();
      captureClientEvent("image_downloaded", {
        target: "profile",
        with_template: false,
        source: editTarget === "profile" ? "active_export" : "persistent_button",
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

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="X banner maker">
        <aside className="control-panel">
          <div className="brand-bar">
            <div>
              <p className="eyebrow">Canva sucks, Introducing:</p>
              <h1>CanvaKilla.com</h1>
            </div>
            <span className="size-pill">{activeSize}</span>
          </div>

          <div className="quick-start-card" aria-label="How to use CanvaKilla">
            <span className="quick-start-kicker">Make an X-safe visual</span>
            <strong>Upload a reference, write the change, hit Iterate.</strong>
            <p>
              The prompt already protects the avatar crop, desktop crop, and
              mobile follow-button zones.
            </p>
          </div>

          <div className="target-switch" role="tablist" aria-label="Edit target">
            <button
              className={editTarget === "banner" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={editTarget === "banner"}
              onClick={() => switchEditTarget("banner")}
            >
              <Layers size={16} aria-hidden="true" />
              Banner
            </button>
            <button
              className={editTarget === "profile" ? "is-active" : ""}
              type="button"
              role="tab"
              aria-selected={editTarget === "profile"}
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
              <small>Newest stays on top</small>
            </span>
          </label>

          {references.length > 0 && (
            <div className="reference-stack" aria-label="Uploaded references">
              {references.map((reference) => (
                <button
                  className="reference-card"
                  key={reference.id}
                  type="button"
                  onClick={() => insertReferenceInstruction(reference)}
                  title={`Insert ${reference.label} into the prompt`}
                >
                  <img src={reference.image} alt="" />
                  <span>
                    <strong>{reference.label}</strong>
                    <small>{reference.name}</small>
                  </span>
                </button>
              ))}
              {references.length > MAX_REFERENCE_IMAGES_PER_RUN && (
                <p className="reference-limit">
                  Latest {MAX_REFERENCE_IMAGES_PER_RUN} references are sent per
                  run.
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
                  captureClientEvent("model_changed", { model: event.target.value });
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
                rows={8}
              />
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
              <h2>{previewModeLabel} X Preview</h2>
              <span>
                {activeHistory.length} {activeTargetName} iterations
              </span>
            </div>
            <div
              className="preview-mode-switch"
              role="tablist"
              aria-label="Preview layout"
            >
              <button
                className={previewMode === "desktop" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={previewMode === "desktop"}
                onClick={() => setPreviewMode("desktop")}
              >
                <Monitor size={16} aria-hidden="true" />
                Desktop
              </button>
              <button
                className={previewMode === "mobile" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={previewMode === "mobile"}
                onClick={() => setPreviewMode("mobile")}
              >
                <Smartphone size={16} aria-hidden="true" />
                Mobile
              </button>
            </div>
          </div>

          {previewMode === "desktop" ? (
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
                <button className="x-post-button" type="button">
                  Post
                </button>
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
                  <button type="button">
                    <ArrowLeft size={20} aria-hidden="true" />
                  </button>
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
                    <div className="template-layer" aria-hidden="true">
                      <div className="crop-guide top">
                        <span>crop guard</span>
                      </div>
                      <div className="crop-guide bottom">
                        <span>crop guard</span>
                      </div>
                      <div className="quiet-zone">
                        <span>quiet zone</span>
                      </div>
                      <div className="mobile-action-zone">
                        <span>mobile action</span>
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
                    <button type="button">
                      <CircleEllipsis size={20} aria-hidden="true" />
                    </button>
                    <button type="button">
                      <MessageCircle size={20} aria-hidden="true" />
                    </button>
                    <button className="x-follow-button" type="button">
                      Follow
                    </button>
                  </div>
                  <h3>
                    Joe Wilson <span className="verified-badge">✓</span>
                  </h3>
                  <p className="x-handle">@joewilsonai</p>
                  <p className="x-bio">
                    Building profile-safe AI visuals with reusable references.
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

                <div className="x-tabs" role="tablist" aria-label="Profile tabs">
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
                    <button type="button">Follow</button>
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
                    <button type="button">Follow</button>
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
                    <button type="button">Follow</button>
                  </div>
                  <button className="x-link-button" type="button">
                    Show more
                  </button>
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
                  <button className="x-link-button" type="button">
                    Show more
                  </button>
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
                  <button type="button">
                    <ArrowLeft size={24} aria-hidden="true" />
                  </button>
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
                    <div className="template-layer mobile-template" aria-hidden="true">
                      <div className="quiet-zone">
                        <span>avatar</span>
                      </div>
                      <div className="mobile-action-zone">
                        <span>mobile action</span>
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
                    <button type="button">
                      <MessageCircle size={26} aria-hidden="true" />
                    </button>
                    <button className="x-follow-button" type="button">
                      Follow
                    </button>
                  </div>
                  <h3>
                    Joe Wilson <span className="verified-badge">✓</span>
                  </h3>
                  <p className="x-handle">@joewilsonai</p>
                  <p className="x-mobile-bio">
                    Building profile-safe AI visuals. Testing banner, avatar,
                    and mobile button collisions before publishing.
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
                  <div className="x-tabs x-mobile-tabs" role="tablist">
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
