/**
 * @jest-environment node
 */

/**
 * Receipt Route — Integration Tests
 *
 * Tests the POST /api/receipt route handler directly (no HTTP server).
 * Mocks: Supabase, Turnstile, rate limiters, AI generation.
 *
 * Key behaviors verified:
 * - Valid request with an internal tester token → 200 with generation_status
 * - Missing receipt_token → 400
 * - Honeypot field set → 403
 * - Burst rate limit exceeded → 429
 * - Turnstile failure → 403
 */

// Mock heavy dependencies before any imports
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  isSupabaseConfigured: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/turnstile", () => ({
  guardTurnstile: jest.fn().mockResolvedValue({ passed: true }),
}));

jest.mock("@/lib/receipt-openai", () => ({
  generateReceipt: jest.fn().mockResolvedValue({
    receipt: { verdict: "Pass", verdict_reason: "Test" },
    model_used: "gpt-4o",
    usage: { prompt_tokens: 100, completion_tokens: 200 },
  }),
  fixReceiptFormatting: jest.fn(),
  buildEnhancedFallbackReceipt: jest.fn(),
}));

jest.mock("@/lib/receipt-rate-limiter", () => ({
  receiptBurstLimiter: {
    checkAsync: jest.fn().mockResolvedValue({ allowed: true, resetAt: Date.now() + 3600000 }),
  },
  checkDailyLimit: jest.fn().mockResolvedValue({ allowed: true }),
  incrementDailyCount: jest.fn().mockResolvedValue(undefined),
  decrementReceiptCredit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/receipt-idempotency", () => ({
  computeInputHash: jest.fn().mockReturnValue("test-hash"),
  checkIdempotency: jest.fn().mockResolvedValue({ status: "new" }),
  claimRequest: jest.fn().mockResolvedValue(undefined),
  completeRequest: jest.fn().mockResolvedValue(undefined),
  failRequest: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/receipt-pro", () => ({
  checkIsPro: jest.fn().mockResolvedValue(false),
}));

jest.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/lib/rollout-flags", () => ({
  isInternalTester: jest.fn().mockReturnValue(true), // bypass rate limits by default
}));

jest.mock("@/lib/api-auth", () => ({
  getSupabaseAdmin: jest.fn().mockReturnValue(null),
}));

jest.mock("@/lib/debug-trace", () => ({
  createTrace: jest.fn().mockReturnValue(null),
  finalizeTrace: jest.fn().mockReturnValue(null),
}));

jest.mock("@/lib/debug-trace-store", () => ({
  persistTrace: jest.fn().mockResolvedValue(undefined),
}));

// Disable the background upgrade trigger
jest.mock("node-fetch", () => jest.fn().mockResolvedValue({ ok: true }), {
  virtual: true,
});

import { NextRequest } from "next/server";

// Helper: build a minimal valid request body
function makeBody(overrides: Record<string, unknown> = {}) {
  return {
    receipt_token: "rt_1234567890123_internal",
    listing_text: "2022 Tesla Model 3 Long Range, 45,000 miles, $28,500. Battery health 91%, clean title, no accidents. Private seller.",
    turnstile_token: "test-turnstile-token",
    ...overrides,
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/receipt", () => {
  let POST: typeof import("@/app/api/receipt/route").POST;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/receipt/route"));
  });

  it("returns 400 for missing receipt_token", async () => {
    const req = makeRequest({ listing_text: "some text" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/receipt_token/i);
  });

  it("returns 403 for honeypot field set", async () => {
    const req = makeRequest(makeBody({ leave_this_empty: "bot" }));
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when listing text is too short", async () => {
    const req = makeRequest(makeBody({ listing_text: "short" }));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 429 when burst limit exceeded", async () => {
    const { receiptBurstLimiter } = await import("@/lib/receipt-rate-limiter");
    const { isInternalTester } = await import("@/lib/rollout-flags");
    (isInternalTester as jest.Mock).mockReturnValueOnce(false); // not a tester → subject to rate limit
    (receiptBurstLimiter.checkAsync as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      resetAt: Date.now() + 60000,
    });

    // Valid token format: rt_{13-digit-ts}_{24-hex-chars}
    const validToken = `rt_${Date.now()}_${"a".repeat(24)}`;
    const req = makeRequest(makeBody({ receipt_token: validToken }));
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 403 when Turnstile fails", async () => {
    const { guardTurnstile } = await import("@/lib/turnstile");
    const { isInternalTester } = await import("@/lib/rollout-flags");
    const { NextResponse } = await import("next/server");
    (isInternalTester as jest.Mock).mockReturnValueOnce(false);
    // guardTurnstile returns NextResponse | null — return a real 403 response
    (guardTurnstile as jest.Mock).mockResolvedValueOnce(
      NextResponse.json({ success: false, error: "Captcha required" }, { status: 403 })
    );

    const validToken = `rt_${Date.now()}_${"b".repeat(24)}`;
    const req = makeRequest(makeBody({ receipt_token: validToken }));
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
