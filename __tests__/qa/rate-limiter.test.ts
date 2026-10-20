/**
 * QA — rate limiter (chain B3 verification)
 *
 * The Tech Lead moved 43 call sites from the in-memory `.check()` to `checkAsync()`.
 * These tests check what that change relies on, with Upstash mocked (no network):
 *   - with Upstash env vars set, checkAsync() goes to Redis (shared across instances)
 *   - without them, it falls back to in-memory, same as before
 *   - a Redis error fails open to in-memory (documented behavior, not a block)
 *   - QA-11: every limiter must get its own Redis key prefix, or limiters with the
 *     same window share one counter per IP once Upstash is on
 *
 * `it.failing` = known open bug, see Team/02_Projects/buying-agent/qa/baseline-report.md.
 */

const ratelimitConfigs: Array<{ prefix?: string }> = [];
const limitMock = jest.fn();

jest.mock("@upstash/redis", () => ({ Redis: jest.fn().mockImplementation(() => ({})) }));
jest.mock("@upstash/ratelimit", () => {
  const Ratelimit = jest.fn().mockImplementation((config: { prefix?: string }) => {
    ratelimitConfigs.push(config);
    return { limit: limitMock };
  });
  (Ratelimit as unknown as { slidingWindow: jest.Mock }).slidingWindow = jest.fn(() => ({}));
  return { Ratelimit };
});

type RateLimiterCtor = new (windowMs: number, max: number) => {
  checkAsync(id: string): Promise<{ allowed: boolean; remaining: number; resetAt: number }>;
};

function loadRateLimiter(withUpstash: boolean): RateLimiterCtor {
  if (withUpstash) {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  } else {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
  let Ctor!: RateLimiterCtor;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Ctor = require("@/lib/rate-limiter").RateLimiter;
  });
  return Ctor;
}

beforeEach(() => {
  jest.useFakeTimers(); // InMemoryRateLimiter starts a cleanup setInterval
  ratelimitConfigs.length = 0;
  limitMock.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("B3: checkAsync uses the shared store when configured", () => {
  it("with Upstash env set, checkAsync() asks Redis and returns its answer", async () => {
    const RateLimiter = loadRateLimiter(true);
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: 123 });
    const r = await new RateLimiter(60_000, 10).checkAsync("1.2.3.4");
    expect(limitMock).toHaveBeenCalledWith("1.2.3.4");
    expect(r).toEqual({ allowed: false, remaining: 0, resetAt: 123 });
  });

  it("a block from Redis holds even on a fresh instance (no per-instance memory)", async () => {
    const RateLimiter = loadRateLimiter(true);
    limitMock.mockResolvedValue({ success: false, remaining: 0, reset: 1 });
    // Simulates a second serverless instance: a new object with empty local memory
    const secondInstance = new RateLimiter(60_000, 10);
    expect((await secondInstance.checkAsync("1.2.3.4")).allowed).toBe(false);
  });

  it("without Upstash env, falls back to in-memory and enforces the limit", async () => {
    const RateLimiter = loadRateLimiter(false);
    const limiter = new RateLimiter(60_000, 2);
    expect((await limiter.checkAsync("ip")).allowed).toBe(true);
    expect((await limiter.checkAsync("ip")).allowed).toBe(true);
    expect((await limiter.checkAsync("ip")).allowed).toBe(false);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("a Redis error fails open to the in-memory limit (does not block traffic)", async () => {
    const RateLimiter = loadRateLimiter(true);
    limitMock.mockRejectedValue(new Error("redis down"));
    const limiter = new RateLimiter(60_000, 1);
    expect((await limiter.checkAsync("ip")).allowed).toBe(true);
    expect((await limiter.checkAsync("ip")).allowed).toBe(false);
  });

  it.failing("QA-11: each limiter gets its own Redis key prefix", () => {
    // Upstash sliding-window key = `${prefix}:${identifier}:${window}`. With the default
    // prefix, e.g. app/api/auction/batch (2/min) and app/api/copart/lot (20/min), both
    // keyed by IP with a 60s window, increment the same Redis key.
    const RateLimiter = loadRateLimiter(true);
    new RateLimiter(60_000, 2);
    new RateLimiter(60_000, 20);
    const prefixes = ratelimitConfigs.slice(-2).map((c) => c.prefix);
    expect(prefixes[0]).toBeDefined();
    expect(prefixes[0]).not.toBe(prefixes[1]);
  });
});
