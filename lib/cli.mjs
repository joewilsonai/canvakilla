import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import sharp from "sharp";

export const DEFAULT_BASE_URL = "https://canvakilla.com";
export const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
export const MAX_CLI_UPLOAD_BYTES = 3.4 * 1024 * 1024;
export const MIN_IMAGE_BUDGET_BYTES = 220 * 1024;

const QUALITY_STEPS = [88, 78, 68, 58, 48, 38];
const VALID_COMMANDS = new Set(["enhance", "generate", "help", "version"]);
const VALID_PLATFORMS = new Set(["x", "linkedin"]);
const VALID_TARGETS = new Set(["banner", "profile"]);

export function parseArgs(argv) {
  const [command = "help", ...rest] = argv;

  if (!VALID_COMMANDS.has(command)) {
    throw new Error(`Unknown command "${command}". Run canvakilla help.`);
  }

  const options = {
    references: [],
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--enhance") {
      options.enhance = true;
      continue;
    }

    if (arg === "--print-prompt") {
      options.printPrompt = true;
      continue;
    }

    if (arg === "--template-guide") {
      options.templateGuide = true;
      continue;
    }

    const equalsMatch = arg.match(/^(--[a-z0-9-]+)=(.*)$/i);
    const name = equalsMatch?.[1] || arg;
    const inlineValue = equalsMatch?.[2];
    const valueOptions = new Set([
      "--base-url",
      "--current",
      "--model",
      "--output",
      "--platform",
      "--profile-context",
      "--profile-context-file",
      "--prompt",
      "--prompt-file",
      "--reference",
      "--target",
    ]);

    if (!valueOptions.has(name)) {
      throw new Error(`Unknown option "${arg}". Run canvakilla ${command} --help.`);
    }

    const value =
      inlineValue !== undefined
        ? inlineValue
        : rest[index + 1] && !rest[index + 1].startsWith("--")
          ? rest[++index]
          : "";

    if (!value) {
      throw new Error(`Missing value for ${name}.`);
    }

    if (name === "--reference") {
      options.references.push(value);
    } else {
      options[toCamelCase(name.slice(2))] = value;
    }
  }

  return { command, options };
}

export function normalizeBaseUrl(value) {
  const rawUrl = value || process.env.CANVAKILLA_BASE_URL || DEFAULT_BASE_URL;

  try {
    const url = new URL(rawUrl);
    url.pathname = url.pathname.replace(/\/+$/g, "") || "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/g, "");
  } catch {
    throw new Error(`Invalid base URL: ${rawUrl}`);
  }
}

export function normalizePlatform(value = "x") {
  if (!VALID_PLATFORMS.has(value)) {
    throw new Error("Platform must be x or linkedin.");
  }

  return value;
}

export function normalizeTarget(value = "banner") {
  if (!VALID_TARGETS.has(value)) {
    throw new Error("Target must be banner or profile.");
  }

  return value;
}

export function getDefaultOutputPath({ platform, target }) {
  if (target === "profile") return `${platform}-profile-1024x1024.jpg`;
  if (platform === "linkedin") return "linkedin-banner-1584x396.jpg";
  return "x-banner-1500x500.jpg";
}

export function getHelp(command = "help") {
  if (command === "enhance") {
    return [
      "Usage:",
      "  canvakilla enhance --platform linkedin --prompt \"make it premium\"",
      "",
      "Options:",
      "  --base-url <url>               API origin, defaults to https://canvakilla.com",
      "  --platform <x|linkedin>        Platform crop rules, defaults to x",
      "  --target <banner|profile>      Prompt target, defaults to banner",
      "  --model <id>                   Image model the prompt should be optimized for",
      "  --prompt <text>                Prompt text",
      "  --prompt-file <path>           Read prompt from file",
      "  --profile-context <text>       Pasted profile URLs, bio, audience, posts, offer",
      "  --profile-context-file <path>  Read profile context from file",
      "  --reference <path>             Adds reference labels R1, R2... for prompt context",
      "  --current <path>               Tells enhancer a current image will be iterated",
      "  --output <path>                Write enhanced prompt to file",
      "  --json                         Print JSON",
    ].join("\n");
  }

  if (command === "generate") {
    return [
      "Usage:",
      "  canvakilla generate --platform x --prompt-file prompt.txt --output banner.jpg",
      "",
      "Options:",
      "  --base-url <url>               API origin, defaults to https://canvakilla.com",
      "  --platform <x|linkedin>        Platform crop rules, defaults to x",
      "  --target <banner|profile>      Export target, defaults to banner",
      "  --model <id>                   Image model, defaults to Nano Banana 2",
      "  --prompt <text>                Prompt text",
      "  --prompt-file <path>           Read prompt from file",
      "  --profile-context <text>       Used only when --enhance is set",
      "  --profile-context-file <path>  Used only when --enhance is set",
      "  --current <path>               Current banner/profile source to iterate",
      "  --reference <path>             Repeatable reference image",
      "  --enhance                      Enhance prompt before generation",
      "  --template-guide               Opt into attaching the internal crop guide image",
      "  --print-prompt                 Print final prompt to stderr",
      "  --output <path>                Output image path",
      "  --json                         Print JSON",
    ].join("\n");
  }

  return [
    "CanvaKilla CLI",
    "",
    "Commands:",
    "  canvakilla enhance   Rewrite a prompt for X/LinkedIn crop-safe generation",
    "  canvakilla generate  Generate an X/LinkedIn banner or profile image",
    "",
    "Examples:",
    "  canvakilla enhance --platform linkedin --prompt \"founder banner, premium\"",
    "  canvakilla generate --platform x --prompt-file prompt.txt --reference logo.png --output x-banner.jpg",
    "  canvakilla generate --platform linkedin --enhance --profile-context-file profile.txt --prompt \"make banner ideas\"",
    "",
    "Run canvakilla <command> --help for command-specific options.",
  ].join("\n");
}

export async function runCli(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const { command, options } = parseArgs(argv);

  if (command === "help" || options.help) {
    stdout.write(`${getHelp(command === "help" ? "help" : command)}\n`);
    return 0;
  }

  if (command === "version") {
    stdout.write("canvakilla 0.1.0\n");
    return 0;
  }

  if (command === "enhance") {
    await runEnhanceCommand(options, { stdout });
    return 0;
  }

  if (command === "generate") {
    await runGenerateCommand(options, { stdout, stderr });
    return 0;
  }

  throw new Error(`Unknown command "${command}".`);
}

export async function runEnhanceCommand(options, { stdout = process.stdout } = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const platform = normalizePlatform(options.platform);
  const target = normalizeTarget(options.target);
  const model = options.model || DEFAULT_IMAGE_MODEL;
  const prompt = await readTextOption(options.prompt, options.promptFile, "prompt");
  const profileContext = await readTextOption(
    options.profileContext,
    options.profileContextFile,
    "profile context",
    { required: false },
  );
  const referenceLabels = getReferenceLabels(options.references);
  const payload = await postJson(baseUrl, "/api/enhance-prompt", {
    prompt,
    model,
    target,
    platform,
    hasCurrentImage: Boolean(options.current),
    profileContext,
    referenceLabels,
  });

  if (!payload.enhancedPrompt) {
    throw new Error("Prompt enhancement did not return text.");
  }

  if (options.output) {
    await writeTextFile(options.output, payload.enhancedPrompt);
  }

  if (options.json) {
    stdout.write(
      `${JSON.stringify(
        {
          enhancedPrompt: payload.enhancedPrompt,
          enhancerModel: payload.enhancerModel,
          model: payload.model,
          output: options.output || null,
        },
        null,
        2,
      )}\n`,
    );
    return payload;
  }

  stdout.write(`${payload.enhancedPrompt}\n`);
  if (options.output) stdout.write(`\nWrote ${options.output}\n`);
  return payload;
}

export async function runGenerateCommand(
  options,
  { stdout = process.stdout, stderr = process.stderr } = {},
) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const platform = normalizePlatform(options.platform);
  const target = normalizeTarget(options.target);
  const model = options.model || DEFAULT_IMAGE_MODEL;
  let prompt = await readTextOption(options.prompt, options.promptFile, "prompt");

  if (options.enhance) {
    const profileContext = await readTextOption(
      options.profileContext,
      options.profileContextFile,
      "profile context",
      { required: false },
    );
    const enhanced = await postJson(baseUrl, "/api/enhance-prompt", {
      prompt,
      model,
      target,
      platform,
      hasCurrentImage: Boolean(options.current),
      profileContext,
      referenceLabels: getReferenceLabels(options.references),
    });
    if (!enhanced.enhancedPrompt) {
      throw new Error("Prompt enhancement did not return text.");
    }
    prompt = enhanced.enhancedPrompt;
  }

  if (options.printPrompt && !options.json) {
    stderr.write(`Final prompt:\n${prompt}\n\n`);
  }

  const output = options.output || getDefaultOutputPath({ platform, target });
  const result = await generateImage(baseUrl, {
    current: options.current,
    model,
    output,
    platform,
    prompt,
    references: options.references,
    templateGuide: Boolean(options.templateGuide),
    target,
  });

  if (options.json) {
    stdout.write(
      `${JSON.stringify(
        {
          output,
          model: result.model,
          provider: result.provider,
          mimeType: result.mimeType,
          finalPrompt: options.printPrompt ? prompt : undefined,
        },
        null,
        2,
      )}\n`,
    );
    return result;
  }

  stdout.write(`Wrote ${output}\n`);
  return result;
}

async function generateImage(baseUrl, options) {
  const images = [options.current, ...options.references].filter(Boolean);
  const byteBudget = Math.max(
    MIN_IMAGE_BUDGET_BYTES,
    Math.floor(MAX_CLI_UPLOAD_BYTES / Math.max(1, images.length) - 8192),
  );
  const formData = new FormData();
  formData.append("prompt", options.prompt);
  formData.append("model", options.model);
  formData.append("target", options.target);
  formData.append("platform", options.platform);
  formData.append("templateGuideImage", options.templateGuide ? "true" : "false");

  if (options.current) {
    const upload = await prepareImageUpload(options.current, byteBudget);
    formData.append("currentImage", upload.blob, upload.name);
  }

  for (const [index, referencePath] of options.references.entries()) {
    const upload = await prepareImageUpload(referencePath, byteBudget);
    formData.append("referenceImages", upload.blob, upload.name);
    formData.append("referenceLabels", `R${index + 1}`);
  }

  const payload = await postForm(baseUrl, "/api/generate", formData);
  if (!payload.imageBase64) {
    throw new Error("Image generation did not return an image.");
  }

  const outputBuffer = Buffer.from(payload.imageBase64, "base64");
  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, outputBuffer);

  return {
    ...payload,
    imageBase64: undefined,
  };
}

async function prepareImageUpload(filePath, byteBudget) {
  const input = await readFile(filePath);
  let lastOutput;

  for (const quality of QUALITY_STEPS) {
    const output = await sharp(input, { limitInputPixels: 36_000_000 })
      .rotate()
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();

    lastOutput = output;
    if (output.length <= byteBudget) {
      return {
        blob: new Blob([output], { type: "image/webp" }),
        name: `${stripExtension(basename(filePath)) || "image"}.webp`,
      };
    }
  }

  throw new Error(
    `${filePath} is too large after compression. Use fewer or smaller images.`,
  );
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(apiUrl(baseUrl, path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...originHeaders(baseUrl),
    },
    body: JSON.stringify(body),
  });
  return readApiPayload(response);
}

async function postForm(baseUrl, path, formData) {
  const response = await fetch(apiUrl(baseUrl, path), {
    method: "POST",
    headers: originHeaders(baseUrl),
    body: formData,
  });
  return readApiPayload(response);
}

async function readApiPayload(response) {
  const text = await response.text();
  let payload = {};

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text.replace(/\s+/g, " ").trim().slice(0, 300) };
    }
  }

  if (!response.ok) {
    const message = payload.error || `CanvaKilla API returned ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

async function readTextOption(inlineText, filePath, label, { required = true } = {}) {
  if (inlineText && filePath) {
    throw new Error(`Use either --${labelToOption(label)} or --${labelToOption(label)}-file, not both.`);
  }

  if (filePath) {
    return (await readFile(filePath, "utf8")).trim();
  }

  if (inlineText) return inlineText.trim();
  if (!required) return "";

  throw new Error(`Missing ${label}. Use --${labelToOption(label)} or --${labelToOption(label)}-file.`);
}

async function writeTextFile(filePath, text) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${text.trim()}\n`, "utf8");
}

function apiUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

function originHeaders(baseUrl) {
  const origin = new URL(baseUrl).origin;
  return {
    Origin: origin,
    Referer: `${origin}/`,
  };
}

function getReferenceLabels(references = []) {
  return references.map((_, index) => `R${index + 1}`);
}

function labelToOption(label) {
  return label.replace(/\s+/g, "-");
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function stripExtension(fileName) {
  const extension = extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}
