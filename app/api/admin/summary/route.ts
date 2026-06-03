// cache-bust: 20260328-1
/**
 * Unified Admin Summary Endpoint
 *
 * GET /api/admin/summary?period=day|week|last_30_days|month_to_date|custom
 *
 * Single source of truth for all admin dashboard metrics.
 * Queries: receipts, receipt_events, reports, report_feedback,
 *          user_events, visitors tables.
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const TIMEZONE = "America/Indiana/Indianapolis";

// Internal traffic is excluded via is_internal=true column on user_events
// (set at ingest time in /api/track-event, back-filled via migration-internal-flag.sql)

// ---------------------------------------------------------------------------
// Time-window helpers (reused from /api/admin/kpis)
// ---------------------------------------------------------------------------

function getUTCBoundariesForDate(dateStr: string): {
  start: string;
  end: string;
} {
  const [year, month, day] = dateStr.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    hour12: false,
  });
  const etHour = Number(
    formatter.formatToParts(probe).find((p) => p.type === "hour")?.value || "12"
  );
  const offsetHours = 12 - etHour;
  const startUTC = new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0));
  const endUTC = new Date(
    Date.UTC(year, month - 1, day + 1, offsetHours, 0, 0)
  );
  return { start: startUTC.toISOString(), end: endUTC.toISOString() };
}

/** Convert a UTC ISO timestamp string to a YYYY-MM-DD date in ET */
function utcToETDate(isoTimestamp: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(isoTimestamp));
  } catch {
    return isoTimestamp.split("T")[0] || "unknown";
  }
}

function getTodayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getFirstOfMonthET(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-");
  return `${parts[0]}-${parts[1]}-01`;
}

function getWindowBoundaries(
  period: string,
  dateParam: string | null,
  startParam: string | null,
  endParam: string | null
): { start: string; end: string } {
  const now = new Date();

  switch (period) {
    case "day": {
      const date = dateParam || getTodayET();
      return getUTCBoundariesForDate(date);
    }
    case "week":
      return {
        start: new Date(now.getTime() - 7 * 86400000).toISOString(),
        end: now.toISOString(),
      };
    case "last_30_days":
      return {
        start: new Date(now.getTime() - 30 * 86400000).toISOString(),
        end: now.toISOString(),
      };
    case "month_to_date": {
      const firstOfMonth = getFirstOfMonthET();
      const { start } = getUTCBoundariesForDate(firstOfMonth);
      return { start, end: now.toISOString() };
    }
    case "custom": {
      if (!startParam || !endParam)
        return {
          start: new Date(now.getTime() - 30 * 86400000).toISOString(),
          end: now.toISOString(),
        };
      const { start } = getUTCBoundariesForDate(startParam);
      // End of endParam day
      const endBounds = getUTCBoundariesForDate(endParam);
      return { start, end: endBounds.end };
    }
    default:
      return {
        start: new Date(now.getTime() - 30 * 86400000).toISOString(),
        end: now.toISOString(),
      };
  }
}

// ---------------------------------------------------------------------------
// Helper: count event occurrences
// ---------------------------------------------------------------------------

function countEvents(
  events: Array<{ event_name: string; event_data?: any }>,
  name: string
): number {
  return events.filter((e) => e.event_name === name).length;
}

function countReceiptEvents(
  events: Array<{ event_type: string }>,
  type: string
): number {
  return events.filter((e) => e.event_type === type).length;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Auth
  const authHeader = request.headers.get("authorization");
  const providedKey = authHeader?.replace("Bearer ", "");
  if (!ADMIN_KEY || providedKey !== ADMIN_KEY) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "last_30_days";
    const dateParam = searchParams.get("date");
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    // "humans" = only human + likely_human sessions (default); "all" = include bots/suspicious
    const filterMode = searchParams.get("filter") === "all" ? "all" : "humans";

    const window = getWindowBoundaries(period, dateParam, startParam, endParam);

    // -----------------------------------------------------------------------
    // Internal team exclusion lists
    // -----------------------------------------------------------------------
    const INTERNAL_VISITOR_IDS_FILTER = ["fp-uwi6gg", "fp-24bewu", "fp-airyss", "fp-kuhpy6", "fp-cviswk", "fp-vy4i", "fp-cpyu68"];
    const INTERNAL_USER_IDS_FILTER = [
      "a9e65037-00b3-443b-afba-5631e42b0505",
      "71ccca48-add0-4a47-b7b4-14985c923a78",
    ];

    // -----------------------------------------------------------------------
    // Pagination helper — works around Supabase PostgREST max_rows=1000 cap.
    // Fetches in 1000-row pages until an empty page is returned.
    // -----------------------------------------------------------------------
    async function fetchAllRows<T>(
      buildQuery: (from: number) => PromiseLike<{ data: T[] | null; error: unknown }>
    ): Promise<T[]> {
      const PAGE = 1000;
      const rows: T[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await buildQuery(from);
        if (error || !data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return rows;
    }

    // -----------------------------------------------------------------------
    // Parallel queries
    // -----------------------------------------------------------------------

    // 1. Receipts — paginated to bypass Supabase PostgREST max_rows=1000 cap.
    // IMPORTANT: use .or() to include NULL user_id rows (anonymous receipts).
    // .not("user_id", "in", [...]) silently excludes NULL rows in SQL because
    // NULL NOT IN (...) evaluates to NULL, not TRUE — so all anon receipts vanish.
    const receiptsPromise = fetchAllRows<Record<string, unknown>>((from) =>
      supabase
        .from("receipts")
        .select("id, created_at, output_json, url_domain, generation_status, page_source")
        .gte("created_at", window.start)
        .lt("created_at", window.end)
        .or(`user_id.is.null,user_id.not.in.(${INTERNAL_USER_IDS_FILTER.join(",")})`)
        .in("generation_status", ["lite", "full"])
        .range(from, from + 999)
    );

    // 2. Receipt events — paginated to bypass Supabase PostgREST max_rows=1000 cap
    const receiptEventsPromise = fetchAllRows<Record<string, unknown>>((from) =>
      supabase
        .from("receipt_events")
        .select("event_type, receipt_id, session_id, url_domain, verdict, created_at")
        .gte("created_at", window.start)
        .lt("created_at", window.end)
        .range(from, from + 999)
    );

    // 3. Reports (old EV-Risk)
    const reportsPromise = supabase
      .from("reports")
      .select(
        "id, status, customer_email, vehicle_year, vehicle_model, payload_json, created_at"
      )
      .gte("created_at", window.start)
      .lt("created_at", window.end)
      .or(`user_id.is.null,user_id.not.in.(${INTERNAL_USER_IDS_FILTER.join(",")})`);

    // 4. User events — paginated to bypass Supabase PostgREST max_rows=1000 cap.
    const userEventsPromise = fetchAllRows<Record<string, unknown>>((from) =>
      supabase
        .from("user_events")
        .select("event_name, event_data, visitor_id, session_id, ip_address, user_agent, timestamp")
        .gte("timestamp", window.start)
        .lt("timestamp", window.end)
        .eq("is_internal", false)
        .range(from, from + 999)
    );

    // 5. Visitors — paginated to bypass Supabase PostgREST max_rows=1000 cap.
    const visitorsPromise = fetchAllRows<Record<string, unknown>>((from) =>
      supabase
        .from("visitors")
        .select("visitor_id, page_path, visit_count, last_visit")
        .gte("last_visit", window.start)
        .lt("last_visit", window.end)
        .not("visitor_id", "in", `(${INTERNAL_VISITOR_IDS_FILTER.join(",")})`)
        .range(from, from + 999)
    );

    // 6. Report feedback
    const feedbackPromise = supabase
      .from("report_feedback")
      .select("rating, would_recommend, feedback_text, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 7. Recent events (last 50, no window filter — exclude internal team)
    const recentEventsPromise = supabase
      .from("user_events")
      .select("event_name, event_data, visitor_id, session_id, ip_address, user_agent, page_path, timestamp")
      .eq("is_internal", false)
      .order("timestamp", { ascending: false })
      .limit(50);

    // 8. Recent receipt events (last 50)
    const recentReceiptEventsPromise = supabase
      .from("receipt_events")
      .select(
        "event_type, receipt_id, session_id, url_domain, verdict, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    // 9. Purchases (Buyer Pass payments from Stripe)
    const purchasesPromise = supabase
      .from("purchases")
      .select("status, amount, currency, price_variant, scenario_type, pack_tier, stripe_session_id, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end)
      .or(`user_id.is.null,user_id.not.in.(${INTERNAL_USER_IDS_FILTER.join(",")})`);

    // 10. Garage vehicles — all-time count per user (authenticated users only)
    const garageUsersPromise = supabase
      .from("garage_vehicles")
      .select("user_id")
      .or(`user_id.is.null,user_id.not.in.(${INTERNAL_USER_IDS_FILTER.join(",")})`);

    // 11. Saved scenarios — all-time count per user (authenticated users only)
    const savedScenariosUsersPromise = supabase
      .from("saved_scenarios")
      .select("user_id")
      .or(`user_id.is.null,user_id.not.in.(${INTERNAL_USER_IDS_FILTER.join(",")})`);

    // 11b. EVFit completions — all-time, for high-intent segment (must not be windowed)
    const evfitCompletionsPromise = supabase
      .from("user_events")
      .select("user_id")
      .in("event_name", ["evfit_completed_server", "evfit_completed"])
      .not("user_id", "is", null)
      .or(`user_id.not.in.(${INTERNAL_USER_IDS_FILTER.join(",")})`);

    // 12. Extraction attempts — URL vs text success/failure breakdown
    const extractionAttemptsPromise = supabase
      .from("extraction_attempts")
      .select("input_mode, success, failure_reason, domain, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 13. Chat analytics — per-message pipeline metrics
    const chatAnalyticsPromise = supabase
      .from("chat_analytics")
      .select("session_id, scenario_type, query_type, model_used, latency_ms, user_engaged_with_tool, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 14. Chat messages — conversation counts (assistant only to avoid double-counting)
    const chatMessagesPromise = supabase
      .from("chat_messages")
      .select("session_id, scenario_type, role, latency_ms, sources_used, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 15. Auction analyses — all copart/auction evaluations
    const auctionAnalysesPromise = supabase
      .from("auction_analyses")
      .select("result_id, auction_source, lot_number, final_report, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    const [
      receipts,
      receiptEvents,
      { data: reports },
      userEvents,
      visitors,
      { data: feedback },
      { data: recentEvents },
      { data: recentReceiptEvents },
      { data: purchases },
      { data: garageUsers },
      { data: savedScenariosUsers },
      { data: evfitCompletions },
      { data: extractionAttempts },
      { data: chatAnalyticsRaw },
      { data: chatMessagesRaw },
      { data: auctionAnalyses },
    ] = await Promise.all([
      receiptsPromise,
      receiptEventsPromise,
      reportsPromise,
      userEventsPromise,
      visitorsPromise,
      feedbackPromise,
      recentEventsPromise,
      recentReceiptEventsPromise,
      purchasesPromise,
      garageUsersPromise,
      savedScenariosUsersPromise,
      evfitCompletionsPromise,
      extractionAttemptsPromise,
      chatAnalyticsPromise,
      chatMessagesPromise,
      auctionAnalysesPromise,
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allReceipts: any[] = receipts || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allReceiptEvents: any[] = receiptEvents || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allReports: any[] = reports || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allUserEvents: any[] = userEvents || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allVisitors: any[] = visitors || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allFeedback: any[] = feedback || [];

    // -----------------------------------------------------------------------
    // Session profiles + bot scoring (computed early so filter is available)
    // -----------------------------------------------------------------------

    const HUMAN_SIGNAL_EVENTS = ["page_visible_10s", "scroll_depth_25", "first_interaction"];
    const BOT_UA_PATTERNS = /bot|crawler|spider|headless|scraper|wget|curl|python-requests/i;

    interface SessionProfile {
      session_id: string;
      visitor_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
      event_count: number;
      event_names: Set<string>;
      first_event: string;
      last_event: string;
      duration_ms: number;
      human_signals: number;
      bot_score: number;
      actor_label: "human" | "likely_human" | "suspicious" | "likely_bot";
    }

    const sessionMap = new Map<string, {
      visitor_id: string | null;
      ip_address: string | null;
      user_agent: string | null;
      event_count: number;
      event_names: Set<string>;
      timestamps: number[];
    }>();

    for (const e of allUserEvents) {
      const sid = e.session_id || "unknown";
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, {
          visitor_id: typeof e.visitor_id === "string" ? e.visitor_id : null,
          ip_address: e.ip_address || null,
          user_agent: e.user_agent || null,
          event_count: 0,
          event_names: new Set(),
          timestamps: [],
        });
      }
      const s = sessionMap.get(sid)!;
      s.event_count++;
      if (typeof e.event_name === "string") s.event_names.add(e.event_name);
      s.timestamps.push(new Date(e.timestamp || "").getTime());
    }

    function computeBotScore(
      eventNames: Set<string>,
      durationMs: number,
      eventCount: number,
      userAgent: string | null
    ): number {
      let score = 50;
      if (eventNames.has("page_visible_10s")) score -= 15;
      if (eventNames.has("scroll_depth_25")) score -= 15;
      if (eventNames.has("first_interaction")) score -= 15;
      if (durationMs > 5000) score -= 10;
      if (eventNames.size >= 2) score -= 5;
      // Interaction-based human signals — bots don't submit forms, click, or complete funnels
      // High-confidence (form submits, checkout, completions): -20
      if (eventNames.has("email_capture_submitted")) score -= 20;
      if (eventNames.has("email_checklist_submit")) score -= 20;
      if (eventNames.has("checkout_started")) score -= 20;
      if (eventNames.has("feedback_submitted")) score -= 20;
      if (eventNames.has("evfit_completed")) score -= 20;
      if (eventNames.has("evfit_completed_server")) score -= 20;
      if (eventNames.has("routine_form_completed")) score -= 20;
      if (eventNames.has("compare_completed")) score -= 20;
      if (eventNames.has("why_checkpoint_submitted")) score -= 20;
      // Medium-confidence (intentional clicks, starts): -15
      if (eventNames.has("scenario_save_clicked")) score -= 15;
      if (eventNames.has("receipt_generate_clicked")) score -= 15;
      if (eventNames.has("receipt_extract_clicked")) score -= 15;
      if (eventNames.has("compare_started")) score -= 15;
      if (eventNames.has("routine_check_started")) score -= 15;
      if (eventNames.has("evfit_session_created")) score -= 15;
      if (eventNames.has("copy_checklist")) score -= 15;
      if (eventNames.has("copy_reddit_draft")) score -= 15;
      if (eventNames.has("copy_seller_message")) score -= 15;
      if (eventNames.has("negotiator_copy_clicked")) score -= 15;
      if (eventNames.has("shortlist_saved")) score -= 15;
      if (eventNames.has("download_pdf_clicked")) score -= 15;
      if (eventNames.has("share_qr_clicked")) score -= 15;
      if (eventNames.has("share_link_copied")) score -= 15;
      if (eventNames.has("recall_check_clicked")) score -= 15;
      if (eventNames.has("vin_entered")) score -= 15;
      // Mild-confidence (views, renders): -5
      if (eventNames.has("receipt_result_viewed")) score -= 5;
      if (eventNames.has("email_capture_shown")) score -= 5;
      if (eventNames.has("buyer_pass_teaser_shown")) score -= 5;
      if (eventNames.has("paywall_shown")) score -= 5;
      if (eventNames.has("routine_result_viewed")) score -= 5;
      if (eventNames.has("receipt_lite_shown")) score -= 5;
      if (userAgent && BOT_UA_PATTERNS.test(userAgent)) score += 40;
      if (!userAgent) score += 20;
      if (eventCount === 1) score += 10;
      if (durationMs === 0 && eventCount > 1) score += 15;
      return Math.max(0, Math.min(100, score));
    }

    function getActorLabel(score: number): "human" | "likely_human" | "suspicious" | "likely_bot" {
      if (score <= 25) return "human";
      if (score <= 50) return "likely_human";
      if (score <= 75) return "suspicious";
      return "likely_bot";
    }

    const sessionProfiles: SessionProfile[] = [];
    for (const [sid, s] of sessionMap) {
      const sorted = s.timestamps.sort((a, b) => a - b);
      const first = sorted[0] || 0;
      const last = sorted[sorted.length - 1] || 0;
      const durationMs = last - first;
      const humanSignals = HUMAN_SIGNAL_EVENTS.filter((e) => s.event_names.has(e)).length;
      const botScore = computeBotScore(s.event_names, durationMs, s.event_count, s.user_agent);
      sessionProfiles.push({
        session_id: sid,
        visitor_id: s.visitor_id,
        ip_address: s.ip_address,
        user_agent: s.user_agent,
        event_count: s.event_count,
        event_names: s.event_names,
        first_event: new Date(first).toISOString(),
        last_event: new Date(last).toISOString(),
        duration_ms: durationMs,
        human_signals: humanSignals,
        bot_score: botScore,
        actor_label: getActorLabel(botScore),
      });
    }

    // Apply bot filter: human-only by default, all with ?filter=all
    const humanSessionIds = filterMode === "humans"
      ? new Set(
          sessionProfiles
            .filter((p) => p.actor_label === "human" || p.actor_label === "likely_human")
            .map((p) => p.session_id)
        )
      : null;

    const filteredUserEvents = humanSessionIds
      ? allUserEvents.filter((e) => humanSessionIds.has((e as any).session_id || "unknown"))
      : allUserEvents;

    // -----------------------------------------------------------------------
    // Overview
    // -----------------------------------------------------------------------

    const paidReports = allReports.filter((r) => r.status === "paid");
    const freeReports = allReports.filter((r) => r.status === "free");
    const uniqueEmails = new Set(
      paidReports
        .filter((r) => r.customer_email)
        .map((r) => r.customer_email)
    );
    // Count unique sessions from user_events (reliable) instead of receipt_events (sparse)
    const RECEIPT_SESSION_EVENTS = new Set([
      "receipt_generate", "receipt_extract_clicked", "receipt_extract_succeeded",
      "receipt_extract_failed", "receipt_result_viewed", "receipt_generate_clicked",
    ]);
    const uniqueReceiptSessions = new Set(
      filteredUserEvents
        .filter((e) => RECEIPT_SESSION_EVENTS.has(e.event_name) && e.session_id)
        .map((e) => e.session_id)
    );

    const overview = {
      total_receipts: allReceipts.length,
      total_reports: allReports.length,
      free_reports: freeReports.length,
      paid_reports: paidReports.length,
      unique_sessions: uniqueReceiptSessions.size,
      unique_customers_by_email: uniqueEmails.size,
    };

    // -----------------------------------------------------------------------
    // Revenue (from purchases table — real Stripe payments only)
    // -----------------------------------------------------------------------

    const allPurchases = purchases || [];
    const paidPurchases = allPurchases.filter((p) => p.status === "paid");
    const pendingPurchases = allPurchases.filter((p) => p.status === "pending");
    const failedPurchases = allPurchases.filter((p) => p.status === "failed");
    const refundedPurchases = allPurchases.filter((p) => p.status === "refunded");

    // Break down by product type
    const receiptPurchases   = paidPurchases.filter((p) => p.scenario_type === "receipt");
    const buyerPassPurchases = paidPurchases.filter((p) => p.scenario_type === "buyer_pass");
    const copartPurchases    = paidPurchases.filter((p) => p.scenario_type === "copart_report");
    const routinePurchases   = paidPurchases.filter((p) => p.scenario_type === "evroutine" || p.scenario_type === "routine");
    const chatPurchases      = paidPurchases.filter((p) => p.scenario_type === "chat");

    const toUSD = (rows: typeof paidPurchases) => rows.reduce((s, p) => s + (p.amount || 0), 0) / 100;

    const receiptRevenue   = toUSD(receiptPurchases);
    const buyerPassRevenue = toUSD(buyerPassPurchases);
    const copartRevenue    = toUSD(copartPurchases);
    const routineRevenue   = toUSD(routinePurchases);
    const chatRevenue      = toUSD(chatPurchases);
    const legacyReportRevenue = paidReports.length * 15;
    const totalRevenue = receiptRevenue + buyerPassRevenue + copartRevenue + routineRevenue + chatRevenue + legacyReportRevenue;

    // Projections — based on window length and current paid conversion rate
    const windowDays = Math.max(1, Math.round(
      (new Date(window.end).getTime() - new Date(window.start).getTime()) / 86_400_000
    ));
    const humanSessions = Math.max(1, sessionProfiles.filter((p) => p.actor_label === "human" || p.actor_label === "likely_human").length);
    const revenuePerDay = totalRevenue / windowDays;
    const receiptConversionRate = allReceipts.length > 0
      ? (paidPurchases.length / allReceipts.length) * 100
      : 0;

    // Potential revenue: use actual receipt→paid conversion rate when available,
    // fall back to 3% floor if there's no real data yet.
    const humanSessionsPerDay = humanSessions / windowDays;
    const projectedReceiptsPerDay = humanSessionsPerDay * 0.05;
    const actualConversionRate = receiptConversionRate > 0 ? receiptConversionRate / 100 : 0.03;
    const projectedPaidPerDay = projectedReceiptsPerDay * actualConversionRate;
    const projectedRevenuePerDay = projectedPaidPerDay * 3.99;

    const revenue = {
      total_revenue: totalRevenue,
      total_transactions: paidPurchases.length,
      pending: pendingPurchases.length,
      pending_list: pendingPurchases.map((p) => ({
        stripe_session_id: (p as any).stripe_session_id as string | null,
        scenario_type: (p as any).scenario_type as string,
        pack_tier: (p as any).pack_tier as string | null,
        amount: (p as any).amount as number,
        created_at: (p as any).created_at as string,
      })),
      failed: failedPurchases.length,
      refunded: refundedPurchases.length,
      by_product: {
        receipt_single:  { count: receiptPurchases.length,   revenue: receiptRevenue,   price: 3.99 },
        buyer_pass:      { count: buyerPassPurchases.length, revenue: buyerPassRevenue, price: 9.99 },
        copart_report:   { count: copartPurchases.length,    revenue: copartRevenue,    price: 49.00 },
        routine:         { count: routinePurchases.length,   revenue: routineRevenue,   price: 4.99 },
        chat:            { count: chatPurchases.length,      revenue: chatRevenue,      price: 9.99 },
        legacy_reports:  { count: paidReports.length,        revenue: legacyReportRevenue, price: 15.00 },
      },
      actual: {
        revenue_per_day: Math.round(revenuePerDay * 100) / 100,
        revenue_per_week: Math.round(revenuePerDay * 7 * 100) / 100,
        revenue_per_month: Math.round(revenuePerDay * 30 * 100) / 100,
        conversion_rate_pct: Math.round(receiptConversionRate * 10) / 10,
        window_days: windowDays,
      },
      potential: {
        // Based on current human session volume with conservative 5% receipt reach, 3% paywall conversion
        human_sessions_per_day: Math.round(humanSessionsPerDay * 10) / 10,
        projected_receipts_per_day: Math.round(projectedReceiptsPerDay * 10) / 10,
        projected_paid_per_day: Math.round(projectedPaidPerDay * 10) / 10,
        projected_revenue_per_day: Math.round(projectedRevenuePerDay * 100) / 100,
        projected_revenue_per_week: Math.round(projectedRevenuePerDay * 7 * 100) / 100,
        projected_revenue_per_month: Math.round(projectedRevenuePerDay * 30 * 100) / 100,
        assumptions: `5% of human sessions reach receipt · ${Math.round(actualConversionRate * 1000) / 10}% paywall conversion (${receiptConversionRate > 0 ? "actual" : "estimated"}) · $3.99 avg ticket`,
        upside_scenario: {
          // 15% reach, 2× actual conversion — achievable with Reddit traffic + good copy
          projected_revenue_per_day: Math.round(humanSessionsPerDay * 0.15 * Math.min(actualConversionRate * 2, 0.20) * 3.99 * 100) / 100,
          projected_revenue_per_week: Math.round(humanSessionsPerDay * 0.15 * Math.min(actualConversionRate * 2, 0.20) * 3.99 * 7 * 100) / 100,
          projected_revenue_per_month: Math.round(humanSessionsPerDay * 0.15 * Math.min(actualConversionRate * 2, 0.20) * 3.99 * 30 * 100) / 100,
          assumptions: `15% receipt reach · ${Math.round(Math.min(actualConversionRate * 2, 0.20) * 1000) / 10}% conversion (2× actual, capped 20%) · $3.99 avg ticket`,
        },
      },
    };

    // -----------------------------------------------------------------------
    // Receipt funnel (from receipt_events + user_events)
    // -----------------------------------------------------------------------

    const fetchSuccesses = countReceiptEvents(allReceiptEvents, "fetch_success");
    const fetchFailures = countReceiptEvents(allReceiptEvents, "fetch_fail");
    const receiptScrapeAttempts = fetchSuccesses + fetchFailures;

    // DB rows (receipts table) are the authoritative count.
    // receipt_events.generate and user_events.receipt_generate are secondary signals:
    //   - receipt_events has no bot filter, so it can be higher than real human receipts
    //   - user_events is bot-filtered but may undercount (ad blockers, JS errors)
    // Using Math.max across these sources produced impossible results (e.g. single-day
    // count > month-to-date count) because different bot-filtering was applied to each.
    const receiptsGenFromDB = allReceipts.length;
    // Keep secondary counts available for debugging/comparison only
    const receiptsGenFromUserEvents = countEvents(filteredUserEvents, "receipt_generate");
    const receiptsGenFromReceiptEvents = countReceiptEvents(allReceiptEvents, "generate");

    const entrySourceBreakdown = allReceipts.reduce((acc, r) => {
      const src = ((r as any).page_source as string) || "unknown";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const receipt_pipeline = {
      url_scrape_attempts: receiptScrapeAttempts,
      url_scrape_successes: fetchSuccesses,
      url_scrape_failures: fetchFailures,
      url_scrape_success_rate:
        receiptScrapeAttempts > 0
          ? Math.round((fetchSuccesses / receiptScrapeAttempts) * 1000) / 10
          : 0,
      // Use DB row count as single source of truth — avoids overcounting from event dedup mismatches
      receipts_generated: receiptsGenFromDB,
      // Secondary counts for debugging; not surfaced in the main metric
      receipts_generated_user_events: receiptsGenFromUserEvents,
      receipts_generated_receipt_events: receiptsGenFromReceiptEvents,
      lint_failures: Math.max(
        countReceiptEvents(allReceiptEvents, "lint_fail"),
        countEvents(filteredUserEvents, "receipt_lint_failed")
      ),
      regens: Math.max(
        countReceiptEvents(allReceiptEvents, "regen"),
        countEvents(filteredUserEvents, "receipt_regen")
      ),
      copies: Math.max(
        countReceiptEvents(allReceiptEvents, "copy"),
        countEvents(filteredUserEvents, "copy_checklist") +
        countEvents(filteredUserEvents, "copy_reddit_draft") +
        countEvents(filteredUserEvents, "copy_seller_message") +
        countEvents(filteredUserEvents, "negotiator_copy_clicked")
      ),
      copies_legacy: countReceiptEvents(allReceiptEvents, "copy"),
      copy_reddit_draft: countEvents(filteredUserEvents, "copy_reddit_draft"),
      copy_seller_message: countEvents(filteredUserEvents, "copy_seller_message"),
      copy_checklist: countEvents(filteredUserEvents, "copy_checklist"),
      negotiator_copy: countEvents(filteredUserEvents, "negotiator_copy_clicked"),
      lint_failed_fallback_served: countEvents(filteredUserEvents, "lint_failed_fallback_served"),
      // Progressive receipt metrics
      receipt_lite_shown: countEvents(filteredUserEvents, "receipt_lite_shown"),
      receipt_full_ready: countEvents(filteredUserEvents, "receipt_full_ready"),
      receipt_upgrade_failed: countEvents(filteredUserEvents, "receipt_upgrade_failed"),
      // Failure mode breakdown (from receipt_events)
      upgrade_timeout: countReceiptEvents(allReceiptEvents, "upgrade_timeout"),
      upgrade_fail: countReceiptEvents(allReceiptEvents, "upgrade_fail"),
      upgrade_exception: countReceiptEvents(allReceiptEvents, "upgrade_exception"),
      upgrade_schema_fail: countReceiptEvents(allReceiptEvents, "schema_fail"),
      entry_source_breakdown: entrySourceBreakdown,
    };

    // -----------------------------------------------------------------------
    // Report funnel (EV-Risk, from user_events)
    // Includes both legacy (report_generation_*) and V2 (v2_score_submit) events
    // -----------------------------------------------------------------------

    const formSubmissions = countEvents(filteredUserEvents, "form_submit");
    const reportGenStartedLegacy = countEvents(
      filteredUserEvents,
      "report_generation_started"
    );
    const v2ScoreSubmit = countEvents(filteredUserEvents, "v2_score_submit");
    const reportGenStarted = reportGenStartedLegacy + v2ScoreSubmit;

    const reportGenSucceededLegacy = countEvents(
      filteredUserEvents,
      "report_generation_succeeded"
    );
    const reportGenSucceededServer = countEvents(
      filteredUserEvents,
      "report_generated_success"
    );
    const reportGenSucceeded = reportGenSucceededLegacy + reportGenSucceededServer;

    const reportGenFailedLegacy = countEvents(
      filteredUserEvents,
      "report_generation_failed"
    );
    const reportGenFailedServer = countEvents(
      filteredUserEvents,
      "report_generated_failed"
    );
    const reportGenFailed = reportGenFailedLegacy + reportGenFailedServer;

    const report_funnel = {
      form_submissions: formSubmissions,
      intake_submitted: countEvents(filteredUserEvents, "intake_submitted"),
      v2_score_submit: v2ScoreSubmit,
      report_gen_started: reportGenStarted,
      report_gen_succeeded: reportGenSucceeded,
      report_gen_failed: reportGenFailed,
      success_rate:
        reportGenStarted > 0
          ? Math.round((reportGenSucceeded / reportGenStarted) * 100)
          : 0,
    };

    // -----------------------------------------------------------------------
    // Visitors
    // -----------------------------------------------------------------------

    const uniqueVisitorIds = new Set(allVisitors.map((v) => v.visitor_id));
    // Count rows in the window (not all-time visit_count) — visit_count is a cumulative
    // all-time counter per visitor+page, which overcounts when summed for a date window.
    const totalVisits = allVisitors.length;

    // Top pages
    const pageMap = new Map<
      string,
      { views: number; visitors: Set<string> }
    >();
    for (const v of allVisitors) {
      const path = v.page_path || "/";
      if (!pageMap.has(path)) {
        pageMap.set(path, { views: 0, visitors: new Set() });
      }
      const entry = pageMap.get(path)!;
      entry.views += 1; // count rows in window, not all-time visit_count
      entry.visitors.add(v.visitor_id);
    }
    const topPages = Array.from(pageMap.entries())
      .map(([page_path, { views, visitors: vs }]) => ({
        page_path,
        view_count: views,
        unique_visitors: vs.size,
      }))
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, 10);

    const visitorsSection = {
      total_visits: totalVisits,
      unique_visitors: uniqueVisitorIds.size,
      top_pages: topPages,
    };

    // -----------------------------------------------------------------------
    // Why checkpoint (from user_events)
    // -----------------------------------------------------------------------

    const whyShown = countEvents(filteredUserEvents, "why_checkpoint_shown");
    const whySubmitted = countEvents(filteredUserEvents, "why_checkpoint_submitted");
    const whySkipped = countEvents(filteredUserEvents, "why_checkpoint_skipped");

    const why_checkpoint = {
      shown: whyShown,
      submitted: whySubmitted,
      skipped: whySkipped,
      submit_rate:
        whyShown > 0 ? Math.round((whySubmitted / whyShown) * 1000) / 10 : 0,
    };

    // -----------------------------------------------------------------------
    // Feedback
    // -----------------------------------------------------------------------

    const avgRating =
      allFeedback.length > 0
        ? Math.round(
            (allFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) /
              allFeedback.length) *
              100
          ) / 100
        : 0;
    const wouldRecommend = allFeedback.filter(
      (f) => f.would_recommend === true
    ).length;
    const totalWithRec = allFeedback.filter(
      (f) => f.would_recommend !== null
    ).length;

    const ratingDist = new Map<number, number>();
    for (const f of allFeedback) {
      if (f.rating != null) {
        ratingDist.set(f.rating, (ratingDist.get(f.rating) || 0) + 1);
      }
    }

    const feedbackSection = {
      total_feedback: allFeedback.length,
      avg_rating: avgRating,
      recommendation_rate:
        totalWithRec > 0
          ? Math.round((wouldRecommend / totalWithRec) * 1000) / 10
          : 0,
      rating_distribution: Array.from(ratingDist.entries())
        .map(([rating, count]) => ({ rating, count }))
        .sort((a, b) => b.rating - a.rating),
    };

    // -----------------------------------------------------------------------
    // Auction / Copart metrics
    // -----------------------------------------------------------------------

    const allAuctions = auctionAnalyses || [];

    // Grade distribution
    const auctionGradeDist: Record<string, number> = { green: 0, yellow: 0, red: 0, unknown: 0 };
    // Source breakdown
    const auctionSourceDist: Record<string, number> = {};
    // Provider (how data was fetched: copart_api, apify, copart_url_slug)
    const auctionProviderDist: Record<string, number> = {};
    // Daily trend
    const auctionDailyMap = new Map<string, number>();

    for (const a of allAuctions) {
      const report = a.final_report as Record<string, unknown> | null;
      const salvageRisk = report?.salvage_risk as Record<string, unknown> | null;
      const grade = (salvageRisk?.grade as string) ?? "unknown";
      auctionGradeDist[grade] = (auctionGradeDist[grade] ?? 0) + 1;

      const src = a.auction_source ?? "unknown";
      auctionSourceDist[src] = (auctionSourceDist[src] ?? 0) + 1;

      const date = a.created_at?.split("T")[0];
      if (date) auctionDailyMap.set(date, (auctionDailyMap.get(date) ?? 0) + 1);
    }

    const auctionDailyTrend = Array.from(auctionDailyMap.entries())
      .map(([date, count]) => ({ date, analyses: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Event-based metrics from user_events
    const auctionResultViews = countEvents(filteredUserEvents, "auction_result_viewed");
    const auctionPdfDownloads = countEvents(filteredUserEvents, "auction_pdf_downloaded");
    const auctionEmailSent = countEvents(filteredUserEvents, "auction_report_email_sent");
    const auctionEmailFailed = countEvents(filteredUserEvents, "auction_report_email_failed");
    const auctionShared = countEvents(filteredUserEvents, "auction_report_shared");

    // Cached vs fresh
    const auctionCachedEvents = filteredUserEvents.filter(
      (e) => e.event_name === "copart_analyze_completed" && e.event_data?.cached === true
    ).length;
    const auctionFreshEvents = filteredUserEvents.filter(
      (e) => e.event_name === "copart_analyze_completed" && e.event_data?.cached === false
    ).length;

    // Average latency from completed events
    const completedLatencies = filteredUserEvents
      .filter((e) => e.event_name === "copart_analyze_completed" && typeof e.event_data?.latency_ms === "number")
      .map((e) => e.event_data.latency_ms as number);
    const auctionAvgLatencyMs = completedLatencies.length
      ? Math.round(completedLatencies.reduce((s, v) => s + v, 0) / completedLatencies.length)
      : null;

    const auction_metrics = {
      total_analyses: allAuctions.length,
      grade_distribution: auctionGradeDist,
      source_distribution: auctionSourceDist,
      daily_trend: auctionDailyTrend,
      result_views: auctionResultViews,
      pdf_downloads: auctionPdfDownloads,
      email_sent: auctionEmailSent,
      email_failed: auctionEmailFailed,
      shared: auctionShared,
      cached_hits: auctionCachedEvents,
      fresh_analyses: auctionFreshEvents,
      avg_latency_ms: auctionAvgLatencyMs,
    };

    // -----------------------------------------------------------------------
    // Daily trend (receipt generates + report creates per day)
    // -----------------------------------------------------------------------

    const dailyMap = new Map<
      string,
      { receipts: number; reports_free: number; reports_paid: number }
    >();

    // Receipt generates from receipts table (ground truth, not event-based).
    // Use ET date (not raw UTC split) so daily buckets align with the ET window boundaries.
    for (const r of allReceipts) {
      const date = r.created_at ? utcToETDate(r.created_at) : "unknown";
      if (!dailyMap.has(date))
        dailyMap.set(date, { receipts: 0, reports_free: 0, reports_paid: 0 });
      dailyMap.get(date)!.receipts++;
    }

    // Reports from reports table — also use ET date
    for (const r of allReports) {
      const date = r.created_at ? utcToETDate(r.created_at) : "unknown";
      if (!dailyMap.has(date))
        dailyMap.set(date, { receipts: 0, reports_free: 0, reports_paid: 0 });
      if (r.status === "paid") dailyMap.get(date)!.reports_paid++;
      else dailyMap.get(date)!.reports_free++;
    }

    const daily_trend = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // -----------------------------------------------------------------------
    // Daily visitors trend (unique visitor_ids + total events per day)
    // -----------------------------------------------------------------------

    const dailyVisitorMap = new Map<string, { unique_visitors: Set<string>; total_visits: number }>();
    for (const e of filteredUserEvents) {
      const ts = (e as any).timestamp;
      const date = ts ? utcToETDate(ts) : null;
      if (!date) continue;
      if (!dailyVisitorMap.has(date)) dailyVisitorMap.set(date, { unique_visitors: new Set(), total_visits: 0 });
      const entry = dailyVisitorMap.get(date)!;
      if ((e as any).visitor_id) entry.unique_visitors.add((e as any).visitor_id);
      entry.total_visits++;
    }
    const daily_visitors = Array.from(dailyVisitorMap.entries())
      .map(([date, { unique_visitors, total_visits }]) => ({
        date,
        unique_visitors: unique_visitors.size,
        total_visits,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // -----------------------------------------------------------------------
    // Top vehicles (from reports + receipts output_json)
    // -----------------------------------------------------------------------

    const vehicleMap = new Map<
      string,
      {
        model: string;
        year: number | null;
        total: number;
        paid: number;
        free: number;
      }
    >();

    for (const r of allReports) {
      if (!r.vehicle_model) continue;
      const key = `${r.vehicle_model}|${r.vehicle_year}`;
      if (!vehicleMap.has(key)) {
        vehicleMap.set(key, {
          model: r.vehicle_model,
          year: r.vehicle_year,
          total: 0,
          paid: 0,
          free: 0,
        });
      }
      const entry = vehicleMap.get(key)!;
      entry.total++;
      if (r.status === "paid") entry.paid++;
      if (r.status === "free") entry.free++;
    }

    // Add receipt vehicles (from output_json if available)
    for (const receipt of allReceipts) {
      const output = receipt.output_json;
      if (!output) continue;
      const model =
        output.vehicle?.model || output.make_model || output.model;
      const year = output.vehicle?.year || output.year;
      if (!model) continue;
      const key = `${model}|${year || ""}`;
      if (!vehicleMap.has(key)) {
        vehicleMap.set(key, {
          model,
          year: year || null,
          total: 0,
          paid: 0,
          free: 0,
        });
      }
      vehicleMap.get(key)!.total++;
    }

    const top_vehicles = Array.from(vehicleMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map((v) => ({
        model: v.model,
        year: v.year,
        total_count: v.total,
        paid_count: v.paid,
        free_count: v.free,
      }));

    // -----------------------------------------------------------------------
    // Scenario saves (from user_events)
    // -----------------------------------------------------------------------

    const scenario_saves = {
      clicked: countEvents(filteredUserEvents, "scenario_save_clicked"),
      succeeded: countEvents(filteredUserEvents, "scenario_save_success"),
    };

    // -----------------------------------------------------------------------
    // Saved listings (from saved_scenarios table)
    // -----------------------------------------------------------------------

    let saved_listings = {
      total: 0,
      unique_users: 0,
      by_type: { receipt: 0, evroutine: 0 },
      top_savers: [] as { user_id: string; count: number; latest_vehicle: string }[],
    };

    try {
      const { data: savedRows } = await supabase
        .from("saved_scenarios")
        .select("user_id, scenario_type, vehicle_model, vehicle_year, saved_at")
        .gte("saved_at", window.start)
        .lte("saved_at", window.end)
        .not("user_id", "in", `(${INTERNAL_USER_IDS_FILTER.join(",")})`);

      if (savedRows && savedRows.length > 0) {
        const userSaves = new Map<string, { count: number; latest_vehicle: string; latest_at: string }>();
        for (const r of savedRows) {
          const existing = userSaves.get(r.user_id);
          const vehicle = [r.vehicle_year, r.vehicle_model].filter(Boolean).join(" ") || "Unknown";
          if (existing) {
            existing.count++;
            if (r.saved_at > existing.latest_at) {
              existing.latest_vehicle = vehicle;
              existing.latest_at = r.saved_at;
            }
          } else {
            userSaves.set(r.user_id, { count: 1, latest_vehicle: vehicle, latest_at: r.saved_at });
          }
        }

        saved_listings = {
          total: savedRows.length,
          unique_users: userSaves.size,
          by_type: {
            receipt: savedRows.filter((r) => r.scenario_type === "receipt").length,
            evroutine: savedRows.filter((r) => r.scenario_type === "evroutine").length,
          },
          top_savers: Array.from(userSaves.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([uid, info]) => ({
              user_id: uid.substring(0, 8),
              count: info.count,
              latest_vehicle: info.latest_vehicle,
            })),
        };
      }
    } catch {
      // Non-critical — dashboard still works without this section
    }

    // -----------------------------------------------------------------------
    // Email captures (from user_events)
    // -----------------------------------------------------------------------

    // Count both event names: receipt page fires "email_checklist_submit",
    // EmailCaptureCard fires "email_capture_submitted" — both mean "user submitted email"
    const email_captures = {
      submitted: countEvents(filteredUserEvents, "email_checklist_submit") +
                 countEvents(filteredUserEvents, "email_capture_submitted"),
      sent: countEvents(filteredUserEvents, "email_checklist_sent"),
      failed: countEvents(filteredUserEvents, "email_checklist_failed"),
      // Auth-flow email events (magic link login via LoginModal + auth callback)
      auth_email_entered: countEvents(filteredUserEvents, "email_entry_submitted"),
      auth_email_confirmed: countEvents(filteredUserEvents, "email_confirmed"),
    };

    // -----------------------------------------------------------------------
    // Post-receipt engagement funnel (from user_events)
    // -----------------------------------------------------------------------

    const receiptViewed = countEvents(filteredUserEvents, "receipt_result_viewed");

    // Copy engagement (use max of legacy receipt_events + granular user_events)
    const copyChecklist = countEvents(filteredUserEvents, "copy_checklist");
    const copyRedditDraft = countEvents(filteredUserEvents, "copy_reddit_draft");
    const copySellerMessage = countEvents(filteredUserEvents, "copy_seller_message");
    const negotiatorShown = countEvents(filteredUserEvents, "negotiator_shown");
    const negotiatorCopyClicked = countEvents(filteredUserEvents, "negotiator_copy_clicked");
    const granularCopyTotal = copyChecklist + copyRedditDraft + copySellerMessage + negotiatorCopyClicked;
    const legacyCopyTotal = countReceiptEvents(allReceiptEvents, "copy");
    const totalCopyActions = Math.max(granularCopyTotal, legacyCopyTotal);

    // Share engagement
    const shareQrClicked = countEvents(filteredUserEvents, "share_qr_clicked");
    const shareModalOpened = countEvents(filteredUserEvents, "share_modal_opened");
    const shareLinkCopied = countEvents(filteredUserEvents, "share_link_copied");
    const shareCardDownloaded = countEvents(filteredUserEvents, "share_card_downloaded");

    // Email capture (use both event names)
    const emailCaptureShown = countEvents(filteredUserEvents, "email_capture_shown");
    const emailCaptureSubmitted = countEvents(filteredUserEvents, "email_capture_submitted") +
                                  countEvents(filteredUserEvents, "email_checklist_submit");

    // Save
    const saveClicked = countEvents(filteredUserEvents, "scenario_save_clicked");
    const saveSucceeded = countEvents(filteredUserEvents, "scenario_save_success");

    // PDF
    const downloadPdfClicked = countEvents(filteredUserEvents, "download_pdf_clicked");

    // VIN check
    const vinEntered = countEvents(filteredUserEvents, "vin_entered");
    const vinDecodeSucceeded = countEvents(filteredUserEvents, "vin_decode_succeeded");
    const vinDecodeFailed = countEvents(filteredUserEvents, "vin_decode_failed");
    const recallCheckClicked = countEvents(filteredUserEvents, "recall_check_clicked");

    // Paywall / monetization
    const buyerPassTeaserShown = countEvents(filteredUserEvents, "buyer_pass_teaser_shown");
    const paywallShown = countEvents(filteredUserEvents, "paywall_shown");
    const paywallDismissed = countEvents(filteredUserEvents, "paywall_dismissed");
    const checkoutStarted = countEvents(filteredUserEvents, "checkout_started");

    // Feedback
    const feedbackShown = countEvents(filteredUserEvents, "feedback_shown");
    const feedbackSubmitted = countEvents(filteredUserEvents, "feedback_submitted");

    // Other post-receipt
    const contactClickPostReceipt = countEvents(filteredUserEvents, "contact_click_post_receipt");
    const receiptHistoryViewed = countEvents(filteredUserEvents, "receipt_history_viewed");

    // Helper: percentage of receipt viewers
    const pctOf = (n: number) =>
      receiptViewed > 0 ? Math.round((n / receiptViewed) * 1000) / 10 : 0;

    const post_receipt_engagement = {
      receipt_result_viewed: receiptViewed,

      copy: {
        checklist: copyChecklist,
        reddit_draft: copyRedditDraft,
        seller_message: copySellerMessage,
        negotiator_shown: negotiatorShown,
        negotiator_copy: negotiatorCopyClicked,
        total: totalCopyActions,
        pct_of_viewers: pctOf(totalCopyActions),
      },

      share: {
        qr_clicked: shareQrClicked,
        modal_opened: shareModalOpened,
        link_copied: shareLinkCopied,
        card_downloaded: shareCardDownloaded,
        pct_initiated: pctOf(shareQrClicked),
      },

      email: {
        shown: emailCaptureShown,
        submitted: emailCaptureSubmitted,
        auth_entered: countEvents(filteredUserEvents, "email_entry_submitted"),
        auth_confirmed: countEvents(filteredUserEvents, "email_confirmed"),
        submit_rate: emailCaptureShown > 0
          ? Math.round((emailCaptureSubmitted / emailCaptureShown) * 1000) / 10
          : 0,
        pct_of_viewers: pctOf(emailCaptureSubmitted),
      },

      save: {
        clicked: saveClicked,
        succeeded: saveSucceeded,
        pct_saved: pctOf(saveSucceeded),
      },

      pdf: {
        download_clicked: downloadPdfClicked,
        pct_downloaded: pctOf(downloadPdfClicked),
      },

      vin_check: {
        entered: vinEntered,
        decode_succeeded: vinDecodeSucceeded,
        decode_failed: vinDecodeFailed,
        recall_clicked: recallCheckClicked,
        pct_used: pctOf(vinEntered),
      },

      monetization: {
        teaser_shown: buyerPassTeaserShown,
        paywall_shown: paywallShown,
        paywall_dismissed: paywallDismissed,
        checkout_started: checkoutStarted,
        teaser_to_paywall_rate: buyerPassTeaserShown > 0
          ? Math.round((paywallShown / buyerPassTeaserShown) * 1000) / 10
          : 0,
        paywall_to_checkout_rate: paywallShown > 0
          ? Math.round((checkoutStarted / paywallShown) * 1000) / 10
          : 0,
      },

      feedback: {
        shown: feedbackShown,
        submitted: feedbackSubmitted,
        submit_rate: feedbackShown > 0
          ? Math.round((feedbackSubmitted / feedbackShown) * 1000) / 10
          : 0,
      },

      other: {
        contact_clicked: contactClickPostReceipt,
        history_viewed: receiptHistoryViewed,
        model_info_link_clicked: countEvents(filteredUserEvents, "model_info_link_clicked"),
      },
    };

    // -----------------------------------------------------------------------
    // Email deliveries (from email_checklist_deliveries table)
    // -----------------------------------------------------------------------

    let email_deliveries = {
      total: 0,
      sent: 0,
      failed: 0,
      success_rate: 0,
      unique_recipients: 0,
      by_type: { receipt: 0, evroutine: 0 },
    };

    try {
      const { data: emailRows } = await supabase
        .from("email_checklist_deliveries")
        .select("scenario_type, email_hash, delivery_status, created_at")
        .gte("created_at", window.start)
        .lte("created_at", window.end);

      if (emailRows && emailRows.length > 0) {
        const sentCount = emailRows.filter((r) => r.delivery_status === "sent").length;
        email_deliveries = {
          total: emailRows.length,
          sent: sentCount,
          failed: emailRows.filter((r) => r.delivery_status === "failed").length,
          success_rate: Math.round((sentCount / emailRows.length) * 1000) / 10,
          unique_recipients: new Set(emailRows.map((r) => r.email_hash)).size,
          by_type: {
            receipt: emailRows.filter((r) => r.scenario_type === "receipt").length,
            evroutine: emailRows.filter((r) => r.scenario_type === "evroutine").length,
          },
        };
      }
    } catch {
      // Non-critical
    }

    // -----------------------------------------------------------------------
    // Email list (checklist_email_captures — all-time + window growth)
    // -----------------------------------------------------------------------

    let email_list = {
      total_all_time: 0,
      new_in_window: 0,
      by_funnel_stage: {} as Record<string, number>,
      sequences_enrolled: 0,
      crm_sends_7d: 0,
      crm_sends_by_sequence: {} as Record<string, number>,
      suppressed: 0,
    };

    try {
      const [allTimeResult, windowResult, byStageResult, seqResult, crmSendsResult, suppressedResult] = await Promise.all([
        // All-time total
        supabase.from("checklist_email_captures").select("id", { count: "exact", head: true }),
        // New signups in window
        supabase.from("checklist_email_captures").select("id", { count: "exact", head: true })
          .gte("created_at", window.start).lte("created_at", window.end),
        // By funnel stage (all-time)
        supabase.from("checklist_email_captures").select("funnel_stage"),
        // Total enrolled in email_sequences
        supabase.from("email_sequences").select("id", { count: "exact", head: true }),
        // CRM sends last 7 days by sequence
        supabase.from("crm_email_sends").select("sequence_type").eq("status", "sent")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        // Suppressed (bounced or opted out)
        supabase.from("crm_email_preferences").select("id", { count: "exact", head: true })
          .or("all_marketing.eq.false,bounced.eq.true"),
      ]);

      const stageMap: Record<string, number> = {};
      for (const row of byStageResult.data ?? []) {
        const stage = (row.funnel_stage as string) || "unknown";
        stageMap[stage] = (stageMap[stage] ?? 0) + 1;
      }

      const sendsBySeq: Record<string, number> = {};
      for (const row of crmSendsResult.data ?? []) {
        const seq = row.sequence_type as string;
        sendsBySeq[seq] = (sendsBySeq[seq] ?? 0) + 1;
      }

      email_list = {
        total_all_time: allTimeResult.count ?? 0,
        new_in_window: windowResult.count ?? 0,
        by_funnel_stage: stageMap,
        sequences_enrolled: seqResult.count ?? 0,
        crm_sends_7d: crmSendsResult.data?.length ?? 0,
        crm_sends_by_sequence: sendsBySeq,
        suppressed: suppressedResult.count ?? 0,
      };
    } catch {
      // Non-critical
    }

    // -----------------------------------------------------------------------
    // Server-side receipt events (from user_events)
    // -----------------------------------------------------------------------

    const receiptExtractSuccess = countEvents(filteredUserEvents, "receipt_extract_succeeded");
    const receiptExtractFailed = countEvents(filteredUserEvents, "receipt_extract_failed");
    const receiptExtractFallback = countEvents(filteredUserEvents, "receipt_extract_fallback_used");
    const receiptExtractTotal = receiptExtractSuccess + receiptExtractFailed;

    const ai_generation = {
      succeeded: receiptExtractSuccess,
      failed: receiptExtractFailed,
      fallback_used: receiptExtractFallback,
      total: receiptExtractTotal,
      success_rate:
        receiptExtractTotal > 0
          ? Math.round((receiptExtractSuccess / receiptExtractTotal) * 1000) / 10
          : 0,
    };

    // -----------------------------------------------------------------------
    // Server-side report events (from user_events)
    // -----------------------------------------------------------------------

    const serverReportSuccess = countEvents(filteredUserEvents, "report_generated_success");
    const serverReportFailed = countEvents(filteredUserEvents, "report_generated_failed");
    const serverReportTotal = serverReportSuccess + serverReportFailed;

    const report_server_events = {
      generated_success: serverReportSuccess,
      generated_failed: serverReportFailed,
      generated_total: serverReportTotal,
      success_rate:
        serverReportTotal > 0
          ? Math.round((serverReportSuccess / serverReportTotal) * 1000) / 10
          : 0,
    };

    // -----------------------------------------------------------------------
    // Routine engagement (from user_events)
    // -----------------------------------------------------------------------

    const routineFieldEvents = filteredUserEvents.filter(
      (e) => e.event_name === "routine_field_completed"
    );
    const routineFieldMap = new Map<string, number>();
    for (const e of routineFieldEvents) {
      const fieldId = e.event_data?.field_id || "unknown";
      routineFieldMap.set(fieldId, (routineFieldMap.get(fieldId) || 0) + 1);
    }

    const routine_engagement = {
      total_field_completions: routineFieldEvents.length,
      fields: Array.from(routineFieldMap.entries())
        .map(([field_id, count]) => ({ field_id, count }))
        .sort((a, b) => b.count - a.count),
      check_started: countEvents(filteredUserEvents, "routine_check_started"),
      check_completed: countEvents(filteredUserEvents, "routine_check_completed"),
      score_viewed: countEvents(filteredUserEvents, "routine_score_viewed"),
      result_viewed: countEvents(filteredUserEvents, "routine_result_viewed"),
      // NEW: Comprehensive analytics (March 2026)
      form_completed: countEvents(filteredUserEvents, "routine_form_completed"),
      form_partial_abandon: countEvents(filteredUserEvents, "routine_form_partial_abandon"),
      vehicle_list_generated: countEvents(filteredUserEvents, "vehicle_list_generated"),
      vehicle_full_report_clicked: countEvents(filteredUserEvents, "vehicle_full_report_clicked"),
      external_link_clicked: countEvents(filteredUserEvents, "external_link_clicked"),
      offo_dealer_viewed: countEvents(filteredUserEvents, "offo_dealer_viewed"),
      offo_dealer_message_sent: countEvents(filteredUserEvents, "offo_dealer_message_sent"),
    };

    // -----------------------------------------------------------------------
    // EVFit funnel (backend server events)
    // -----------------------------------------------------------------------

    const evfitStarted = countEvents(filteredUserEvents, "evfit_session_created");
    const evfitCompleted = countEvents(filteredUserEvents, "evfit_completed_server") ||
                           countEvents(filteredUserEvents, "evfit_completed");
    const refineCompleted = countEvents(filteredUserEvents, "refine_completed");
    const shortlistSaved = countEvents(filteredUserEvents, "shortlist_saved");
    const compareStarted = countEvents(filteredUserEvents, "compare_started");
    const compareCompleted = countEvents(filteredUserEvents, "compare_completed");
    const listingSaved = countEvents(filteredUserEvents, "listing_saved");
    const garageCreated = countEvents(filteredUserEvents, "garage_created");
    const anonAttached = countEvents(filteredUserEvents, "anon_attached_to_user");
    const aiJobQueued = countEvents(filteredUserEvents, "ai_job_queued");
    const aiJobSucceeded = countEvents(filteredUserEvents, "ai_job_succeeded");
    const aiJobFailed = countEvents(filteredUserEvents, "ai_job_failed");

    const evfit_funnel = {
      evfit_started: evfitStarted,
      evfit_completed: evfitCompleted,
      completion_rate_pct: evfitStarted > 0 ? Math.round((evfitCompleted / evfitStarted) * 100) : 0,
      refine_completed: refineCompleted,
      with_refine_pct: evfitCompleted > 0 ? Math.round((refineCompleted / evfitCompleted) * 100) : 0,
      shortlist_saved: shortlistSaved,
      with_shortlist_pct: evfitCompleted > 0 ? Math.round((shortlistSaved / evfitCompleted) * 100) : 0,
      compare_started: compareStarted,
      compare_completed: compareCompleted,
      compare_start_to_finish_pct: compareStarted > 0 ? Math.round((compareCompleted / compareStarted) * 100) : 0,
      with_compare_pct: evfitCompleted > 0 ? Math.round((compareCompleted / evfitCompleted) * 100) : 0,
      listing_saved: listingSaved,
      garage_created: garageCreated,
      anon_attached: anonAttached,
      ai_job_queued: aiJobQueued,
      ai_job_succeeded: aiJobSucceeded,
      ai_job_failed: aiJobFailed,
      ai_success_rate_pct: aiJobQueued > 0 ? Math.round((aiJobSucceeded / aiJobQueued) * 100) : 0,
    };

    // -----------------------------------------------------------------------
    // Homepage funnel (new feature tracking)
    // -----------------------------------------------------------------------

    const safeRate = (num: number, den: number) => den > 0 ? Math.round((num / den) * 100) : 0;

    const hpLandingViews = countEvents(filteredUserEvents, "landing_view");
    const hpDealsViewed = countEvents(filteredUserEvents, "featured_deals_section_viewed");
    const hpDealClicked = countEvents(filteredUserEvents, "featured_deal_clicked");
    const hpViewAllDeals = countEvents(filteredUserEvents, "view_all_deals_clicked");
    const hpDealWatchCta = countEvents(filteredUserEvents, "deal_watch_cta_clicked");
    const hpForDealersNav = countEvents(filteredUserEvents, "for_dealers_nav_clicked");
    const hpForDealersPage = countEvents(filteredUserEvents, "for_dealers_page_viewed");
    const hpDealerApplyCta = countEvents(filteredUserEvents, "dealer_apply_cta_clicked");

    const homepage_funnel = {
      landing_views: hpLandingViews,
      featured_deals_viewed: hpDealsViewed,
      featured_deal_clicked: hpDealClicked,
      view_all_deals_clicked: hpViewAllDeals,
      deal_watch_cta_clicked: hpDealWatchCta,
      for_dealers_nav_clicked: hpForDealersNav,
      for_dealers_page_viewed: hpForDealersPage,
      dealer_apply_cta_clicked: hpDealerApplyCta,
      deals_section_to_click_rate: safeRate(hpDealClicked, hpDealsViewed),
      dealer_apply_rate: safeRate(hpDealerApplyCta, hpForDealersPage),
    };

    // -----------------------------------------------------------------------
    // User segments (cross-table, all-time for garage/scenarios)
    // -----------------------------------------------------------------------

    const usersWithGarage = new Set((garageUsers || []).map((r: any) => r.user_id).filter(Boolean));
    const usersWithSavedListing = new Set((savedScenariosUsers || []).map((r: any) => r.user_id).filter(Boolean));

    // Visitor-level session counts (within the window) for "returned ≥2 sessions" check
    const visitorSessionCounts = new Map<string, number>();
    for (const p of sessionProfiles) {
      if (!p.visitor_id) continue;
      visitorSessionCounts.set(p.visitor_id, (visitorSessionCounts.get(p.visitor_id) || 0) + 1);
    }

    // High intent: completed EVFit (all-time) + saved ≥1 garage vehicle (all-time) + ≥2 sessions in window
    // evfitCompletions is all-time so users who completed EVFit before the window are included
    const evfitCompletedUserIds = new Set(
      (evfitCompletions || []).map((r: any) => r.user_id).filter(Boolean)
    );
    let highIntentCount = 0;
    for (const uid of evfitCompletedUserIds) {
      if (usersWithGarage.has(uid)) {
        const userSessions = filteredUserEvents
          .filter(e => (e as any).user_id === uid)
          .map(e => (e as any).session_id)
          .filter(Boolean);
        const distinctSessions = new Set(userSessions).size;
        if (distinctSessions >= 2) highIntentCount++;
      }
    }

    const user_segments = {
      users_with_garage_vehicle: usersWithGarage.size,
      users_with_saved_listing: usersWithSavedListing.size,
      high_intent_users: highIntentCount,
    };

    // -----------------------------------------------------------------------
    // Entry mode selection (from user_events)
    // -----------------------------------------------------------------------

    const entryModeEvents = filteredUserEvents.filter(
      (e) => e.event_name === "entry_mode_selected"
    );
    const entryModeMap = new Map<string, number>();
    for (const e of entryModeEvents) {
      const mode = e.event_data?.mode || "unknown";
      entryModeMap.set(mode, (entryModeMap.get(mode) || 0) + 1);
    }

    const entry_mode = {
      total_selections: entryModeEvents.length,
      modes: Array.from(entryModeMap.entries())
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count),
    };

    // -----------------------------------------------------------------------
    // Extraction domains (top URL domains from receipt_events)
    // -----------------------------------------------------------------------

    const domainMap = new Map<
      string,
      { successes: number; failures: number }
    >();
    for (const e of allReceiptEvents) {
      if (e.event_type !== "fetch_success" && e.event_type !== "fetch_fail")
        continue;
      const domain = e.url_domain || "unknown";
      if (!domainMap.has(domain))
        domainMap.set(domain, { successes: 0, failures: 0 });
      if (e.event_type === "fetch_success")
        domainMap.get(domain)!.successes++;
      else domainMap.get(domain)!.failures++;
    }
    const extraction_domains = Array.from(domainMap.entries())
      .map(([domain, counts]) => ({
        domain,
        attempts: counts.successes + counts.failures,
        successes: counts.successes,
        failures: counts.failures,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 15);

    // -----------------------------------------------------------------------
    // Attribution (page_source from event_data)
    // -----------------------------------------------------------------------

    // Only count attribution on meaningful funnel events (not all events)
    const ATTRIBUTION_EVENTS = new Set([
      "landing_view", "receipt_extract_clicked", "receipt_result_viewed",
      "email_capture_submitted", "scenario_save_success", "buyer_pass_teaser_shown",
    ]);
    const attributionMap = new Map<string, number>();
    for (const e of filteredUserEvents) {
      if (!ATTRIBUTION_EVENTS.has(e.event_name)) continue;
      const source = (e.event_data as any)?.page_source || "unknown";
      attributionMap.set(source, (attributionMap.get(source) || 0) + 1);
    }
    const attribution = Array.from(attributionMap.entries())
      .map(([source, event_count]) => ({ source, event_count }))
      .sort((a, b) => b.event_count - a.event_count);

    const sessionProfileLookup = new Map(sessionProfiles.map((p) => [p.session_id, p]));

    const humanCount = sessionProfiles.filter((p) => p.actor_label === "human").length;
    const likelyHumanCount = sessionProfiles.filter((p) => p.actor_label === "likely_human").length;
    const suspiciousCount = sessionProfiles.filter((p) => p.actor_label === "suspicious").length;
    const likelyBotCount = sessionProfiles.filter((p) => p.actor_label === "likely_bot").length;
    const totalSessions = sessionProfiles.length;

    const session_classification = {
      total_sessions: totalSessions,
      human: humanCount,
      likely_human: likelyHumanCount,
      suspicious: suspiciousCount,
      likely_bot: likelyBotCount,
      human_rate: totalSessions > 0
        ? Math.round(((humanCount + likelyHumanCount) / totalSessions) * 1000) / 10
        : 0,
    };

    // -----------------------------------------------------------------------
    // Engagement bins (human sessions only)
    // Bin 1 — No activity:   landed, no scroll, no interaction
    // Bin 2 — Scroll only:   scrolled past 25% but never clicked/typed
    // Bin 3 — Engaged:       fired first_interaction (click or keydown)
    // -----------------------------------------------------------------------

    const humanProfiles = sessionProfiles.filter(
      (p) => p.actor_label === "human" || p.actor_label === "likely_human"
    );

    let binNoActivity = 0;
    let binScrollOnly = 0;
    let binEngaged = 0;

    for (const p of humanProfiles) {
      const hasScroll = p.event_names.has("scroll_depth_25");
      const hasInteraction = p.event_names.has("first_interaction");
      if (hasInteraction) {
        binEngaged++;
      } else if (hasScroll) {
        binScrollOnly++;
      } else {
        binNoActivity++;
      }
    }

    const humanTotal = humanProfiles.length;
    const engagement_bins = {
      total_human_sessions: humanTotal,
      no_activity: binNoActivity,
      scroll_only: binScrollOnly,
      engaged: binEngaged,
      pct_no_activity: humanTotal > 0 ? Math.round((binNoActivity / humanTotal) * 1000) / 10 : 0,
      pct_scroll_only: humanTotal > 0 ? Math.round((binScrollOnly / humanTotal) * 1000) / 10 : 0,
      pct_engaged: humanTotal > 0 ? Math.round((binEngaged / humanTotal) * 1000) / 10 : 0,
    };

    // -----------------------------------------------------------------------
    // Event coverage (Part E)
    // -----------------------------------------------------------------------

    const RECEIPT_EVENTS = ["receipt_generate", "receipt_extract_succeeded", "receipt_extract_failed", "receipt_extract_clicked"];
    const ROUTINE_EVENTS = ["routine_check_started", "routine_field_completed"];
    const COPY_EVENTS = ["copy_reddit_draft", "copy_seller_message", "copy_checklist", "copy_click", "negotiator_copy_clicked"];

    let sessLanding = 0, sessReceipt = 0, sessRoutine = 0, sessCopy = 0;
    for (const p of sessionProfiles) {
      if (p.event_names.has("landing_view")) sessLanding++;
      if (RECEIPT_EVENTS.some((e) => p.event_names.has(e))) sessReceipt++;
      if (ROUTINE_EVENTS.some((e) => p.event_names.has(e))) sessRoutine++;
      if (COPY_EVENTS.some((e) => p.event_names.has(e))) sessCopy++;
    }

    const coverage = {
      sessions_with_landing_view: sessLanding,
      sessions_with_receipt_event: sessReceipt,
      sessions_with_routine_event: sessRoutine,
      sessions_with_copy_event: sessCopy,
      total_sessions: totalSessions,
      pct_landing: totalSessions > 0 ? Math.round((sessLanding / totalSessions) * 1000) / 10 : 0,
      pct_receipt: totalSessions > 0 ? Math.round((sessReceipt / totalSessions) * 1000) / 10 : 0,
      pct_routine: totalSessions > 0 ? Math.round((sessRoutine / totalSessions) * 1000) / 10 : 0,
      pct_copy: totalSessions > 0 ? Math.round((sessCopy / totalSessions) * 1000) / 10 : 0,
    };

    // -----------------------------------------------------------------------
    // Narrative insights (Part C)
    // -----------------------------------------------------------------------

    const insights: string[] = [];

    // 1. Volume
    insights.push(
      `${totalSessions} sessions this period, ${session_classification.human_rate}% classified as human.`
    );

    // 2. Drop-off
    if (sessLanding > 0) {
      const receiptPct = Math.min(100, Math.round((sessReceipt / sessLanding) * 100));
      insights.push(
        `${sessLanding} sessions had a landing_view; ${sessReceipt} reached a receipt event (${receiptPct}% conversion).`
      );
    } else if (sessReceipt > 0) {
      insights.push(
        `${sessReceipt} sessions had receipt events but no landing_view was tracked — likely a tracking gap.`
      );
    }

    // 3. Errors
    if (receipt_pipeline.url_scrape_attempts > 0) {
      const failRate = 100 - receipt_pipeline.url_scrape_success_rate;
      let msg = `${receipt_pipeline.url_scrape_failures} URL scrape failures (${failRate}% failure rate).`;
      if (failRate > 20) msg += " This is above the 20% threshold — investigate.";
      insights.push(msg);
    }

    // 4. Post-receipt engagement
    if (receiptViewed > 0) {
      const anyEngagement = totalCopyActions + shareQrClicked + emailCaptureSubmitted +
        saveSucceeded + downloadPdfClicked + vinEntered;
      const engagementRate = Math.round((anyEngagement / receiptViewed) * 100);
      insights.push(
        `Post-receipt: ${receiptViewed} views → ${anyEngagement} engagement actions (${engagementRate}%). ` +
        `Copy: ${totalCopyActions}, Email: ${emailCaptureSubmitted}, Save: ${saveSucceeded}, ` +
        `Share: ${shareQrClicked}, VIN: ${vinEntered}, PDF: ${downloadPdfClicked}.`
      );

      if (checkoutStarted === 0 && paywallShown > 0) {
        insights.push(
          `${paywallShown} users saw the paywall but 0 started checkout — paywall-to-checkout is the critical gap.`
        );
      }

      if (feedbackShown > 0 && feedbackSubmitted === 0) {
        insights.push(
          `Feedback widget shown ${feedbackShown} times but 0 submissions — users aren't engaging with it.`
        );
      }
    }

    // 4b. Copy breakdown
    const copyTotal = receipt_pipeline.copy_reddit_draft + receipt_pipeline.copy_seller_message +
      receipt_pipeline.copy_checklist + (receipt_pipeline.negotiator_copy || 0);
    if (copyTotal > 0) {
      insights.push(
        `Copy breakdown: ${receipt_pipeline.copy_checklist} checklist, ${receipt_pipeline.negotiator_copy || 0} negotiator, ` +
        `${receipt_pipeline.copy_reddit_draft} reddit, ${receipt_pipeline.copy_seller_message} seller.`
      );
    }

    // 5. Lint
    if (receipt_pipeline.lint_failures > 0) {
      insights.push(
        `${receipt_pipeline.lint_failures} lint failures, ${receipt_pipeline.lint_failed_fallback_served} fallback cards served.`
      );
    }

    // 6. Bots
    if (likelyBotCount > 0) {
      const botPct = Math.round((likelyBotCount / totalSessions) * 100);
      let msg = `${likelyBotCount} sessions flagged as likely_bot (${botPct}%).`;
      if (botPct > 10) msg += " Consider adding rate limiting.";
      insights.push(msg);
    }

    // 7. Top event
    const eventCounts = new Map<string, number>();
    for (const e of filteredUserEvents) {
      if (!HUMAN_SIGNAL_EVENTS.includes(e.event_name)) {
        eventCounts.set(e.event_name, (eventCounts.get(e.event_name) || 0) + 1);
      }
    }
    const topEvent = Array.from(eventCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topEvent) {
      insights.push(`Most common event: "${topEvent[0]}" with ${topEvent[1]} occurrences.`);
    }

    // -----------------------------------------------------------------------
    // Recent events (merged from both tables, enriched with actor data)
    // -----------------------------------------------------------------------

    const mergedRecent = [
      ...(recentEvents || []).map((e) => {
        const profile = sessionProfileLookup.get((e as any).session_id || "");
        return {
          source: "user_events" as const,
          event_name: e.event_name,
          details: e.event_data,
          visitor_id: e.visitor_id,
          session_id: (e as any).session_id || null,
          user_agent: (e as any).user_agent || null,
          actor_label: profile?.actor_label || "unknown",
          bot_score: profile?.bot_score ?? null,
          page_path: e.page_path,
          timestamp: e.timestamp,
        };
      }),
      ...(recentReceiptEvents || []).map((e) => ({
        source: "receipt_events" as const,
        event_name: e.event_type,
        details: {
          receipt_id: e.receipt_id,
          url_domain: e.url_domain,
          verdict: e.verdict,
        },
        visitor_id: e.session_id,
        session_id: e.session_id || null,
        user_agent: null as string | null,
        actor_label: "unknown" as string,
        bot_score: null as number | null,
        page_path: "/receipt",
        timestamp: e.created_at,
      })),
    ]
      .filter((e) => !["fp-uwi6gg", "fp-24bewu", "fp-airyss", "fp-kuhpy6", "fp-cviswk", "fp-vy4i", "fp-cpyu68"].includes(e.visitor_id || ""))
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 50);

    // -----------------------------------------------------------------------
    // Risk distribution (from reports)
    // -----------------------------------------------------------------------

    const riskMap = new Map<string, { total: number; paid: number }>();
    for (const r of allReports) {
      const score = r.payload_json?.confidence?.overall_score;
      if (score == null) continue;
      const category =
        score >= 70
          ? "Green (70-100)"
          : score >= 40
          ? "Yellow (40-69)"
          : "Red (0-39)";
      if (!riskMap.has(category))
        riskMap.set(category, { total: 0, paid: 0 });
      riskMap.get(category)!.total++;
      if (r.status === "paid") riskMap.get(category)!.paid++;
    }
    const risk_distribution = Array.from(riskMap.entries())
      .map(([category, { total, paid }]) => ({
        category,
        total_count: total,
        paid_count: paid,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    // -----------------------------------------------------------------------
    // Recent feedback with text
    // -----------------------------------------------------------------------

    const recent_feedback = allFeedback
      .filter((f) => f.feedback_text)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, 10)
      .map((f) => ({
        rating: f.rating,
        text: f.feedback_text,
        would_recommend: f.would_recommend,
        created_at: f.created_at,
      }));

    // -----------------------------------------------------------------------
    // Verdict distribution (from receipt_events)
    // -----------------------------------------------------------------------

    const verdictMap = new Map<string, number>();
    for (const e of allReceiptEvents) {
      if (e.event_type !== "generate" || !e.verdict) continue;
      verdictMap.set(e.verdict, (verdictMap.get(e.verdict) || 0) + 1);
    }
    const verdict_distribution = Array.from(verdictMap.entries())
      .map(([verdict, count]) => ({ verdict, count }))
      .sort((a, b) => b.count - a.count);

    // -----------------------------------------------------------------------
    // Extraction Health (from extraction_attempts table + user_events)
    // -----------------------------------------------------------------------

    const allExtractionAttempts = extractionAttempts || [];
    const urlAttempts = allExtractionAttempts.filter((a) => a.input_mode === "url");
    const textAttempts = allExtractionAttempts.filter((a) => a.input_mode === "text");
    const urlSuccesses = urlAttempts.filter((a) => a.success);
    const textSuccesses = textAttempts.filter((a) => a.success);

    const failureReasonCounts = (reasons: string[]) =>
      allExtractionAttempts.filter((a) => !a.success && reasons.includes(a.failure_reason || "")).length;

    const extraction_health = {
      total_attempts: allExtractionAttempts.length,
      url_attempts: urlAttempts.length,
      url_successes: urlSuccesses.length,
      url_success_rate: urlAttempts.length > 0
        ? Math.round((urlSuccesses.length / urlAttempts.length) * 1000) / 10 : 0,
      text_attempts: textAttempts.length,
      text_successes: textSuccesses.length,
      text_success_rate: textAttempts.length > 0
        ? Math.round((textSuccesses.length / textAttempts.length) * 1000) / 10 : 0,
      clean_url_cleans: countEvents(filteredUserEvents, "messy_url_cleaned"),
      failures_by_reason: {
        timeout: failureReasonCounts(["timeout"]),
        blocked_by_bot_protection: failureReasonCounts(["blocked_by_bot_protection"]),
        search_page: failureReasonCounts(["search_page"]),
        parse_failure: failureReasonCounts(["parse_failure", "empty_response"]),
        network_error: failureReasonCounts(["network_error"]),
        other: failureReasonCounts(["invalid_url", "unsupported_domain", "unknown"]),
      },
    };

    // -----------------------------------------------------------------------
    // Retention & My Garage
    // -----------------------------------------------------------------------

    const saveReceiptClicked = countEvents(filteredUserEvents, "save_receipt_clicked");
    const saveReceiptSucceeded = countEvents(filteredUserEvents, "save_receipt_succeeded");

    const retention = {
      garage_total_vehicles: (garageUsers || []).length,
      garage_unique_users: new Set((garageUsers || []).map((r: any) => r.user_id).filter(Boolean)).size,
      my_garage_viewed: countEvents(filteredUserEvents, "my_garage_viewed"),
      my_garage_vehicle_added: countEvents(filteredUserEvents, "my_garage_vehicle_added"),
      saved_scenarios_total: (savedScenariosUsers || []).length,
      saved_scenarios_unique_users: new Set((savedScenariosUsers || []).map((r: any) => r.user_id).filter(Boolean)).size,
      save_receipt_clicked: saveReceiptClicked,
      save_receipt_succeeded: saveReceiptSucceeded,
      save_rate_pct: saveReceiptClicked > 0
        ? Math.round((saveReceiptSucceeded / saveReceiptClicked) * 1000) / 10 : 0,
      compare_started: countEvents(filteredUserEvents, "compare_started"),
      compare_completed: countEvents(filteredUserEvents, "compare_completed"),
      high_intent_users: user_segments.high_intent_users,
    };

    // -----------------------------------------------------------------------
    // Repeat Usage (from visitors table)
    // -----------------------------------------------------------------------

    const now7dAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const repeat_usage = {
      returned_in_7d: allVisitors.filter((v) => (v.visit_count || 1) >= 2 && v.last_visit >= now7dAgo).length,
      returned_in_30d: allVisitors.filter((v) => (v.visit_count || 1) >= 2).length,
      single_visit: allVisitors.filter((v) => (v.visit_count || 1) === 1).length,
    };

    // -----------------------------------------------------------------------
    // -----------------------------------------------------------------------
    // Chat metrics
    // -----------------------------------------------------------------------

    const allChatAnalytics = chatAnalyticsRaw || [];
    const allChatMessages = chatMessagesRaw || [];

    // Unique chat sessions
    const chatSessionIds = new Set(allChatAnalytics.map((r: Record<string, unknown>) => r.session_id as string));
    const totalChatSessions = chatSessionIds.size;

    // Total user messages (role = "user")
    const userMessages = allChatMessages.filter((m: Record<string, unknown>) => m.role === "user");
    const totalUserMessages = userMessages.length;

    // Avg messages per session
    const msgPerSession = totalChatSessions > 0
      ? Math.round((totalUserMessages / totalChatSessions) * 10) / 10
      : 0;

    // Scenario split
    const chatByScenario = allChatAnalytics.reduce((acc: Record<string, number>, r: Record<string, unknown>) => {
      const t = (r.scenario_type as string) || "unknown";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Query intent distribution
    const intentCounts = allChatAnalytics.reduce((acc: Record<string, number>, r: Record<string, unknown>) => {
      const q = (r.query_type as string) || "general";
      acc[q] = (acc[q] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Model usage distribution
    const modelCounts = allChatAnalytics.reduce((acc: Record<string, number>, r: Record<string, unknown>) => {
      const m = (r.model_used as string) || "unknown";
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Fallback rate
    const fallbackCount = allChatAnalytics.filter((r: Record<string, unknown>) => r.model_used === "fallback").length;
    const fallbackRatePct = allChatAnalytics.length > 0
      ? Math.round((fallbackCount / allChatAnalytics.length) * 1000) / 10
      : 0;

    // Latency stats (ms)
    const latencies = allChatAnalytics
      .map((r: Record<string, unknown>) => r.latency_ms as number)
      .filter((n: number) => typeof n === "number" && n > 0)
      .sort((a: number, b: number) => a - b);
    const chatAvgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((s: number, v: number) => s + v, 0) / latencies.length)
      : 0;
    const chatP95LatencyMs = latencies.length > 0
      ? latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1]
      : 0;

    // Chat unlock purchases in window
    const chatPassPurchases = (purchases || []).filter(
      (p: Record<string, unknown>) => p.scenario_type === "chat" && p.status === "paid"
    );
    const chatPassRevenue = chatPassPurchases.reduce(
      (s: number, p: Record<string, unknown>) => s + ((p.amount as number) || 0), 0
    );

    // Conversion: sessions that purchased / total sessions
    const chatConversionPct = totalChatSessions > 0
      ? Math.round((chatPassPurchases.length / totalChatSessions) * 1000) / 10
      : 0;

    const chat_metrics = {
      total_sessions: totalChatSessions,
      total_user_messages: totalUserMessages,
      avg_messages_per_session: msgPerSession,
      by_scenario: chatByScenario,
      intent_distribution: intentCounts,
      model_distribution: modelCounts,
      fallback_count: fallbackCount,
      fallback_rate_pct: fallbackRatePct,
      avg_latency_ms: chatAvgLatencyMs,
      p95_latency_ms: chatP95LatencyMs,
      chat_pass_purchases: chatPassPurchases.length,
      chat_pass_revenue_cents: chatPassRevenue,
      chat_conversion_pct: chatConversionPct,
    };

    // Dealer counts (for adminv2)
    const [dealersTotalResult, dealersNewResult] = await Promise.allSettled([
      supabase.from("dealerships").select("id", { count: "exact", head: true }),
      supabase
        .from("dealerships")
        .select("id", { count: "exact", head: true })
        .gte("created_at", window.start)
        .lt("created_at", window.end),
    ]);
    const dealers = {
      total: dealersTotalResult.status === "fulfilled" ? (dealersTotalResult.value.count ?? 0) : 0,
      new_this_period: dealersNewResult.status === "fulfilled" ? (dealersNewResult.value.count ?? 0) : 0,
      signup_started: countEvents(filteredUserEvents, "dealer_signup_started"),
      signup_email_sent: countEvents(filteredUserEvents, "dealer_signup_email_sent"),
      signup_email_failed: countEvents(filteredUserEvents, "dealer_signup_email_failed"),
      signup_completed: countEvents(filteredUserEvents, "dealer_signup_completed"),
    };

    // -----------------------------------------------------------------------
    // AI cost spike alerting (fire-and-forget, never blocks the response)
    // -----------------------------------------------------------------------
    void (async () => {
      try {
        const resendKey = process.env.RESEND_API_KEY;
        const opsEmail = process.env.OPS_ALERT_EMAIL || "hello@offolab.com";
        if (!resendKey) return;

        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 3600_000).toISOString();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();

        const [{ data: hourlyEvents }, { data: weeklyEvents }] = await Promise.all([
          supabase
            .from("user_events")
            .select("event_data")
            .eq("event_name", "receipt_cost_estimate")
            .gte("timestamp", oneHourAgo),
          supabase
            .from("user_events")
            .select("event_data")
            .eq("event_name", "receipt_cost_estimate")
            .gte("timestamp", sevenDaysAgo)
            .lt("timestamp", oneHourAgo),
        ]);

        const sumCost = (rows: Array<{ event_data: unknown }> | null): number =>
          (rows ?? []).reduce((acc, r) => acc + (((r.event_data as Record<string, number> | null)?.total_cost_usd) ?? 0), 0);

        const currentHourSpend = sumCost(hourlyEvents);
        // 7-day trailing hourly average (168 hours minus the current hour = 167)
        const trailingHours = 167;
        const trailingAvgPerHour = sumCost(weeklyEvents) / trailingHours;

        // Only alert if there's meaningful baseline data and current hour > 2x average
        if (trailingAvgPerHour > 0.001 && currentHourSpend > trailingAvgPerHour * 2) {
          const { Resend } = await import("resend");
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: "OFFO Alerts <noreply@offolab.com>",
            to: opsEmail,
            subject: `⚠️ AI cost spike: $${currentHourSpend.toFixed(4)} this hour (avg $${trailingAvgPerHour.toFixed(4)}/hr)`,
            html: `
              <h2>AI Cost Spike Detected</h2>
              <p><strong>Current hour spend:</strong> $${currentHourSpend.toFixed(4)}</p>
              <p><strong>7-day trailing average:</strong> $${trailingAvgPerHour.toFixed(4)}/hr</p>
              <p><strong>Multiplier:</strong> ${(currentHourSpend / trailingAvgPerHour).toFixed(1)}x</p>
              <p><small>Detected at ${now.toISOString()} via GET /api/admin/summary</small></p>
            `,
          });
        }
      } catch {
        // Best-effort — never throw from alerting code
      }
    })();

    // -----------------------------------------------------------------------
    // Free Tools Engagement
    // -----------------------------------------------------------------------

    const tools_engagement = {
      // Charging Time Tool
      charging_tool_views: countEvents(filteredUserEvents, "charging_tool_viewed"),
      charging_tool_preset_uses: countEvents(filteredUserEvents, "charging_tool_preset_selected"),
      charging_tool_results: countEvents(filteredUserEvents, "charging_tool_result_viewed"),
      charging_tool_cta_clicks: countEvents(filteredUserEvents, "charging_tool_cta_clicked"),
      // TCO Tool
      tco_tool_views: countEvents(filteredUserEvents, "tco_tool_viewed"),
      tco_tool_results: countEvents(filteredUserEvents, "tco_tool_result_calculated"),
      tco_breakdown_opens: countEvents(filteredUserEvents, "tco_breakdown_expanded"),
      tco_tool_cta_clicks: countEvents(filteredUserEvents, "tco_tool_cta_clicked"),
      // Warranty Tool
      warranty_tool_views: countEvents(filteredUserEvents, "warranty_tool_viewed"),
      warranty_checks: countEvents(filteredUserEvents, "warranty_check_submitted"),
      warranty_results: countEvents(filteredUserEvents, "warranty_result_viewed"),
      warranty_tweets: countEvents(filteredUserEvents, "warranty_tweet_clicked"),
      // Conversion rates
      charging_view_to_result: safeRate(countEvents(filteredUserEvents, "charging_tool_result_viewed"), countEvents(filteredUserEvents, "charging_tool_viewed")),
      warranty_view_to_check: safeRate(countEvents(filteredUserEvents, "warranty_check_submitted"), countEvents(filteredUserEvents, "warranty_tool_viewed")),
      tco_view_to_result: safeRate(countEvents(filteredUserEvents, "tco_tool_result_calculated"), countEvents(filteredUserEvents, "tco_tool_viewed")),
    };

    // -----------------------------------------------------------------------
    // Page Reach
    // -----------------------------------------------------------------------

    const page_reach = {
      deals_views: countEvents(filteredUserEvents, "deals_page_viewed"),
      news_views: countEvents(filteredUserEvents, "news_page_viewed"),
      news_article_clicks: countEvents(filteredUserEvents, "news_article_clicked"),
      routine_entry_views: countEvents(filteredUserEvents, "routine_page_viewed"),
      routine_results_views: countEvents(filteredUserEvents, "routine_results_viewed"),
      pricing_views: countEvents(filteredUserEvents, "pricing_page_viewed"),
      methodology_views: countEvents(filteredUserEvents, "methodology_page_viewed"),
      shortlist_views: countEvents(filteredUserEvents, "shortlist_page_viewed"),
      auth_login_views: countEvents(filteredUserEvents, "auth_login_page_viewed"),
      auth_signup_views: countEvents(filteredUserEvents, "auth_signup_page_viewed"),
      workspace_evfit_views: countEvents(filteredUserEvents, "workspace_evfit_viewed"),
      workspace_dealwatch_views: countEvents(filteredUserEvents, "workspace_dealwatch_viewed"),
      report_page_views: countEvents(filteredUserEvents, "report_page_viewed"),
      auction_result_views: countEvents(filteredUserEvents, "auction_result_page_viewed"),
      copart_batch_views: countEvents(filteredUserEvents, "copart_batch_viewed"),
    };

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------

    return NextResponse.json({
      success: true,
      filter_mode: filterMode,
      window: {
        start: window.start,
        end: window.end,
        period,
        timezone: TIMEZONE,
      },
      overview,
      receipt_pipeline,
      post_receipt_engagement,
      report_funnel,
      visitors: visitorsSection,
      feedback: feedbackSection,
      daily_trend,
      daily_visitors,
      top_vehicles,
      scenario_saves,
      saved_listings,
      ai_generation,
      routine_engagement,
      evfit_funnel,
      homepage_funnel,
      tools_engagement,
      page_reach,
      user_segments,
      entry_mode,
      extraction_domains,
      attribution,
      risk_distribution,
      verdict_distribution,
      recent_feedback,
      recent_events: mergedRecent,
      session_classification,
      engagement_bins,
      coverage,
      insights,
      extraction_health,
      email_list,
      email_captures,
      email_deliveries,
      retention,
      repeat_usage,
      chat_metrics,
      dealers,
      auction_metrics,
      revenue,
      api_health: (() => {
        const generated = (receipt_pipeline as Record<string, number>).receipts_generated ?? 0;
        const scrapeFailures = (receipt_pipeline as Record<string, number>).url_scrape_failures ?? 0;
        const error_rate = generated > 0 ? Math.round((scrapeFailures / generated) * 10000) / 100 : 0;
        return {
          error_rate,
          alert: error_rate > 0.1,
          p95_latency_ms: (chat_metrics as Record<string, unknown>).p95_latency_ms as number | null ?? null,
          avg_latency_ms: (chat_metrics as Record<string, unknown>).avg_latency_ms as number | null ?? null,
        };
      })(),
      provider_health: await (async () => {
        try {
          const { data } = await supabase.from("provider_health").select("*").order("provider");
          if (!data) return null;
          return data.map((r: Record<string, unknown>) => ({
            provider: r.provider,
            success_count: r.success_count,
            failure_count: r.failure_count,
            success_rate: (() => {
              const total = (r.success_count as number) + (r.failure_count as number);
              return total > 0 ? Math.round(((r.success_count as number) / total) * 1000) / 10 : null;
            })(),
            last_success_at: r.last_success_at,
            last_failure_at: r.last_failure_at,
          }));
        } catch {
          return null;
        }
      })(),
    });
  } catch (err) {
    console.error("Admin summary error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
