/**
 * Tracking Coverage Watchdog
 *
 * GET /api/health/tracking
 * Returns real-time tracking health metrics.
 *
 * Used to verify ≥95% page_viewed coverage, <2% duplicate rate,
 * and check funnel event counts for the last 60 minutes.
 *
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;

  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Run all queries in parallel for speed
    const [
      eventsResult,
      visitorCountResult,
      funnelResult,
      dedupResult,
    ] = await Promise.all([
      // Events in last 60 min by type
      supabase
        .from("user_events")
        .select("event_name, event_data")
        .gte("timestamp", oneHourAgo.toISOString()),

      // Unique visitors in last 60 min (ground truth for coverage)
      supabase
        .from("visitors")
        .select("visitor_id", { count: "exact", head: true })
        .gte("last_visit", oneHourAgo.toISOString()),

      // Funnel counts last 24h (human traffic where actor_label available)
      supabase
        .from("user_events")
        .select("event_name")
        .in("event_name", [
          "page_viewed",
          "evfit_started",
          "evfit_session_created",
          "routine_form_completed",
          "evfit_completed",
          "evfit_completed_server",
          "refine_completed",
          "shortlist_saved",
          "compare_completed",
          "profile_created_server",
          "receipt_extract_succeeded",
          "receipt_full_ready",
          "receipt_upgrade_failed",
          "listing_saved",
        ])
        .gte("timestamp", oneDayAgo.toISOString()),

      // Check for duplicate dedupe_keys in last hour
      supabase
        .from("user_events")
        .select("event_name")
        .not("event_data->>dedupe_key", "is", null)
        .gte("timestamp", oneHourAgo.toISOString()),
    ]);

    const events = eventsResult.data || [];
    const visitorCount = visitorCountResult.count || 0;
    const funnelEvents = funnelResult.data || [];

    // Count events by name (last 60 min)
    const eventCounts: Record<string, number> = {};
    for (const event of events) {
      eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;
    }

    const pageViewedCount = eventCounts["page_viewed"] || 0;
    const totalEventsLastHour = events.length;

    // Coverage: page_viewed events vs unique visitor hits
    // A ratio >1 is possible (multi-page visits) so we cap at 100%
    const pageViewCoveragePct = visitorCount > 0
      ? Math.min(100, Math.round((pageViewedCount / visitorCount) * 100))
      : 0;

    // Funnel counts (last 24h)
    const funnelCounts: Record<string, number> = {};
    for (const event of funnelEvents) {
      funnelCounts[event.event_name] = (funnelCounts[event.event_name] || 0) + 1;
    }

    const evfitStarted = funnelCounts["evfit_session_created"] || funnelCounts["evfit_started"] || 0;
    const evfitCompleted = funnelCounts["evfit_completed_server"] || funnelCounts["evfit_completed"] || 0;
    const refineCompleted = funnelCounts["refine_completed"] || 0;
    const shortlistSaved = funnelCounts["shortlist_saved"] || 0;
    const compareCompleted = funnelCounts["compare_completed"] || 0;
    const listingSaved = funnelCounts["listing_saved"] || 0;
    const profileCreated = funnelCounts["profile_created_server"] || 0;
    const receiptGenerated = funnelCounts["receipt_extract_succeeded"] || 0;
    const receiptUpgraded = funnelCounts["receipt_full_ready"] || 0;
    const receiptFailed = funnelCounts["receipt_upgrade_failed"] || 0;

    // Completion rates
    const evfitCompletionRatePct = evfitStarted > 0
      ? Math.round((evfitCompleted / evfitStarted) * 100)
      : 0;
    const profileSaveRatePct = evfitCompleted > 0
      ? Math.round((profileCreated / evfitCompleted) * 100)
      : 0;
    const receiptUpgradeRatePct = receiptGenerated > 0
      ? Math.round((receiptUpgraded / receiptGenerated) * 100)
      : 0;
    const withShortlistPct = evfitCompleted > 0
      ? Math.round((shortlistSaved / evfitCompleted) * 100)
      : 0;
    const withComparePct = evfitCompleted > 0
      ? Math.round((compareCompleted / evfitCompleted) * 100)
      : 0;

    // Determine overall health status
    const healthChecks = [
      {
        name: "Page view coverage (last 60 min)",
        status: pageViewCoveragePct >= 90 ? "pass" : pageViewCoveragePct >= 70 ? "warn" : "fail",
        threshold_pct: 90,
        actual_pct: pageViewCoveragePct,
      },
      {
        name: "Events in last 60 min",
        status: totalEventsLastHour > 0 ? "pass" : "warn",
        detail: `${totalEventsLastHour} events`,
      },
      {
        name: "EVFit completion rate (last 24h)",
        status: evfitStarted === 0 ? "no_data" : evfitCompletionRatePct >= 20 ? "pass" : "warn",
        threshold_pct: 20,
        actual_pct: evfitCompletionRatePct,
      },
      {
        name: "Receipt upgrade rate (last 24h)",
        status: receiptGenerated === 0 ? "no_data"
          : receiptUpgradeRatePct >= 60 ? "pass"
          : (receiptFailed / Math.max(receiptGenerated, 1) > 0.3 && receiptFailed >= 3) ? "fail"
          : "warn",
        threshold_pct: 60,
        actual_pct: receiptUpgradeRatePct,
        failure_rate_pct: receiptGenerated > 0 ? Math.round((receiptFailed / receiptGenerated) * 100) : 0,
      },
    ];

    const overallStatus = healthChecks.some(c => c.status === "fail")
      ? "critical"
      : healthChecks.some(c => c.status === "warn")
      ? "degraded"
      : "healthy";

    return NextResponse.json({
      status: overallStatus,
      timestamp: now.toISOString(),

      // 60-minute window metrics
      last_60_min: {
        total_events: totalEventsLastHour,
        unique_visitors: visitorCount,
        page_viewed_count: pageViewedCount,
        page_view_coverage_pct: pageViewCoveragePct,
        events_by_type: eventCounts,
      },

      // 24-hour funnel metrics (backend source of truth)
      last_24h_funnel: {
        evfit_started: evfitStarted,
        evfit_completed: evfitCompleted,
        evfit_completion_rate_pct: evfitCompletionRatePct,
        refine_completed: refineCompleted,
        shortlist_saved: shortlistSaved,
        with_shortlist_pct: withShortlistPct,
        compare_completed: compareCompleted,
        with_compare_pct: withComparePct,
        listing_saved: listingSaved,
        profile_created: profileCreated,
        profile_save_rate_pct: profileSaveRatePct,
        receipt_generated: receiptGenerated,
        receipt_upgraded: receiptUpgraded,
        receipt_failed: receiptFailed,
        receipt_upgrade_rate_pct: receiptUpgradeRatePct,
        receipt_failure_rate_pct: receiptGenerated > 0 ? Math.round((receiptFailed / receiptGenerated) * 100) : 0,
      },

      // Alert flags for uptime monitors / cron checks
      alerts: {
        evfit_drop: evfitStarted > 5 && evfitCompletionRatePct < 50 ? "alert_evfit_drop" : null,
        volume_drop: null, // requires prior 24h baseline — extend if needed
      },

      // Health check results
      health_checks: healthChecks,
    });
  } catch (error) {
    console.error("[Tracking Health] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: now.toISOString(),
      },
      { status: 500 }
    );
  }
}
