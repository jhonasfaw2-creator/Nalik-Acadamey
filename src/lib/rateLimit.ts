const globalForRateLimit = globalThis as unknown as { rateLimitStore?: Map<string, { count: number; resetAt: number }>; };

const store = globalForRateLimit.rateLimitStore ?? new Map();
globalForRateLimit.rateLimitStore = store;

function prune(now: number) {
  if (store.size < 5000) return;
  for (const [k, v] of store) {
    if (now > v.resetAt) store.delete(k);
  }
}

/**
 * Check and increment a simple in-memory rate limit counter.
 * Returns true when the request is allowed, false when rate limited.
 *
 * Note: in-memory limits are per-instance and not reliable for horizontal
 * scaling — use a shared store (Redis, Upstash) in production.
 */
export function checkAndIncrement(key: string, limit = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  prune(now);
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function getRemaining(key: string, limit = 100, windowMs = 60_000) {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) return { remaining: limit, resetAt: now + windowMs };
  return { remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

export default { checkAndIncrement, getRemaining };
