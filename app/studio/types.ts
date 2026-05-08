import type { EditTarget } from "../../lib/platforms";

export type HistoryItem = {
  id: string;
  image: string;
  prompt: string;
  model: string;
  createdAt: string;
};

export type PreviewMode = "desktop" | "mobile";

export type ReferenceItem = {
  id: string;
  image: string;
  name: string;
  label: string;
  createdAt: string;
};

export type GenerateResponse = {
  imageBase64?: string;
  mimeType?: string;
  model?: string;
  error?: string;
};

export type EnhancePromptResponse = {
  enhancedPrompt?: string;
  enhancerModel?: string;
  model?: string;
  error?: string;
};

export type UploadImageKind = "banner" | "profile" | "reference";

export type PersistedWorkspace = {
  editTarget?: EditTarget;
  previewMode?: PreviewMode;
  references?: ReferenceItem[];
  selectedReferenceIds?: string[];
  sourceImage: string;
  sourceName: string;
  profileImage: string;
  profileName: string;
  currentImage: string;
  prompt: string;
  profileContext?: string;
  model: string;
  templateVisible: boolean;
  history: HistoryItem[];
  profileHistory?: HistoryItem[];
};
