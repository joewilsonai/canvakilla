import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeModelId,
  getAspectRatio,
  getImageConfig,
  getSafeImageMimeType,
  buildBannerPrompt,
  buildProfilePrompt,
  buildPrompt,
  getRequestIp,
  getSigningSecret,
  signSessionId,
  parseCookies,
  verifySessionCookie,
  getLimit,
  isPrivateIp,
  getTextNote,
  findImageUrl,
} from "../../../app/api/generate/route";

// ---------------------------------------------------------------------------
// normalizeModelId
// ---------------------------------------------------------------------------

describe("normalizeModelId", () => {
  it("returns the model unchanged when it is a known full ID", () => {
    expect(normalizeModelId("google/gemini-3.1-flash-image-preview")).toBe(
      "google/gemini-3.1-flash-image-preview",
    );
  });

  it("maps legacy short IDs to their canonical full IDs", () => {
    expect(normalizeModelId("gpt-image-2")).toBe("openai/gpt-5.4-image-2");
    expect(normalizeModelId("gemini-3.1-flash-image-preview")).toBe(
      "google/gemini-3.1-flash-image-preview",
    );
    expect(normalizeModelId("gemini-2.5-flash-image")).toBe(
      "google/gemini-2.5-flash-image",
    );
    expect(normalizeModelId("gemini-3-pro-image-preview")).toBe(
      "google/gemini-3-pro-image-preview",
    );
  });

  it("falls back to the default model for a completely unknown string", () => {
    const fallback = "google/gemini-3.1-flash-image-preview";
    expect(normalizeModelId("totally-unknown-model")).toBe(fallback);
  });

  it("handles an empty string by returning the default model", () => {
    expect(normalizeModelId("")).toBe("google/gemini-3.1-flash-image-preview");
  });
});

// ---------------------------------------------------------------------------
// getAspectRatio
// ---------------------------------------------------------------------------

describe("getAspectRatio", () => {
  it("returns '3:1' for banner target on gemini-3.1-flash", () => {
    expect(
      getAspectRatio(
        "google/gemini-3.1-flash-image-preview",
        "banner",
      ),
    ).toBe("3:1");
  });

  it("returns '1:1' for profile target on all models", () => {
    const models = [
      "openai/gpt-5.4-image-2",
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-2.5-flash-image",
      "google/gemini-3-pro-image-preview",
    ] as const;
    for (const model of models) {
      expect(getAspectRatio(model, "profile")).toBe("1:1");
    }
  });

  it("returns null for banner target on models that don't specify a banner ratio", () => {
    expect(getAspectRatio("openai/gpt-5.4-image-2", "banner")).toBeNull();
    expect(getAspectRatio("google/gemini-2.5-flash-image", "banner")).toBeNull();
  });

  it("returns '3:1' for banner target on gemini-3-pro", () => {
    expect(
      getAspectRatio("google/gemini-3-pro-image-preview", "banner"),
    ).toBe("3:1");
  });
});

// ---------------------------------------------------------------------------
// getImageConfig
// ---------------------------------------------------------------------------

describe("getImageConfig", () => {
  it("returns undefined for models with no special config", () => {
    expect(getImageConfig("openai/gpt-5.4-image-2", "banner")).toBeUndefined();
    expect(getImageConfig("google/gemini-2.5-flash-image", "banner")).toBeUndefined();
  });

  it("returns an object with aspect_ratio and image_size for gemini-3.1-flash banner", () => {
    const config = getImageConfig(
      "google/gemini-3.1-flash-image-preview",
      "banner",
    );
    expect(config).toEqual({ aspect_ratio: "3:1", image_size: "2K" });
  });

  it("returns an object with aspect_ratio and image_size for gemini-3-pro banner", () => {
    const config = getImageConfig("google/gemini-3-pro-image-preview", "banner");
    expect(config).toEqual({ aspect_ratio: "3:1", image_size: "2K" });
  });

  it("returns only aspect_ratio for profile target when no bannerAspectRatio is null", () => {
    const config = getImageConfig(
      "google/gemini-3.1-flash-image-preview",
      "profile",
    );
    expect(config).toEqual({ aspect_ratio: "1:1", image_size: "2K" });
  });

  it("returns { aspect_ratio: '1:1' } for profile on gpt model (has profileAspectRatio)", () => {
    expect(getImageConfig("openai/gpt-5.4-image-2", "profile")).toEqual({
      aspect_ratio: "1:1",
    });
  });
});

// ---------------------------------------------------------------------------
// getSafeImageMimeType
// ---------------------------------------------------------------------------

describe("getSafeImageMimeType", () => {
  it.each([
    ["image/jpeg", "image/jpeg"],
    ["image/png", "image/png"],
    ["image/webp", "image/webp"],
    ["image/gif", "image/gif"],
  ])("accepts %s and returns it unchanged", (input, expected) => {
    expect(getSafeImageMimeType(input)).toBe(expected);
  });

  it("strips charset suffix and returns the base mime type", () => {
    expect(getSafeImageMimeType("image/png; charset=utf-8")).toBe("image/png");
  });

  it("normalises to lowercase before checking", () => {
    expect(getSafeImageMimeType("IMAGE/JPEG")).toBe("image/jpeg");
  });

  it("returns an empty string for an unsupported type", () => {
    expect(getSafeImageMimeType("application/pdf")).toBe("");
    expect(getSafeImageMimeType("text/html")).toBe("");
    expect(getSafeImageMimeType("image/svg+xml")).toBe("");
  });

  it("returns an empty string for an empty string", () => {
    expect(getSafeImageMimeType("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildBannerPrompt
// ---------------------------------------------------------------------------

describe("buildBannerPrompt", () => {
  it("contains the user prompt text verbatim", () => {
    const result = buildBannerPrompt("make it pink", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(result).toContain("make it pink");
  });

  it("uses 'current banner' wording when hasCurrentImage is true", () => {
    const result = buildBannerPrompt("add a cat", {
      hasCurrentImage: true,
      referenceLabels: [],
    });
    expect(result).toContain("current banner");
  });

  it("uses 'from scratch' wording when there is no current image and no references", () => {
    const result = buildBannerPrompt("create something cool", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(result).toContain("from scratch");
  });

  it("includes reference labels when provided", () => {
    const result = buildBannerPrompt("use the ref", {
      hasCurrentImage: false,
      referenceLabels: ["R1", "R2"],
    });
    expect(result).toContain("Reference R1");
    expect(result).toContain("Reference R2");
  });

  it("uses 'visual source material' wording when only references are present", () => {
    const result = buildBannerPrompt("match the style", {
      hasCurrentImage: false,
      referenceLabels: ["R1"],
    });
    expect(result).toContain("visual source material");
  });

  it("mentions both current banner and references when both are present", () => {
    const result = buildBannerPrompt("iterate but keep ref style", {
      hasCurrentImage: true,
      referenceLabels: ["R1"],
    });
    expect(result).toContain("current banner");
    expect(result).toContain("Reference R1");
  });

  it("always instructs to create an X/Twitter header banner", () => {
    const result = buildBannerPrompt("anything", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(result).toContain("X/Twitter profile header banner");
  });

  it("trims leading/trailing whitespace from the user prompt", () => {
    const result = buildBannerPrompt("  spaced prompt  ", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(result).toContain("spaced prompt");
    expect(result).not.toContain("  spaced prompt  ");
  });
});

// ---------------------------------------------------------------------------
// buildProfilePrompt
// ---------------------------------------------------------------------------

describe("buildProfilePrompt", () => {
  it("contains the user prompt text verbatim", () => {
    const result = buildProfilePrompt("make it square", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(result).toContain("make it square");
  });

  it("uses 'current X profile picture' wording when hasCurrentImage is true", () => {
    const result = buildProfilePrompt("lighten background", {
      hasCurrentImage: true,
      referenceLabels: [],
    });
    expect(result).toContain("current X profile picture");
  });

  it("uses 'from scratch' wording when no image and no references", () => {
    const result = buildProfilePrompt("create a logo", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(result).toContain("from scratch");
  });

  it("includes reference labels when provided", () => {
    const result = buildProfilePrompt("use the ref", {
      hasCurrentImage: false,
      referenceLabels: ["R1"],
    });
    expect(result).toContain("Reference R1");
  });

  it("always includes circular crop guidance", () => {
    const result = buildProfilePrompt("anything", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(result).toContain("circle");
  });
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe("buildPrompt", () => {
  it("delegates to buildBannerPrompt for 'banner' target", () => {
    const bannerResult = buildBannerPrompt("test", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    const dispatchResult = buildPrompt("banner", "test", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(dispatchResult).toBe(bannerResult);
  });

  it("delegates to buildProfilePrompt for 'profile' target", () => {
    const profileResult = buildProfilePrompt("test", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    const dispatchResult = buildPrompt("profile", "test", {
      hasCurrentImage: false,
      referenceLabels: [],
    });
    expect(dispatchResult).toBe(profileResult);
  });
});

// ---------------------------------------------------------------------------
// getRequestIp
// ---------------------------------------------------------------------------

describe("getRequestIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return new Request("https://example.com", { headers });
  }

  it("returns the first IP from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getRequestIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace around the IP in x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "  9.9.9.9  , 1.1.1.1" });
    expect(getRequestIp(req)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = makeRequest({ "x-real-ip": "10.0.0.1" });
    expect(getRequestIp(req)).toBe("10.0.0.1");
  });

  it("falls back to cf-connecting-ip when no forwarding headers are set", () => {
    const req = makeRequest({ "cf-connecting-ip": "203.0.113.5" });
    expect(getRequestIp(req)).toBe("203.0.113.5");
  });

  it("returns 'unknown-ip' when no IP headers are present", () => {
    const req = makeRequest({});
    expect(getRequestIp(req)).toBe("unknown-ip");
  });

  it("handles a single IP in x-forwarded-for with no trailing peers", () => {
    const req = makeRequest({ "x-forwarded-for": "8.8.8.8" });
    expect(getRequestIp(req)).toBe("8.8.8.8");
  });
});

// ---------------------------------------------------------------------------
// parseCookies
// ---------------------------------------------------------------------------

describe("parseCookies", () => {
  it("returns an empty map for null", () => {
    expect(parseCookies(null).size).toBe(0);
  });

  it("returns an empty map for an empty string", () => {
    expect(parseCookies("").size).toBe(0);
  });

  it("parses a single cookie", () => {
    const map = parseCookies("session=abc123");
    expect(map.get("session")).toBe("abc123");
  });

  it("parses multiple cookies separated by semicolons", () => {
    const map = parseCookies("a=1; b=2; c=3");
    expect(map.get("a")).toBe("1");
    expect(map.get("b")).toBe("2");
    expect(map.get("c")).toBe("3");
  });

  it("preserves equals signs inside a cookie value", () => {
    const map = parseCookies("token=base64+value==");
    expect(map.get("token")).toBe("base64+value==");
  });

  it("ignores cookie entries with no equals sign", () => {
    const map = parseCookies("bad; good=ok");
    expect(map.has("bad")).toBe(false);
    expect(map.get("good")).toBe("ok");
  });

  it("stores the full raw value including whitespace around the name", () => {
    // The implementation trims the entire item before splitting, so a
    // padded key like "  key  " becomes "key  " (trailing spaces remain).
    const map = parseCookies("  key  =value");
    expect(map.get("key  ")).toBe("value");
  });
});

// ---------------------------------------------------------------------------
// signSessionId / getSigningSecret / verifySessionCookie
// ---------------------------------------------------------------------------

describe("getSigningSecret", () => {
  beforeEach(() => {
    delete process.env.CANVAKILLA_SESSION_SECRET;
    delete process.env.OPENROUTER_API_KEY;
  });
  afterEach(() => {
    delete process.env.CANVAKILLA_SESSION_SECRET;
    delete process.env.OPENROUTER_API_KEY;
  });

  it("prefers CANVAKILLA_SESSION_SECRET over OPENROUTER_API_KEY", () => {
    process.env.CANVAKILLA_SESSION_SECRET = "secret-a";
    process.env.OPENROUTER_API_KEY = "secret-b";
    expect(getSigningSecret()).toBe("secret-a");
  });

  it("falls back to OPENROUTER_API_KEY when no session secret is set", () => {
    process.env.OPENROUTER_API_KEY = "router-key";
    expect(getSigningSecret()).toBe("router-key");
  });

  it("returns the hardcoded dev secret when no env vars are set", () => {
    expect(getSigningSecret()).toBe("canvakilla-local-development-secret");
  });
});

describe("signSessionId", () => {
  it("returns a non-empty base64url string", () => {
    const sig = signSessionId("test-session-id");
    expect(typeof sig).toBe("string");
    expect(sig.length).toBeGreaterThan(0);
    expect(/^[A-Za-z0-9_-]+$/.test(sig)).toBe(true);
  });

  it("is deterministic for the same session ID under the same secret", () => {
    const sig1 = signSessionId("same-id");
    const sig2 = signSessionId("same-id");
    expect(sig1).toBe(sig2);
  });

  it("produces different signatures for different session IDs", () => {
    const sig1 = signSessionId("id-one");
    const sig2 = signSessionId("id-two");
    expect(sig1).not.toBe(sig2);
  });
});

describe("verifySessionCookie", () => {
  it("returns empty string when value is undefined", () => {
    expect(verifySessionCookie(undefined)).toBe("");
  });

  it("returns empty string when value is an empty string", () => {
    expect(verifySessionCookie("")).toBe("");
  });

  it("returns empty string when there is no dot separator", () => {
    expect(verifySessionCookie("nodot")).toBe("");
  });

  it("returns empty string when the session ID part is too short", () => {
    const shortId = "abc";
    const sig = signSessionId(shortId);
    expect(verifySessionCookie(`${shortId}.${sig}`)).toBe("");
  });

  it("returns the session ID for a correctly signed cookie", () => {
    const id = "a".repeat(20);
    const sig = signSessionId(id);
    expect(verifySessionCookie(`${id}.${sig}`)).toBe(id);
  });

  it("returns empty string when the signature is tampered with", () => {
    const id = "b".repeat(20);
    const sig = signSessionId(id);
    const tampered = sig.slice(0, -4) + "ZZZZ";
    expect(verifySessionCookie(`${id}.${tampered}`)).toBe("");
  });

  it("returns empty string when the session ID contains invalid characters", () => {
    const id = "!@#$%^&*()".padEnd(20, "x");
    const sig = signSessionId(id);
    expect(verifySessionCookie(`${id}.${sig}`)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// getLimit
// ---------------------------------------------------------------------------

describe("getLimit", () => {
  beforeEach(() => {
    delete process.env.TEST_LIMIT_VAR;
  });
  afterEach(() => {
    delete process.env.TEST_LIMIT_VAR;
  });

  it("returns the parsed integer from the environment variable", () => {
    process.env.TEST_LIMIT_VAR = "42";
    expect(getLimit("TEST_LIMIT_VAR", 10)).toBe(42);
  });

  it("returns the fallback when the env var is absent", () => {
    expect(getLimit("TEST_LIMIT_VAR", 99)).toBe(99);
  });

  it("returns the fallback when the env var is not a number", () => {
    process.env.TEST_LIMIT_VAR = "not-a-number";
    expect(getLimit("TEST_LIMIT_VAR", 5)).toBe(5);
  });

  it("returns the fallback when the env var is zero", () => {
    process.env.TEST_LIMIT_VAR = "0";
    expect(getLimit("TEST_LIMIT_VAR", 7)).toBe(7);
  });

  it("returns the fallback when the env var is negative", () => {
    process.env.TEST_LIMIT_VAR = "-3";
    expect(getLimit("TEST_LIMIT_VAR", 7)).toBe(7);
  });

  it("handles a float string by truncating to an integer", () => {
    process.env.TEST_LIMIT_VAR = "3.9";
    expect(getLimit("TEST_LIMIT_VAR", 1)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// isPrivateIp
// ---------------------------------------------------------------------------

describe("isPrivateIp", () => {
  it.each([
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "192.168.0.1",
    "192.168.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "169.254.1.1",
    "fc00::1",
    "fd12:3456:789a:1::1",
  ])("classifies %s as private", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "203.0.113.5",
    "198.51.100.1",
    "172.15.255.255",
    "172.32.0.0",
    "11.0.0.1",
    "192.169.0.1",
  ])("classifies %s as public", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTextNote
// ---------------------------------------------------------------------------

describe("getTextNote", () => {
  it("returns empty string when message is undefined", () => {
    expect(getTextNote(undefined)).toBe("");
  });

  it("returns the content directly when it is a plain string", () => {
    expect(getTextNote({ content: "hello world" })).toBe("hello world");
  });

  it("returns empty string when content is not a string or array", () => {
    expect(getTextNote({ content: 42 })).toBe("");
    expect(getTextNote({ content: null })).toBe("");
  });

  it("joins text parts from an array content", () => {
    const message = {
      content: [
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ],
    };
    expect(getTextNote(message)).toBe("line one\nline two");
  });

  it("skips non-text parts in an array", () => {
    const message = {
      content: [
        { type: "image_url", image_url: { url: "http://example.com/img.png" } },
        { type: "text", text: "caption" },
      ],
    };
    expect(getTextNote(message)).toBe("caption");
  });

  it("returns empty string for an empty array", () => {
    expect(getTextNote({ content: [] })).toBe("");
  });
});

// ---------------------------------------------------------------------------
// findImageUrl
// ---------------------------------------------------------------------------

describe("findImageUrl", () => {
  it("returns empty string for an empty payload", () => {
    expect(findImageUrl({})).toBe("");
  });

  it("returns empty string when choices is empty", () => {
    expect(findImageUrl({ choices: [] })).toBe("");
  });

  it("finds a data URI embedded directly in a string content", () => {
    const dataUri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
    const payload = {
      choices: [
        {
          message: {
            content: `Some text before ${dataUri} some text after`,
          },
        },
      ],
    };
    expect(findImageUrl(payload)).toBe(dataUri);
  });

  it("returns a URL from image_url.url in array content", () => {
    const payload = {
      choices: [
        {
          message: {
            content: [
              {
                type: "image_url",
                image_url: { url: "https://cdn.example.com/img.png" },
              },
            ],
          },
        },
      ],
    };
    expect(findImageUrl(payload)).toBe("https://cdn.example.com/img.png");
  });

  it("returns a URL from the images array on the message", () => {
    const payload = {
      choices: [
        {
          message: {
            images: [{ url: "https://example.com/banner.jpg" }],
          },
        },
      ],
    };
    expect(findImageUrl(payload)).toBe("https://example.com/banner.jpg");
  });

  it("returns a URL from imageUrl.url (camelCase variant)", () => {
    const payload = {
      choices: [
        {
          message: {
            content: [
              { imageUrl: { url: "https://example.com/profile.webp" } },
            ],
          },
        },
      ],
    };
    expect(findImageUrl(payload)).toBe("https://example.com/profile.webp");
  });

  it("prioritises the images array over content array", () => {
    const payload = {
      choices: [
        {
          message: {
            images: [{ url: "https://example.com/first.png" }],
            content: [
              {
                type: "image_url",
                image_url: { url: "https://example.com/second.png" },
              },
            ],
          },
        },
      ],
    };
    expect(findImageUrl(payload)).toBe("https://example.com/first.png");
  });

  it("returns empty string when no image-like value exists in the payload", () => {
    const payload = {
      choices: [
        {
          message: {
            content: [{ type: "text", text: "no image here" }],
          },
        },
      ],
    };
    expect(findImageUrl(payload)).toBe("");
  });
});
