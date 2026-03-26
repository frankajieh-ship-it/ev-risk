/**
 * Rate Limiter
 *
 * Uses Upstash Redis in production (serverless-safe, shared across instances).
 * Falls back to in-memory when UPSTASH_REDIS_REST_URL is not set (local dev).
 *
 * Setup: Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local
 * and Netlify environment variables.
 */

// ---------------------------------------------------------------------------
// In-memory fallback (local dev / missing env vars)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    if (typeof window === "undefined") {
      setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);
    if (!entry || entry.resetAt < now) {
      const resetAt = now + this.windowMs;
      this.store.set(identifier, { count: 1, resetAt });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt };
    }
    if (entry.count < this.maxRequests) {
      entry.count++;
      this.store.set(identifier, entry);
      return { allowed: true, remaining: this.maxRequests - entry.count, resetAt: entry.resetAt };
    }
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) this.store.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Upstash Redis limiter wrapper
// ---------------------------------------------------------------------------

interface LimiterResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimiterLike {
  check(identifier: string): Promise<LimiterResult> | LimiterResult;
}

function makeUpstashLimiter(windowSeconds: number, maxRequests: number): RateLimiterLike | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    // Dynamic import so build doesn't fail if package is missing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Ratelimit } = require("@upstash/ratelimit");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require("@upstash/redis");

    const redis = new Redis({ url, token });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds}s`),
      analytics: false,
    });

    return {
      async check(identifier: string): Promise<LimiterResult> {
        const { success, remaining, reset } = await limiter.limit(identifier);
        return {
          allowed: success,
          remaining,
          resetAt: Number(reset),
        };
      },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Unified limiter: tries Upstash first, falls back to in-memory
// ---------------------------------------------------------------------------

class RateLimiter {
  private upstash: RateLimiterLike | null;
  private fallback: InMemoryRateLimiter;
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.upstash = makeUpstashLimiter(Math.ceil(windowMs / 1000), maxRequests);
    this.fallback = new InMemoryRateLimiter(windowMs, maxRequests);
  }

  async checkAsync(identifier: string): Promise<LimiterResult> {
    if (this.upstash) {
      try {
        return await this.upstash.check(identifier);
      } catch {
        // Redis error — fall back to in-memory rather than blocking traffic
      }
    }
    return this.fallback.check(identifier);
  }

  /**
   * Synchronous check — uses in-memory only.
   * Use checkAsync() for distributed rate limiting in production.
   * This method exists for backwards compatibility with call sites that
   * haven't been updated yet (returns in-memory result, Redis not consulted).
   */
  check(identifier: string): LimiterResult {
    return this.fallback.check(identifier);
  }
}

// ---------------------------------------------------------------------------
// Singleton instances (same names as before — call sites unchanged)
// ---------------------------------------------------------------------------

export const extractionRateLimiter = new RateLimiter(
  15 * 60 * 1000, // 15 minutes
  100
);

export const reportRateLimiter = new RateLimiter(
  15 * 60 * 1000, // 15 minutes
  50
);

export const analyticsRateLimiter = new RateLimiter(
  60 * 1000, // 1 minute
  30
);

export { RateLimiter };

/**
 * Get client IP from request headers (Netlify/Cloudflare compatible)
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIP || "unknown";
}
