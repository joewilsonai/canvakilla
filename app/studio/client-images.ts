import type { UploadImageKind } from "./types";

const PROFILE_UPLOAD_SIZE = 1024;
const REFERENCE_UPLOAD_MAX_EDGE = 1400;

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function getDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

export async function dataUrlToFile(
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

export function drawCoverImage(
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
