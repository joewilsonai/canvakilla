import { createHmac, randomBytes } from "node:crypto";

export type LimitCheck = {
  ok: boolean;
  resetSeconds: number;
  message: string;
};

export type RateLimitOptions = {
  cost: number;
  costHourLimit: number;
  costMinuteLimit: number;
  minuteLimit: number;
  hourLimit: number;
};

export type SharedLimiterConfig = {
  token: string;
  url: string;
};

export type GenerationGuard = LimitCheck & {
  release: () => Promise<void>;
};

type RateBucket = {
  minuteStartedAt: number;
  minuteCount: number;
  minuteCost: number;
  hourStartedAt: number;
  hourCount: number;
  hourCost: number;
};

type RedisResult<T = unknown> = {
  result?: T;
  error?: string;
};

const globalRateState = globalThis as typeof globalThis & {
  canvaKillaRateBuckets?: Map<string, RateBucket>;
  canvaKillaActiveGenerations?: Set<string>;
};

const rateBuckets =
  globalRateState.canvaKillaRateBuckets ||
  (globalRateState.canvaKillaRateBuckets = new Map<string, RateBucket>());
const activeGenerations =
  globalRateState.canvaKillaActiveGenerations ||
  (globalRateState.canvaKillaActiveGenerations = new Set<string>());

let lastRateCleanupAt = 0;
let warnedMissingSharedLimiter = false;
let warnedSharedLimiterFailure = false;

export function getLimiterKey(
  scope: "ip" | "session",
  value: string,
  signingSecret: string,
) {
  return `${scope}:${createHmac("sha256", signingSecret)
    .update(`${scope}:${value || "unknown"}`)
    .digest("base64url")
    .slice(0, 32)}`;
}

function sanitizeEnvValue(value?: string) {
  return (value || "")
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "")
    .trim();
}

export function getSharedLimiterConfig(): SharedLimiterConfig | null {
  const url = sanitizeEnvValue(
    process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_KV_REST_API_URL ||
      process.env.KV_REST_API_URL,
  );
  const token = sanitizeEnvValue(
    process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.UPSTASH_REDIS_KV_REST_API_TOKEN ||
      process.env.KV_REST_API_TOKEN,
  );

  if (!url || !token) return null;
  return { url: url.replace(/\/+$/g, ""), token };
}

export function isSharedLimiterRequired() {
  const value = (
    process.env.CANVAKILLA_REQUIRE_SHARED_LIMITER ||
    process.env.REQUIRE_SHARED_RATE_LIMITER ||
    ""
  )
    .trim()
    .toLowerCase();

  return value === "1" || value === "true" || value === "yes";
}

export function warnMissingSharedLimiter() {
  if (process.env.NODE_ENV !== "production" || warnedMissingSharedLimiter) return;
  warnedMissingSharedLimiter = true;
  console.warn(
    "Shared rate limiter env vars are missing; falling back to in-memory generation limits.",
  );
}

export function warnSharedLimiterFailure(error: unknown) {
  if (warnedSharedLimiterFailure) return;
  warnedSharedLimiterFailure = true;
  console.warn("Shared rate limiter failed; falling back to in-memory limits.", {
    message: error instanceof Error ? error.message : String(error),
  });
}

async function runRedisCommand<T = unknown>(
  config: SharedLimiterConfig,
  path: "" | "multi-exec",
  command: unknown,
) {
  const response = await fetch(path ? `${config.url}/${path}` : config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | RedisResult<T>
    | Array<RedisResult>
    | null;

  if (!response.ok || !payload || (!Array.isArray(payload) && payload.error)) {
    const message =
      !payload || Array.isArray(payload)
        ? `Redis request failed with ${response.status}`
        : payload.error || `Redis request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

async function runRedisTransaction(
  config: SharedLimiterConfig,
  commands: unknown[][],
) {
  const payload = await runRedisCommand<Array<RedisResult>>(
    config,
    "multi-exec",
    commands,
  );
  const failed = payload.find((item) => item.error);
  if (failed?.error) throw new Error(failed.error);
  return payload;
}

async function releaseRedisLock(
  config: SharedLimiterConfig,
  key: string,
  token: string,
) {
  const script =
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
  await runRedisCommand(config, "", ["EVAL", script, 1, key, token]);
}

function getRedisNumber(result: RedisResult | undefined) {
  const value = result?.result;
  return typeof value === "number" ? value : Number.parseInt(String(value || 0), 10);
}

async function checkSharedRateLimit(
  config: SharedLimiterConfig,
  clientKey: string,
  {
    cost,
    costHourLimit,
    costMinuteLimit,
    minuteLimit,
    hourLimit,
  }: RateLimitOptions,
): Promise<LimitCheck> {
  const now = Date.now();
  const minuteWindow = Math.floor(now / 60_000);
  const hourWindow = Math.floor(now / 3_600_000);
  const minuteResetSeconds = Math.max(
    1,
    Math.ceil(((minuteWindow + 1) * 60_000 - now) / 1000),
  );
  const hourResetSeconds = Math.max(
    1,
    Math.ceil(((hourWindow + 1) * 3_600_000 - now) / 1000),
  );
  const prefix = `canvakilla:rl:${clientKey}`;
  const minuteCountKey = `${prefix}:mc:${minuteWindow}`;
  const minuteCostKey = `${prefix}:mk:${minuteWindow}`;
  const hourCountKey = `${prefix}:hc:${hourWindow}`;
  const hourCostKey = `${prefix}:hk:${hourWindow}`;

  const results = await runRedisTransaction(config, [
    ["INCR", minuteCountKey],
    ["INCRBY", minuteCostKey, cost],
    ["INCR", hourCountKey],
    ["INCRBY", hourCostKey, cost],
    ["EXPIRE", minuteCountKey, 120],
    ["EXPIRE", minuteCostKey, 120],
    ["EXPIRE", hourCountKey, 7200],
    ["EXPIRE", hourCostKey, 7200],
  ]);

  const minuteCount = getRedisNumber(results[0]);
  const minuteCost = getRedisNumber(results[1]);
  const hourCount = getRedisNumber(results[2]);
  const hourCost = getRedisNumber(results[3]);

  if (minuteCount > minuteLimit) {
    return {
      ok: false,
      resetSeconds: minuteResetSeconds,
      message: `Too many generations. Try again in about ${minuteResetSeconds} seconds.`,
    };
  }

  if (hourCount > hourLimit) {
    return {
      ok: false,
      resetSeconds: hourResetSeconds,
      message: "Hourly generation limit reached. Try again later.",
    };
  }

  if (minuteCost > costMinuteLimit) {
    return {
      ok: false,
      resetSeconds: minuteResetSeconds,
      message: `This model is temporarily capped. Try again in about ${minuteResetSeconds} seconds or switch to a cheaper model.`,
    };
  }

  if (hourCost > costHourLimit) {
    return {
      ok: false,
      resetSeconds: hourResetSeconds,
      message: "Hourly model budget reached. Try a cheaper model or come back later.",
    };
  }

  return {
    ok: true,
    resetSeconds: 0,
    message: "",
  };
}

function pruneRateBuckets(now: number) {
  if (now - lastRateCleanupAt < 60_000) return;
  lastRateCleanupAt = now;

  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.hourStartedAt > 3_900_000) {
      rateBuckets.delete(key);
    }
  }
}

function checkInMemoryRateLimit(
  clientKey: string,
  { cost, costHourLimit, costMinuteLimit, minuteLimit, hourLimit }: RateLimitOptions,
): LimitCheck {
  const now = Date.now();
  pruneRateBuckets(now);
  const bucket =
    rateBuckets.get(clientKey) ||
    ({
      minuteStartedAt: now,
      minuteCount: 0,
      minuteCost: 0,
      hourStartedAt: now,
      hourCount: 0,
      hourCost: 0,
    } satisfies RateBucket);

  if (now - bucket.minuteStartedAt >= 60_000) {
    bucket.minuteStartedAt = now;
    bucket.minuteCount = 0;
    bucket.minuteCost = 0;
  }

  if (now - bucket.hourStartedAt >= 3_600_000) {
    bucket.hourStartedAt = now;
    bucket.hourCount = 0;
    bucket.hourCost = 0;
  }

  if (bucket.minuteCount >= minuteLimit) {
    const resetSeconds = Math.max(
      1,
      Math.ceil((60_000 - (now - bucket.minuteStartedAt)) / 1000),
    );
    return {
      ok: false,
      resetSeconds,
      message: `Too many generations. Try again in about ${resetSeconds} seconds.`,
    };
  }

  if (bucket.hourCount >= hourLimit) {
    return {
      ok: false,
      resetSeconds: Math.max(
        1,
        Math.ceil((3_600_000 - (now - bucket.hourStartedAt)) / 1000),
      ),
      message: "Hourly generation limit reached. Try again later.",
    };
  }

  if (bucket.minuteCost + cost > costMinuteLimit) {
    const resetSeconds = Math.max(
      1,
      Math.ceil((60_000 - (now - bucket.minuteStartedAt)) / 1000),
    );
    return {
      ok: false,
      resetSeconds,
      message: `This model is temporarily capped. Try again in about ${resetSeconds} seconds or switch to a cheaper model.`,
    };
  }

  if (bucket.hourCost + cost > costHourLimit) {
    return {
      ok: false,
      resetSeconds: Math.max(
        1,
        Math.ceil((3_600_000 - (now - bucket.hourStartedAt)) / 1000),
      ),
      message: "Hourly model budget reached. Try a cheaper model or come back later.",
    };
  }

  bucket.minuteCount += 1;
  bucket.hourCount += 1;
  bucket.minuteCost += cost;
  bucket.hourCost += cost;
  rateBuckets.set(clientKey, bucket);

  return {
    ok: true,
    resetSeconds: 0,
    message: "",
  };
}

export async function checkGenerationRateLimit(
  sharedLimiter: SharedLimiterConfig | null,
  clientKey: string,
  options: RateLimitOptions,
) {
  if (sharedLimiter) {
    return checkSharedRateLimit(sharedLimiter, clientKey, options);
  }

  return checkInMemoryRateLimit(clientKey, options);
}

async function acquireSharedGenerationGuard({
  config,
  ipKey,
  maxActiveGenerations,
  sessionKey,
}: {
  config: SharedLimiterConfig;
  ipKey: string;
  maxActiveGenerations: number;
  sessionKey: string;
}): Promise<GenerationGuard> {
  const lockToken = randomBytes(12).toString("base64url");
  const sessionLockKey = `canvakilla:active:${sessionKey}`;
  const ipLockKey = `canvakilla:active:${ipKey}`;
  const globalActiveKey = "canvakilla:active:global";
  let released = false;

  const release = async () => {
    if (released) return;
    released = true;
    await Promise.allSettled([
      releaseRedisLock(config, sessionLockKey, lockToken),
      releaseRedisLock(config, ipLockKey, lockToken),
      runRedisCommand(config, "", ["DECR", globalActiveKey]),
    ]);
  };

  const results = await runRedisTransaction(config, [
    ["SET", sessionLockKey, lockToken, "EX", 120, "NX"],
    ["SET", ipLockKey, lockToken, "EX", 120, "NX"],
    ["INCR", globalActiveKey],
    ["EXPIRE", globalActiveKey, 180],
  ]);

  const sessionLocked = results[0]?.result === "OK";
  const ipLocked = results[1]?.result === "OK";
  const activeCount = getRedisNumber(results[2]);

  if (!sessionLocked || !ipLocked) {
    await release();
    return {
      ok: false,
      resetSeconds: 30,
      message: "A generation is already running for this browser or network.",
      release: async () => {},
    };
  }

  if (activeCount > maxActiveGenerations) {
    await release();
    return {
      ok: false,
      resetSeconds: 60,
      message: "CanvaKilla is busy. Try again in a minute.",
      release: async () => {},
    };
  }

  return {
    ok: true,
    resetSeconds: 0,
    message: "",
    release,
  };
}

export async function acquireGenerationGuard({
  ipKey,
  maxActiveGenerations,
  sessionKey,
  sharedLimiter,
}: {
  ipKey: string;
  maxActiveGenerations: number;
  sessionKey: string;
  sharedLimiter: SharedLimiterConfig | null;
}): Promise<GenerationGuard> {
  if (sharedLimiter) {
    return acquireSharedGenerationGuard({
      config: sharedLimiter,
      ipKey,
      maxActiveGenerations,
      sessionKey,
    });
  }

  if (activeGenerations.size >= maxActiveGenerations) {
    return {
      ok: false,
      resetSeconds: 60,
      message: "CanvaKilla is busy. Try again in a minute.",
      release: async () => {},
    };
  }

  if (activeGenerations.has(sessionKey) || activeGenerations.has(ipKey)) {
    return {
      ok: false,
      resetSeconds: 30,
      message: "A generation is already running for this browser or network.",
      release: async () => {},
    };
  }

  activeGenerations.add(sessionKey);
  activeGenerations.add(ipKey);

  return {
    ok: true,
    resetSeconds: 0,
    message: "",
    release: async () => {
      activeGenerations.delete(sessionKey);
      activeGenerations.delete(ipKey);
    },
  };
}
