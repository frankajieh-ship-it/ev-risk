/**
 * Simple Rate Limiter
 *
 * In-memory rate limiting for API endpoints
 * In production, use Redis or a dedicated service
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup every minute
    if (typeof window === 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  /**
   * Check if request is allowed
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // No entry or expired
    if (!entry || entry.resetAt < now) {
      const resetAt = now + this.windowMs;
      this.store.set(identifier, { count: 1, resetAt });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt,
      };
    }

    // Within window
    if (entry.count < this.maxRequests) {
      entry.count++;
      this.store.set(identifier, entry);
      return {
        allowed: true,
        remaining: this.maxRequests - entry.count,
        resetAt: entry.resetAt,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt < now) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton instances for different endpoints
export const extractionRateLimiter = new RateLimiter(
  15 * 60 * 1000, // 15 minutes
  10 // 10 extractions per 15 min
);

export const reportRateLimiter = new RateLimiter(
  15 * 60 * 1000, // 15 minutes
  50 // 50 reports per 15 min
);

export const analyticsRateLimiter = new RateLimiter(
  60 * 1000, // 1 minute
  30 // 30 requests per minute
);

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}
