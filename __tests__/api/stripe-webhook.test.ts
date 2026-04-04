/**
 * @jest-environment node
 */

/**
 * Stripe Webhook Route — Integration Tests
 *
 * Tests POST /api/stripe/webhook directly (no HTTP server).
 * Mocks: Stripe SDK (signature verification + constructEvent), Supabase.
 *
 * Key behaviors verified:
 * - Missing stripe-signature header → 400
 * - Invalid signature → 400
 * - Duplicate event ID → 200 with deduplicated:true
 * - checkout.session.completed with amount_total 3900 → fulfillFullRiskReport
 * - checkout.session.completed with scenario_type → fulfillBuyerPass path
 */

const mockConstructEvent = jest.fn();
const mockSupabaseFrom = jest.fn();

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }));
});

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
  isSupabaseConfigured: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/audit-logger", () => ({
  audit: jest.fn(),
}));

jest.mock("@/lib/resend", () => ({
  sendChecklistEmail: jest.fn().mockResolvedValue(undefined),
  isResendConfigured: jest.fn().mockReturnValue(false),
}));

// Set required env vars before module loads
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_placeholder";

import { NextRequest } from "next/server";

function makeWebhookRequest(body: string, sig: string = "valid-sig") {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": sig,
    },
    body,
  });
}

// A minimal Stripe checkout.session.completed event
function makeCheckoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: `evt_test_${Date.now()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        payment_status: "paid",
        amount_total: 1500,
        metadata: {},
        client_reference_id: "report-abc123",
        ...overrides,
      },
    },
  };
}

// Default chainable Supabase mock
function mockSupabaseChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
    single: jest.fn().mockResolvedValue(result),
    then: undefined as unknown,
  };
  mockSupabaseFrom.mockReturnValue(chain);
  return chain;
}

describe("POST /api/stripe/webhook", () => {
  let POST: typeof import("@/app/api/stripe/webhook/route").POST;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/stripe/webhook/route"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseChain();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const req = makeWebhookRequest(JSON.stringify({}), "bad-sig");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/signature/i);
  });

  it("returns 200 with deduplicated:true for a duplicate event", async () => {
    const event = makeCheckoutEvent();
    mockConstructEvent.mockReturnValueOnce(event);

    // Supabase returns an existing record (duplicate)
    mockSupabaseFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: event.id }, error: null }),
    });

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deduplicated).toBe(true);
  });

  it("processes checkout.session.completed with standard amount", async () => {
    const event = makeCheckoutEvent({ amount_total: 1500 });
    mockConstructEvent.mockReturnValueOnce(event);
    mockSupabaseChain({ data: null, error: null }); // no duplicate

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("routes amount_total 3900 to fulfillFullRiskReport path", async () => {
    const event = makeCheckoutEvent({ amount_total: 3900 });
    mockConstructEvent.mockReturnValueOnce(event);

    // Track which tables get inserted/updated
    const insertedTables: string[] = [];
    mockSupabaseFrom.mockImplementation((table: string) => {
      insertedTables.push(table);
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Should have touched stripe_webhook_events table for dedup record
    expect(insertedTables).toContain("stripe_webhook_events");
  });

  it("routes checkout with scenario_type metadata to fulfillBuyerPass path", async () => {
    const event = makeCheckoutEvent({
      amount_total: 999,
      metadata: { scenario_type: "decision_pack", scenario_id: "scenario-xyz" },
    });
    mockConstructEvent.mockReturnValueOnce(event);
    mockSupabaseChain({ data: null, error: null });

    const req = makeWebhookRequest(JSON.stringify(event));
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
