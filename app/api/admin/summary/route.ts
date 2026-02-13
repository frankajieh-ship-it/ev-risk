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
      .select("event_name, event_data, visitor_id, timestamp")
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
      .select("event_name, event_data, visitor_id, page_path, timestamp")
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

    const [
      { data: receipts },
      { data: receiptEvents },
      { data: reports },
      { data: userEvents },
      { data: visitors },
      { data: feedback },
      { data: recentEvents },
      { data: recentReceiptEvents },
    ] = await Promise.all([
      receiptsPromise,
      receiptEventsPromise,
      reportsPromise,
      userEventsPromise,
      visitorsPromise,
      feedbackPromise,
      recentEventsPromise,
      recentReceiptEventsPromise,
    ]);

    const allReceipts = receipts || [];
    const allReceiptEvents = receiptEvents || [];
    const allReports = reports || [];
    const allUserEvents = userEvents || [];
    const allVisitors = visitors || [];
    const allFeedback = feedback || [];

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
    const uniqueReceiptSessions = new Set(
      allReceiptEvents
        .filter((e) => e.event_type === "generate" && e.session_id)
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
    // Revenue
    // -----------------------------------------------------------------------

    const revenue = {
      paid_count: paidReports.length,
      total_revenue: paidReports.length * 15,
      price_per_report: 15,
    };

    // -----------------------------------------------------------------------
    // Receipt funnel (from receipt_events + user_events)
    // -----------------------------------------------------------------------

    const fetchSuccesses = countReceiptEvents(allReceiptEvents, "fetch_success");
    const fetchFailures = countReceiptEvents(allReceiptEvents, "fetch_fail");
    const extractionAttempts = fetchSuccesses + fetchFailures;

    const receipt_funnel = {
      extraction_attempts: extractionAttempts,
      extraction_successes: fetchSuccesses,
      extraction_failures: fetchFailures,
      extraction_success_rate:
        extractionAttempts > 0
          ? Math.round((fetchSuccesses / extractionAttempts) * 1000) / 10
          : 0,
      receipts_generated: countReceiptEvents(allReceiptEvents, "generate"),
      lint_failures: countReceiptEvents(allReceiptEvents, "lint_fail"),
      regens: countReceiptEvents(allReceiptEvents, "regen"),
      copies: countReceiptEvents(allReceiptEvents, "copy"),
      copy_reddit_draft: countEvents(allUserEvents, "copy_reddit_draft"),
      copy_seller_message: countEvents(allUserEvents, "copy_seller_message"),
      copy_checklist: countEvents(allUserEvents, "copy_checklist"),
    };

    // -----------------------------------------------------------------------
    // Report funnel (old EV-Risk, from user_events)
    // -----------------------------------------------------------------------

    const formSubmissions = countEvents(allUserEvents, "form_submit");
    const reportGenStarted = countEvents(
      allUserEvents,
      "report_generation_started"
    );
    const reportGenSucceeded = countEvents(
      allUserEvents,
      "report_generation_succeeded"
    );
    const reportGenFailed = countEvents(
      allUserEvents,
      "report_generation_failed"
    );

    const report_funnel = {
      form_submissions: formSubmissions,
      intake_submitted: countEvents(allUserEvents, "intake_submitted"),
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

    const whyShown = countEvents(allUserEvents, "why_checkpoint_shown");
    const whySubmitted = countEvents(allUserEvents, "why_checkpoint_submitted");
    const whySkipped = countEvents(allUserEvents, "why_checkpoint_skipped");

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

    // Receipt generates from receipt_events
    for (const e of allReceiptEvents) {
      if (e.event_type !== "generate") continue;
      const date = e.created_at?.split("T")[0] || "unknown";
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
      clicked: countEvents(allUserEvents, "scenario_save_clicked"),
      succeeded: countEvents(allUserEvents, "scenario_save_success"),
    };

    // -----------------------------------------------------------------------
    // Email captures (from user_events)
    // -----------------------------------------------------------------------

    const email_captures = {
      submitted: countEvents(allUserEvents, "email_checklist_submit"),
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
    // Recent events (merged from both tables)
    // -----------------------------------------------------------------------

    const mergedRecent = [
      ...(recentEvents || []).map((e) => ({
        source: "user_events" as const,
        event_name: e.event_name,
        details: e.event_data,
        visitor_id: e.visitor_id,
        page_path: e.page_path,
        timestamp: e.timestamp,
      })),
      ...(recentReceiptEvents || []).map((e) => ({
        source: "receipt_events" as const,
        event_name: e.event_type,
        details: {
          receipt_id: e.receipt_id,
          url_domain: e.url_domain,
          verdict: e.verdict,
        },
        visitor_id: e.session_id,
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
      window: {
        start: window.start,
        end: window.end,
        period,
        timezone: TIMEZONE,
      },
      overview,
      revenue,
      receipt_funnel,
      report_funnel,
      visitors: visitorsSection,
      why_checkpoint,
      feedback: feedbackSection,
      daily_trend,
      top_vehicles,
      scenario_saves,
      email_captures,
      extraction_domains,
      risk_distribution,
      verdict_distribution,
      recent_feedback,
      recent_events: mergedRecent,
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
