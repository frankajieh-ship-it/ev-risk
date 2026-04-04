/**
 * Session Analytics API
 * GET /api/session/analytics
 *
 * Returns analytics data for EV Routine sessions from Supabase.
 * Used by admin dashboard to display decision resolution metrics.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Simple authentication - check for admin key
const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function GET(req: NextRequest) {
  // Check authentication
  const authHeader = req.headers.get("authorization");
  const providedKey = authHeader?.replace("Bearer ", "");

  if (!ADMIN_KEY || providedKey !== ADMIN_KEY) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Session tracking not configured", session_analytics: null },
      { status: 200 } // Return 200 with null data so dashboard doesn't break
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30"; // days

    const periodDays = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // 1. Session overview stats
    const { data: overviewData, error: overviewError } = await supabase
      .from("evroutine_sessions")
      .select("id, completed_at, results_viewed_at, decision_outcome", { count: "exact" })
      .gte("created_at", startDate.toISOString());

    if (overviewError) throw overviewError;

    const totalSessions = overviewData?.length || 0;
    const completedSessions = overviewData?.filter(s => s.completed_at).length || 0;
    const viewedResults = overviewData?.filter(s => s.results_viewed_at).length || 0;
    const withResolution = overviewData?.filter(s => s.decision_outcome).length || 0;

    // 2. Decision outcome distribution
    const { data: outcomeData, error: outcomeError } = await supabase
      .from("evroutine_sessions")
      .select("decision_outcome")
      .gte("created_at", startDate.toISOString())
      .not("decision_outcome", "is", null);

    if (outcomeError) throw outcomeError;

    const outcomeCounts: Record<string, number> = {};
    outcomeData?.forEach(s => {
      const outcome = s.decision_outcome;
      outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    });

    // 3. Fit signal distribution
    const { data: fitSignalData, error: fitSignalError } = await supabase
      .from("evroutine_sessions")
      .select("fit_signal")
      .gte("created_at", startDate.toISOString())
      .not("fit_signal", "is", null);

    if (fitSignalError) throw fitSignalError;

    const fitSignalCounts: Record<string, number> = {};
    fitSignalData?.forEach(s => {
      const signal = s.fit_signal;
      fitSignalCounts[signal] = (fitSignalCounts[signal] || 0) + 1;
    });

    // 4. Source breakdown
    const { data: sourceData, error: sourceError } = await supabase
      .from("evroutine_sessions")
      .select("source")
      .gte("created_at", startDate.toISOString());

    if (sourceError) throw sourceError;

    const sourceCounts: Record<string, number> = {};
    sourceData?.forEach(s => {
      const source = s.source || "direct";
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    // 5. Surfaced new tradeoff stats
    const { data: tradeoffData, error: tradeoffError } = await supabase
      .from("evroutine_sessions")
      .select("surfaced_new_tradeoff")
      .gte("created_at", startDate.toISOString())
      .not("surfaced_new_tradeoff", "is", null);

    if (tradeoffError) throw tradeoffError;

    const surfacedYes = tradeoffData?.filter(s => s.surfaced_new_tradeoff === true).length || 0;
    const surfacedNo = tradeoffData?.filter(s => s.surfaced_new_tradeoff === false).length || 0;

    // 6. Region distribution
    const { data: regionData, error: regionError } = await supabase
      .from("evroutine_sessions")
      .select("region")
      .gte("created_at", startDate.toISOString());

    if (regionError) throw regionError;

    const regionCounts: Record<string, number> = {};
    regionData?.forEach(s => {
      const region = s.region || "AUTO";
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    // 7. Recent sessions with resolution
    const { data: recentSessions, error: recentError } = await supabase
      .from("evroutine_sessions")
      .select("id, created_at, fit_signal, decision_outcome, surfaced_new_tradeoff, region, source, inputs")
      .gte("created_at", startDate.toISOString())
      .not("decision_outcome", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (recentError) throw recentError;

    // 9. IP Metrics: Unique scenarios and novel count (within date range)
    const { data: ipMetricsData, error: ipMetricsError } = await supabase
      .from("evroutine_sessions")
      .select("scenario_fingerprint, is_novel_scenario, engine_version")
      .gte("created_at", startDate.toISOString())
      .not("scenario_fingerprint", "is", null);

    if (ipMetricsError) throw ipMetricsError;

    const uniqueFingerprints = new Set(
      ipMetricsData?.map((s) => s.scenario_fingerprint).filter(Boolean)
    ).size;
    const novelCount = ipMetricsData?.filter((s) => s.is_novel_scenario).length || 0;
    const latestEngineVersion = ipMetricsData?.[0]?.engine_version || "2.1.0";

    // 8. Daily session trend
    const { data: dailyData, error: dailyError } = await supabase
      .from("evroutine_sessions")
      .select("created_at, completed_at, decision_outcome")
      .gte("created_at", startDate.toISOString());

    if (dailyError) throw dailyError;

    // Group by date
    const dailyTrend: Record<string, { total: number; completed: number; resolved: number }> = {};
    dailyData?.forEach(s => {
      const date = s.created_at.split("T")[0];
      if (!dailyTrend[date]) {
        dailyTrend[date] = { total: 0, completed: 0, resolved: 0 };
      }
      dailyTrend[date].total++;
      if (s.completed_at) dailyTrend[date].completed++;
      if (s.decision_outcome) dailyTrend[date].resolved++;
    });

    const dailyTrendArray = Object.entries(dailyTrend)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Compile response
    const sessionAnalytics = {
      period_days: periodDays,
      generated_at: new Date().toISOString(),

      overview: {
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        viewed_results: viewedResults,
        with_resolution: withResolution,
        completion_rate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        resolution_rate: viewedResults > 0 ? Math.round((withResolution / viewedResults) * 100) : 0,
      },

      decision_outcomes: Object.entries(outcomeCounts).map(([outcome, count]) => ({
        outcome,
        count,
        label: formatOutcomeLabel(outcome),
      })),

      fit_signals: Object.entries(fitSignalCounts).map(([signal, count]) => ({
        signal,
        count,
        label: formatFitSignalLabel(signal),
      })),

      sources: Object.entries(sourceCounts).map(([source, count]) => ({
        source,
        count,
      })),

      regions: Object.entries(regionCounts).map(([region, count]) => ({
        region,
        count,
      })),

      surfaced_tradeoff: {
        yes: surfacedYes,
        no: surfacedNo,
        total: surfacedYes + surfacedNo,
        rate: (surfacedYes + surfacedNo) > 0
          ? Math.round((surfacedYes / (surfacedYes + surfacedNo)) * 100)
          : 0,
      },

      recent_sessions: recentSessions?.map(s => ({
        id: s.id,
        created_at: s.created_at,
        fit_signal: s.fit_signal,
        decision_outcome: s.decision_outcome,
        surfaced_new_tradeoff: s.surfaced_new_tradeoff,
        region: s.region,
        source: s.source,
        vehicle_model: s.inputs?.vehicleModel || null,
      })) || [],

      daily_trend: dailyTrendArray,

      // IP Defensibility metrics
      ip_metrics: {
        unique_scenarios: uniqueFingerprints,
        novel_scenarios: novelCount,
        engine_version: latestEngineVersion,
      },
    };

    return NextResponse.json({ session_analytics: sessionAnalytics });
  } catch (error) {
    console.error("Session analytics error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch session analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Helper functions
function formatOutcomeLabel(outcome: string): string {
  const labels: Record<string, string> = {
    MORE_CONFIDENT_BUYING: "More confident buying",
    MORE_CONFIDENT_NOT_BUYING: "More confident not buying",
    NEED_MORE_TIME: "Need more time",
    CONFIRMED_CONCERNS: "Confirmed concerns",
    OTHER: "Other",
  };
  return labels[outcome] || outcome;
}

function formatFitSignalLabel(signal: string): string {
  const labels: Record<string, string> = {
    GOOD: "Good Fit",
    CONDITIONAL: "Conditional Fit",
    HIGH_FRICTION: "High Friction",
  };
  return labels[signal] || signal;
}
