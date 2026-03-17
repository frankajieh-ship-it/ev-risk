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

const ADMIN_KEY = process.env.ADMIN_API_KEY || "your-secret-admin-key";
const TIMEZONE = "America/Indiana/Indianapolis";

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
  if (providedKey !== ADMIN_KEY) {
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
    // Parallel queries
    // -----------------------------------------------------------------------

    // 1. Receipts
    const receiptsPromise = supabase
      .from("receipts")
      .select("id, created_at, output_json, url_domain")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 2. Receipt events
    const receiptEventsPromise = supabase
      .from("receipt_events")
      .select(
        "event_type, receipt_id, session_id, url_domain, verdict, created_at"
      )
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 3. Reports (old EV-Risk)
    const reportsPromise = supabase
      .from("reports")
      .select(
        "id, status, customer_email, vehicle_year, vehicle_model, payload_json, created_at"
      )
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 4. User events
    const userEventsPromise = supabase
      .from("user_events")
      .select("event_name, event_data, visitor_id, session_id, ip_address, user_agent, timestamp")
      .gte("timestamp", window.start)
      .lt("timestamp", window.end);

    // 5. Visitors
    const visitorsPromise = supabase
      .from("visitors")
      .select("visitor_id, page_path, visit_count, last_visit")
      .gte("last_visit", window.start)
      .lt("last_visit", window.end);

    // 6. Report feedback
    const feedbackPromise = supabase
      .from("report_feedback")
      .select("rating, would_recommend, feedback_text, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 7. Recent events (last 50, no window filter)
    const recentEventsPromise = supabase
      .from("user_events")
      .select("event_name, event_data, visitor_id, session_id, ip_address, user_agent, page_path, timestamp")
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
      .select("status, amount, currency, price_variant, scenario_type, created_at")
      .gte("created_at", window.start)
      .lt("created_at", window.end);

    // 10. Garage vehicles — all-time count per user (authenticated users only)
    const garageUsersPromise = supabase
      .from("garage_vehicles")
      .select("user_id");

    // 11. Saved scenarios — all-time count per user (authenticated users only)
    const savedScenariosUsersPromise = supabase
      .from("saved_scenarios")
      .select("user_id");

    const [
      { data: receipts },
      { data: receiptEvents },
      { data: reports },
      { data: userEvents },
      { data: visitors },
      { data: feedback },
      { data: recentEvents },
      { data: recentReceiptEvents },
      { data: purchases },
      { data: garageUsers },
      { data: savedScenariosUsers },
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
    ]);

    const allReceipts = receipts || [];
    const allReceiptEvents = receiptEvents || [];
    const allReports = reports || [];
    const allUserEvents = userEvents || [];
    const allVisitors = visitors || [];
    const allFeedback = feedback || [];

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
      const sid = (e as any).session_id || "unknown";
      if (!sessionMap.has(sid)) {
        sessionMap.set(sid, {
          visitor_id: e.visitor_id,
          ip_address: (e as any).ip_address || null,
          user_agent: (e as any).user_agent || null,
          event_count: 0,
          event_names: new Set(),
          timestamps: [],
        });
      }
      const s = sessionMap.get(sid)!;
      s.event_count++;
      s.event_names.add(e.event_name);
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

    // Sum confirmed revenue (amount is in cents)
    const buyerPassRevenue = paidPurchases.reduce((sum, p) => sum + (p.amount || 0), 0) / 100;
    const legacyReportRevenue = paidReports.length * 15;

    const revenue = {
      total_revenue: buyerPassRevenue + legacyReportRevenue,
      buyer_pass: {
        paid: paidPurchases.length,
        pending: pendingPurchases.length,
        failed: failedPurchases.length,
        refunded: refundedPurchases.length,
        revenue: buyerPassRevenue,
      },
      legacy_reports: {
        paid_count: paidReports.length,
        revenue: legacyReportRevenue,
      },
    };

    // -----------------------------------------------------------------------
    // Receipt funnel (from receipt_events + user_events)
    // -----------------------------------------------------------------------

    const fetchSuccesses = countReceiptEvents(allReceiptEvents, "fetch_success");
    const fetchFailures = countReceiptEvents(allReceiptEvents, "fetch_fail");
    const extractionAttempts = fetchSuccesses + fetchFailures;

    // DB rows are ground truth; client-side events may undercount (late addition, ad blockers)
    const receiptsGenFromDB = allReceipts.length;
    const receiptsGenFromUserEvents = countEvents(filteredUserEvents, "receipt_generate");
    const receiptsGenFromReceiptEvents = countReceiptEvents(allReceiptEvents, "generate");

    const receipt_pipeline = {
      url_scrape_attempts: extractionAttempts,
      url_scrape_successes: fetchSuccesses,
      url_scrape_failures: fetchFailures,
      url_scrape_success_rate:
        extractionAttempts > 0
          ? Math.round((fetchSuccesses / extractionAttempts) * 1000) / 10
          : 0,
      receipts_generated: Math.max(receiptsGenFromDB, receiptsGenFromUserEvents, receiptsGenFromReceiptEvents),
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
    const totalVisits = allVisitors.reduce(
      (sum, v) => sum + (v.visit_count || 1),
      0
    );

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
      entry.views += v.visit_count || 1;
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
    // Daily trend (receipt generates + report creates per day)
    // -----------------------------------------------------------------------

    const dailyMap = new Map<
      string,
      { receipts: number; reports_free: number; reports_paid: number }
    >();

    // Receipt generates from receipts table (ground truth, not event-based)
    for (const r of allReceipts) {
      const date = r.created_at?.split("T")[0] || "unknown";
      if (!dailyMap.has(date))
        dailyMap.set(date, { receipts: 0, reports_free: 0, reports_paid: 0 });
      dailyMap.get(date)!.receipts++;
    }

    // Reports from reports table
    for (const r of allReports) {
      const date = r.created_at?.split("T")[0] || "unknown";
      if (!dailyMap.has(date))
        dailyMap.set(date, { receipts: 0, reports_free: 0, reports_paid: 0 });
      if (r.status === "paid") dailyMap.get(date)!.reports_paid++;
      else dailyMap.get(date)!.reports_free++;
    }

    const daily_trend = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => b.date.localeCompare(a.date));

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
        .lte("saved_at", window.end);

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

    // High intent: completed EVFit + saved ≥1 garage vehicle + returned ≥2 sessions in window
    // We match on user_id from user_events (when authenticated)
    const evfitCompletedUserIds = new Set(
      filteredUserEvents
        .filter(e => e.event_name === "evfit_completed_server" || e.event_name === "evfit_completed")
        .map(e => (e as any).user_id)
        .filter(Boolean)
    );
    let highIntentCount = 0;
    for (const uid of evfitCompletedUserIds) {
      if (usersWithGarage.has(uid)) {
        // Count sessions for this user's visitor_id(s) in the window
        const userVisitorSessions = filteredUserEvents
          .filter(e => (e as any).user_id === uid)
          .map(e => (e as any).session_id)
          .filter(Boolean);
        const distinctSessions = new Set(userVisitorSessions).size;
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
      revenue,
      receipt_pipeline,
      post_receipt_engagement,
      report_funnel,
      visitors: visitorsSection,
      why_checkpoint,
      feedback: feedbackSection,
      daily_trend,
      top_vehicles,
      scenario_saves,
      saved_listings,
      email_captures,
      email_deliveries,
      ai_generation,
      report_server_events,
      routine_engagement,
      evfit_funnel,
      user_segments,
      entry_mode,
      extraction_domains,
      attribution,
      risk_distribution,
      verdict_distribution,
      recent_feedback,
      recent_events: mergedRecent,
      session_classification,
      coverage,
      insights,
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
