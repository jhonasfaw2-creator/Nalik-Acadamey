/**
 * Simple in-memory rate limiter for API endpoints.
 * Each limiter instance tracks submissions per key (typically IP).
 * Suitable for single-server deployments.
 */

interface RateLimitEntry {
  timestamp: number;
}

export interface RateLimiterConfig {
  /** Window duration in milliseconds (default: 60s) */
  windowMs?: number;
  /** Max requests per window (default: 30) */
  maxRequests?: number;
  /** Cleanup threshold — purge old entries when map exceeds this size */
  cleanupThreshold?: number;
}

export function createRateLimiter(config: RateLimiterConfig = {}) {
  const { windowMs = 60_000, maxRequests = 30, cleanupThreshold = 200 } = config;
  const store = new Map<string, RateLimitEntry>();

  function isRateLimited(key: string): boolean {
    const now = Date.now();
    const entry = store.get(key);

    if (entry && now - entry.timestamp < windowMs) {
      return true;
    }

    store.set(key, { timestamp: now });

    // Periodic cleanup
    if (store.size > cleanupThreshold) {
      for (const [k, v] of store) {
        if (now - v.timestamp > windowMs) store.delete(k);
      }
    }

    return false;
  }

  /** Get remaining requests in the current window for a key. */
  function remaining(key: string): number {
    const entry = store.get(key);
    if (!entry || Date.now() - entry.timestamp >= windowMs) return maxRequests;
    return Math.max(0, maxRequests - 1);
  }

  return { isRateLimited, remaining };
}

/** Extract client IP from request headers. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
