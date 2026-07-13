/**
 * Response cache for DISPLAY-ONLY GET routes (reputation, treasury view,
 * agents list, fx rate…). Spending enforcement never reads through this —
 * it calls its own loaders directly — so staleness here can only ever make
 * a dashboard number a few seconds old, never a policy decision.
 *
 * Write handlers in the same domain call bustRouteCache() so edits are
 * visible immediately.
 */

type Entry = { at: number; body: string; status: number };

const cache = new Map<string, Entry>();
const MAX_ENTRIES = 2_000;

export async function cachedJsonResponse(
  key: string,
  ttlMs: number,
  produce: () => Promise<Response>,
): Promise<Response> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return new Response(hit.body, {
      status: hit.status,
      headers: { "content-type": "application/json", "x-nebula-cache": "hit" },
    });
  }
  const res = await produce();
  if (res.ok) {
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    const body = await res.clone().text();
    cache.set(key, { at: Date.now(), body, status: res.status });
  }
  return res;
}

/** Remove every cached response whose key starts with the given prefix. */
export function bustRouteCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * Rate-limit hook (Upstash). Falls back to a small in-memory limiter when env
 * is missing so sensitive routes (OAuth DCR) stay protected locally.
 */
export async function rateLimitOrThrow(
  key: string,
  opts?: { limit?: number; window?: `${number} ${"s" | "m" | "h" | "d"}` },
): Promise<{ success: boolean; remaining?: number }> {
  const limit = opts?.limit ?? 60;
  const window = opts?.window ?? "1 m";
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return memoryRateLimit(key, limit, parseWindowMs(window));
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: "nebula",
    });
    const result = await limiter.limit(key);
    return { success: result.success, remaining: result.remaining };
  } catch (error) {
    console.error("[ratelimit]", error);
    return memoryRateLimit(key, limit, parseWindowMs(window));
  }
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function parseWindowMs(window: string): number {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(window.trim());
  if (!m) return 60_000;
  const n = Number(m[1]);
  const unit = m[2];
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60_000;
  if (unit === "h") return n * 3_600_000;
  return n * 86_400_000;
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const now = Date.now();
  const hit = memoryBuckets.get(key);
  if (!hit || now >= hit.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (hit.count >= limit) {
    return { success: false, remaining: 0 };
  }
  hit.count += 1;
  return { success: true, remaining: limit - hit.count };
}

