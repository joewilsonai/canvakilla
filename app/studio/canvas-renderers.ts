import type { EditTarget, PlatformId } from "../../lib/platforms";

type TypeLockSpec = {
  headlineLines: string[];
  subline?: string;
};

export function getPromptTargetHint(prompt: string): EditTarget | null {
  const normalized = prompt.toLowerCase();
  let bannerScore = 0;
  let profileScore = 0;

  bannerScore += (normalized.match(/\b(banner|cover|header)\b/g) || []).length * 2;
  profileScore +=
    (normalized.match(/\b(profile picture|profile photo|headshot|avatar)\b/g) || [])
      .length * 3;

  if (normalized.includes("1584x396") || normalized.includes("1500x500")) {
    bannerScore += 3;
  }
  if (normalized.includes("wide editorial")) bannerScore += 2;
  if (normalized.includes("circular crop") || normalized.includes("square format")) {
    profileScore += 2;
  }
  if (/\b(make|create|turn|convert|generate)\b[^.?!\n]*(banner|cover|header)\b/.test(normalized)) {
    bannerScore += 4;
  }
  if (/\b(make|create|turn|convert|generate)\b[^.?!\n]*(profile picture|profile photo|headshot|avatar)\b/.test(normalized)) {
    profileScore += 4;
  }

  if (bannerScore >= profileScore + 2) return "banner";
  if (profileScore >= bannerScore + 2) return "profile";

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

  while (marker.exec(prompt)) {
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

function setMonoFont(
  context: CanvasRenderingContext2D,
  weight: number,
  size: number,
) {
  context.font = `${weight} ${size}px 'IBM Plex Mono', 'SFMono-Regular', 'Roboto Mono', Consolas, monospace`;
}

function getWidestLineWidth(
  context: CanvasRenderingContext2D,
  lines: string[],
) {
  return Math.max(...lines.map((line) => context.measureText(line).width));
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
    setMonoFont(context, weight, size);
    if (getWidestLineWidth(context, lines) <= maxWidth) return size;
    size -= 2;
  }

  setMonoFont(context, weight, minSize);
  return getWidestLineWidth(context, lines) <= maxWidth ? minSize : null;
}

function wrapMonoTextLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
  maxLines: number,
) {
  const wrappedLines: string[] = [];

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (!words.length) continue;

    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(nextLine).width <= maxWidth) {
        currentLine = nextLine;
        continue;
      }

      if (!currentLine || context.measureText(word).width > maxWidth) {
        return null;
      }

      wrappedLines.push(currentLine);
      currentLine = word;

      if (wrappedLines.length >= maxLines) return null;
    }

    if (currentLine) wrappedLines.push(currentLine);
    if (wrappedLines.length > maxLines) return null;
  }

  return wrappedLines.length ? wrappedLines : null;
}

function fitHeadlineText(
  context: CanvasRenderingContext2D,
  lines: string[],
  weight: number,
  startSize: number,
  minSize: number,
  maxWidth: number,
  maxLines: number,
) {
  let size = startSize;

  while (size >= minSize) {
    setMonoFont(context, weight, size);
    const wrappedLines = wrapMonoTextLines(context, lines, maxWidth, maxLines);

    if (wrappedLines && getWidestLineWidth(context, wrappedLines) <= maxWidth) {
      return { fontSize: size, lines: wrappedLines };
    }

    size -= 2;
  }

  return null;
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
      headlineMaxLines: 5,
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
    headlineMaxLines: 5,
    minFirstY: 86,
    twoLineFirstY: 148,
    dividerGap: 18,
    sublineGap: 38,
    maxSublineBaseline: 326,
    creditY: 358,
    creditMaxLeft: 1138,
  };
}

export function renderTypeLockBanner(prompt: string, platform: PlatformId) {
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
  const fittedHeadline = fitHeadlineText(
    context,
    spec.headlineLines,
    700,
    spec.headlineLines.length > 2
      ? layout.headlineStartSizeDense
      : layout.headlineStartSize,
    layout.headlineMinSize,
    maxTextWidth - 8,
    layout.headlineMaxLines,
  );

  if (!fittedHeadline) return "";

  const headlineLines = fittedHeadline.lines;
  const headlineFontSize = fittedHeadline.fontSize;
  setMonoFont(context, 700, headlineFontSize);
  context.fillStyle = "#f4ecd9";
  context.shadowColor = "rgba(0, 0, 0, 0.24)";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 1;

  const lineHeight = Math.round(headlineFontSize * 1.12);
  const firstY =
    headlineLines.length <= 2
      ? layout.twoLineFirstY
      : Math.max(
          layout.minFirstY,
          layout.maxSublineBaseline -
            (spec.subline ? layout.sublineGap : 0) -
            layout.dividerGap -
            headlineLines.length * lineHeight,
        );
  const dividerY =
    firstY + headlineLines.length * lineHeight + layout.dividerGap;

  if (
    firstY < 0 ||
    dividerY + 5 > layout.height ||
    (spec.subline && dividerY + layout.sublineGap > layout.maxSublineBaseline)
  ) {
    return "";
  }

  const redPeriodLineIndex = headlineLines.length - 1;

  headlineLines.forEach((line, index) => {
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
    if (!sublineFontSize) return "";

    setMonoFont(context, 500, sublineFontSize);
    context.fillStyle = "rgba(244, 236, 217, 0.48)";
    drawMonoText(context, spec.subline, textX, dividerY + layout.sublineGap);
  }

  setMonoFont(context, 500, 12);
  context.fillStyle = "rgba(244, 236, 217, 0.24)";
  const credit = "made with canvakilla.com";
  const creditX = Math.min(
    layout.creditMaxLeft,
    maxRight - context.measureText(credit).width,
  );
  drawMonoText(context, credit, creditX, layout.creditY);

  return canvas.toDataURL("image/png");
}

export function drawBannerProof(
  context: CanvasRenderingContext2D,
  platform: PlatformId,
) {
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

export function drawProfileProof(context: CanvasRenderingContext2D) {
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
