import { describe, it, expect } from "vitest";
import {
  normalizeModelId,
  getNextReferenceNumber,
  getDataUrlBytes,
  MODELS,
  LEGACY_MODEL_IDS,
  type ReferenceItem,
} from "../../lib/client-utils";

// ---------------------------------------------------------------------------
// MODELS constant
// ---------------------------------------------------------------------------

describe("MODELS", () => {
  it("contains exactly four entries", () => {
    expect(MODELS.length).toBe(4);
  });

  it("has unique model IDs", () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the GPT Image 2 model", () => {
    expect(MODELS.some((m) => m.id === "openai/gpt-5.4-image-2")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LEGACY_MODEL_IDS constant
// ---------------------------------------------------------------------------

describe("LEGACY_MODEL_IDS", () => {
  it("maps every legacy key to a model that exists in MODELS", () => {
    const knownIds = new Set(MODELS.map((m) => m.id));
    for (const canonical of Object.values(LEGACY_MODEL_IDS)) {
      expect(knownIds.has(canonical)).toBe(true);
    }
  });

  it("maps 'gpt-image-2' to the canonical GPT Image 2 ID", () => {
    expect(LEGACY_MODEL_IDS["gpt-image-2"]).toBe("openai/gpt-5.4-image-2");
  });
});

// ---------------------------------------------------------------------------
// normalizeModelId (client version)
// ---------------------------------------------------------------------------

describe("normalizeModelId (client-utils)", () => {
  it("returns the ID unchanged when it is already a canonical model ID", () => {
    expect(normalizeModelId("openai/gpt-5.4-image-2")).toBe(
      "openai/gpt-5.4-image-2",
    );
  });

  it("maps a legacy short ID to the canonical full ID", () => {
    expect(normalizeModelId("gpt-image-2")).toBe("openai/gpt-5.4-image-2");
    expect(normalizeModelId("gemini-2.5-flash-image")).toBe(
      "google/gemini-2.5-flash-image",
    );
  });

  it("falls back to the first MODELS entry for a completely unknown ID", () => {
    expect(normalizeModelId("unknown-model-xyz")).toBe(MODELS[0].id);
  });

  it("falls back to the first MODELS entry for an empty string", () => {
    expect(normalizeModelId("")).toBe(MODELS[0].id);
  });
});

// ---------------------------------------------------------------------------
// getNextReferenceNumber
// ---------------------------------------------------------------------------

describe("getNextReferenceNumber", () => {
  function ref(label: string): ReferenceItem {
    return { id: "1", image: "", name: "img", label, createdAt: "" };
  }

  it("returns 0 for an empty array", () => {
    expect(getNextReferenceNumber([])).toBe(0);
  });

  it("returns the single numeric suffix for a single reference", () => {
    expect(getNextReferenceNumber([ref("R3")])).toBe(3);
  });

  it("returns the maximum numeric suffix across all references", () => {
    expect(
      getNextReferenceNumber([ref("R1"), ref("R5"), ref("R3")]),
    ).toBe(5);
  });

  it("ignores references with non-numeric labels", () => {
    expect(
      getNextReferenceNumber([ref("R1"), ref("custom"), ref("R2")]),
    ).toBe(2);
  });

  it("ignores the R prefix and treats the rest as the number", () => {
    expect(getNextReferenceNumber([ref("R10")])).toBe(10);
  });

  it("returns 0 when all labels are non-numeric", () => {
    expect(
      getNextReferenceNumber([ref("custom"), ref("something")]),
    ).toBe(0);
  });

  it("handles a label that is exactly 'R' with no number gracefully", () => {
    expect(getNextReferenceNumber([ref("R"), ref("R2")])).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getDataUrlBytes
// ---------------------------------------------------------------------------

describe("getDataUrlBytes", () => {
  it("returns 0 for a data URL with no base64 content", () => {
    expect(getDataUrlBytes("data:image/png;base64,")).toBe(0);
  });

  it("returns 0 for a string with no comma separator", () => {
    expect(getDataUrlBytes("not-a-data-url")).toBe(0);
  });

  it("returns the correct byte estimate for a known base64 string", () => {
    // "AAAA" in base64 = 3 bytes exactly
    expect(getDataUrlBytes("data:image/png;base64,AAAA")).toBe(3);
  });

  it("returns ceil(n*3/4) for a padded base64 string", () => {
    // "AA==" = 1 byte → ceil(4*3/4) = 3 (padded characters still count toward length)
    const raw = "AA==";
    const expected = Math.ceil((raw.length * 3) / 4);
    expect(getDataUrlBytes(`data:image/png;base64,${raw}`)).toBe(expected);
  });

  it("is consistent across different mime types in the prefix", () => {
    const base64 = "AAABBB";
    const pngBytes = getDataUrlBytes(`data:image/png;base64,${base64}`);
    const jpegBytes = getDataUrlBytes(`data:image/jpeg;base64,${base64}`);
    expect(pngBytes).toBe(jpegBytes);
  });
});
