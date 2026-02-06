/**
 * Analytics API
 *
 * GET /api/analytics
 * Returns comprehensive analytics data for admin dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { securityLogger } from "@/lib/security-logger";

// Simple authentication - check for admin key in Authorization header
const ADMIN_KEY = process.env.ADMIN_API_KEY || "your-secret-admin-key";

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0] || realIP || "unknown";
}

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);

  try {
    // Check authentication
    const authHeader = request.headers.get("authorization");
    const providedKey = authHeader?.replace("Bearer ", "");

    if (providedKey !== ADMIN_KEY) {
      securityLogger.logAdminLoginFailed(clientIP, "Invalid admin API key");
      return NextResponse.json(
        { error: "Unauthorized - invalid admin key" },
        { status: 401 }
      );
    }

    // Log successful access
    securityLogger.logAdminLoginSuccess(clientIP, "analytics_access");

    // Get time period from query params (default: all time)
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all"; // all, today, week, month, custom
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    // Calculate date cutoff
    const now = new Date();
    let cutoff: string | null = null;
    let cutoffEnd: string | null = null;

    if (period === "custom" && startDate && endDate) {
      cutoff = new Date(startDate).toISOString();
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      cutoffEnd = end.toISOString();
    } else if (period === "today") {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === "week") {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (period === "month") {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // ---- Fetch reports ----
    let reportsQuery = supabase.from("reports").select("*");
    if (cutoff) reportsQuery = reportsQuery.gte("created_at", cutoff);
    if (cutoffEnd) reportsQuery = reportsQuery.lte("created_at", cutoffEnd);
    const { data: reports } = await reportsQuery;
    const allReports = reports || [];

    // ---- Fetch feedback ----
    let feedbackQuery = supabase.from("report_feedback").select("*");
    if (cutoff) feedbackQuery = feedbackQuery.gte("created_at", cutoff);
    if (cutoffEnd) feedbackQuery = feedbackQuery.lte("created_at", cutoffEnd);
    const { data: feedbackRows } = await feedbackQuery;
    const allFeedback = feedbackRows || [];

    // ---- Fetch user events (last 30 days for event-based stats) ----
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: eventRows } = await supabase
      .from("user_events")
      .select("event_name, event_data, timestamp")
      .gte("timestamp", thirtyDaysAgo);
    const allEvents = eventRows || [];

    // ---- Fetch user events for unique customers (with period filter) ----
    let customerEventsQuery = supabase
      .from("user_events")
      .select("event_data")
      .in("event_name", ["report_generated", "report_generation_succeeded", "report_created"]);
    if (cutoff) customerEventsQuery = customerEventsQuery.gte("timestamp", cutoff);
    if (cutoffEnd) customerEventsQuery = customerEventsQuery.lte("timestamp", cutoffEnd);
    const { data: customerEvents } = await customerEventsQuery;

    // 1. Overview
    const totalReports = allReports.length;
    const freeReports = allReports.filter(r => r.status === "free").length;
    const paidReports = allReports.filter(r => r.status === "paid").length;
    const draftReports = allReports.filter(r => r.status === "draft").length;
    const uniqueEmails = new Set(allReports.filter(r => r.customer_email).map(r => r.customer_email));
    const uniqueCustomersBySession = new Set(
      (customerEvents || [])
        .filter(e => e.event_data?.persistent_session_id)
        .map(e => e.event_data.persistent_session_id)
    );

    // 2. Conversion
    const conversionRate = totalReports > 0 ? Math.round((paidReports / totalReports) * 10000) / 100 : 0;

    // 3. Revenue
    const totalRevenue = paidReports * 15;

    // 4. Top vehicles (group by model + year)
    const vehicleMap = new Map<string, { model: string; year: any; total: number; paid: number; free: number }>();
    for (const r of allReports) {
      if (!r.vehicle_model) continue;
      const key = `${r.vehicle_model}|${r.vehicle_year}`;
      if (!vehicleMap.has(key)) {
        vehicleMap.set(key, { model: r.vehicle_model, year: r.vehicle_year, total: 0, paid: 0, free: 0 });
      }
      const entry = vehicleMap.get(key)!;
      entry.total++;
      if (r.status === "paid") entry.paid++;
      if (r.status === "free") entry.free++;
    }
    const topVehicles = Array.from(vehicleMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    // 5. Feedback stats
    const totalFeedbackCount = allFeedback.length;
    const avgRating = totalFeedbackCount > 0
      ? Math.round(allFeedback.reduce((sum, f) => sum + (f.rating || 0), 0) / totalFeedbackCount * 100) / 100
      : 0;
    const wouldRecommendCount = allFeedback.filter(f => f.would_recommend === true).length;
    const wouldNotRecommendCount = allFeedback.filter(f => f.would_recommend === false).length;
    const totalWithRecommendation = allFeedback.filter(f => f.would_recommend !== null).length;
    const recommendationRate = totalWithRecommendation > 0
      ? Math.round((wouldRecommendCount / totalWithRecommendation) * 10000) / 100
      : 0;

    // 6. Rating distribution
    const ratingDist = new Map<number, number>();
    for (const f of allFeedback) {
      if (f.rating != null) {
        ratingDist.set(f.rating, (ratingDist.get(f.rating) || 0) + 1);
      }
    }
    const ratingDistribution = Array.from(ratingDist.entries())
      .map(([rating, count]) => ({ rating, count }))
      .sort((a, b) => b.rating - a.rating);

    // 7. Recent feedback with text (need to join with reports)
    const feedbackWithText = allFeedback
      .filter(f => f.feedback_text)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    // Lookup report info for feedback
    const feedbackReportIds = feedbackWithText.filter(f => f.report_id).map(f => f.report_id);
    let reportLookup = new Map<string, any>();
    if (feedbackReportIds.length > 0) {
      const { data: feedbackReports } = await supabase
        .from("reports")
        .select("id, vehicle_year, vehicle_model")
        .in("id", feedbackReportIds);
      for (const r of feedbackReports || []) {
        reportLookup.set(r.id, r);
      }
    }
    const recentFeedback = feedbackWithText.map(f => {
      const report = f.report_id ? reportLookup.get(f.report_id) : null;
      return {
        rating: f.rating,
        text: f.feedback_text,
        would_recommend: f.would_recommend,
        created_at: f.created_at,
        vehicle: report?.vehicle_model ? `${report.vehicle_year} ${report.vehicle_model}` : "Unknown",
      };
    });

    // 8. Daily trend (last 30 days from reports)
    const thirtyDaysReports = allReports.filter(r => r.created_at >= thirtyDaysAgo);
    const dailyMap = new Map<string, { total: number; free: number; paid: number }>();
    for (const r of thirtyDaysReports) {
      const date = r.created_at?.split("T")[0] || "unknown";
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { total: 0, free: 0, paid: 0 });
      }
      const entry = dailyMap.get(date)!;
      entry.total++;
      if (r.status === "free") entry.free++;
      if (r.status === "paid") entry.paid++;
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, { total, free, paid }]) => ({ date, total, free, paid }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // 9. Willingness to pay by vehicle
    const wtpMap = new Map<string, { model: string; total: number; paid: number }>();
    for (const r of allReports) {
      if (!r.vehicle_model) continue;
      if (!wtpMap.has(r.vehicle_model)) {
        wtpMap.set(r.vehicle_model, { model: r.vehicle_model, total: 0, paid: 0 });
      }
      const entry = wtpMap.get(r.vehicle_model)!;
      entry.total++;
      if (r.status === "paid") entry.paid++;
    }
    const willingnessToPay = Array.from(wtpMap.values())
      .filter(v => v.total >= 1)
      .map(v => ({
        model: v.model,
        total_reports: v.total,
        paid_reports: v.paid,
        conversion_rate: Math.round((v.paid / v.total) * 10000) / 100,
      }))
      .sort((a, b) => b.conversion_rate - a.conversion_rate || b.total_reports - a.total_reports)
      .slice(0, 15);

    // 10. Risk score distribution
    const riskMap = new Map<string, { total: number; paid: number }>();
    for (const r of allReports) {
      const score = r.payload_json?.confidence?.overall_score;
      if (score == null) continue;
      const category = score >= 70 ? "Green (70-100)" : score >= 40 ? "Yellow (40-69)" : "Red (0-39)";
      if (!riskMap.has(category)) {
        riskMap.set(category, { total: 0, paid: 0 });
      }
      const entry = riskMap.get(category)!;
      entry.total++;
      if (r.status === "paid") entry.paid++;
    }
    const riskDistribution = Array.from(riskMap.entries())
      .map(([category, { total, paid }]) => ({ category, total_count: total, paid_count: paid }))
      .sort((a, b) => a.category.localeCompare(b.category));

    // 11. Vehicle checkouts (from events)
    const checkoutEvents = allEvents.filter(e => e.event_name === "vehicle_checkout" && e.event_data?.vehicle_model);
    const checkoutMap = new Map<string, number>();
    for (const e of checkoutEvents) {
      const key = `${e.event_data.vehicle_year}|${e.event_data.vehicle_model}`;
      checkoutMap.set(key, (checkoutMap.get(key) || 0) + 1);
    }
    const vehicleCheckouts = Array.from(checkoutMap.entries())
      .map(([key, count]) => {
        const [year, model] = key.split("|");
        return { year, model, checkout_count: count };
      })
      .sort((a, b) => b.checkout_count - a.checkout_count)
      .slice(0, 20);

    // 12. Report downloads
    const downloadEvents = allEvents.filter(e => ["report_downloaded", "report_created"].includes(e.event_name));
    const downloadMap = new Map<string, number>();
    for (const e of downloadEvents) {
      const key = `${e.event_data?.vehicle_year}|${e.event_data?.vehicle_model}|${e.event_data?.report_status}`;
      downloadMap.set(key, (downloadMap.get(key) || 0) + 1);
    }
    const reportDownloads = Array.from(downloadMap.entries())
      .map(([key, count]) => {
        const [year, model, status] = key.split("|");
        return { year, model, status, download_count: count };
      })
      .sort((a, b) => b.download_count - a.download_count)
      .slice(0, 20);

    // 13. Download summary
    const freeDownloads = downloadEvents.filter(e => e.event_data?.report_status === "free").length;
    const paidDownloads = downloadEvents.filter(e => e.event_data?.report_status === "paid").length;

    // 14. Why checkpoint & funnel stats
    const eventCounts: Record<string, number> = {};
    const funnelEventNames = [
      "why_checkpoint_shown", "why_checkpoint_submitted", "why_checkpoint_skipped",
      "form_submit", "intake_submitted",
      "report_generation_started", "report_generation_succeeded", "report_generation_failed",
      "form_validation_failed", "api_error",
    ];
    for (const name of funnelEventNames) {
      eventCounts[name] = 0;
    }
    for (const e of allEvents) {
      if (funnelEventNames.includes(e.event_name)) {
        eventCounts[e.event_name]++;
      }
    }

    const whyShown = eventCounts["why_checkpoint_shown"];
    const whySubmitted = eventCounts["why_checkpoint_submitted"];
    const reportGenStarted = eventCounts["report_generation_started"];
    const reportGenSucceeded = eventCounts["report_generation_succeeded"];

    // Compile all analytics data
    const analytics = {
      period,
      generated_at: new Date().toISOString(),

      overview: {
        total_reports: totalReports,
        free_reports: freeReports,
        paid_reports: paidReports,
        draft_reports: draftReports,
        unique_customers: uniqueEmails.size,
        unique_customers_by_session: uniqueCustomersBySession.size,
      },

      conversion: {
        total_generated: totalReports,
        converted_to_paid: paidReports,
        conversion_rate: conversionRate,
      },

      revenue: {
        paid_count: paidReports,
        total_revenue: totalRevenue,
        price_per_report: 15,
      },

      feedback: {
        total_feedback: totalFeedbackCount,
        avg_rating: avgRating,
        would_recommend: wouldRecommendCount,
        would_not_recommend: wouldNotRecommendCount,
        recommendation_rate: recommendationRate,
        rating_distribution: ratingDistribution,
      },

      top_vehicles: topVehicles.map(v => ({
        model: v.model,
        year: v.year,
        total_count: v.total,
        paid_count: v.paid,
        free_count: v.free,
      })),

      willingness_to_pay: willingnessToPay,

      risk_distribution: riskDistribution,

      recent_feedback: recentFeedback,

      daily_trend: dailyTrend,

      vehicle_checkouts: vehicleCheckouts,

      report_downloads: reportDownloads,

      download_summary: {
        total_downloads: downloadEvents.length,
        free_downloads: freeDownloads,
        paid_downloads: paidDownloads,
      },

      // Why Checkpoint funnel stats
      why_checkpoint: {
        shown: whyShown,
        submitted: whySubmitted,
        skipped: eventCounts["why_checkpoint_skipped"],
        submit_rate: whyShown > 0 ? Math.round((whySubmitted / whyShown) * 100) : 0,
      },

      // Form → Report generation funnel
      funnel: {
        form_submissions: eventCounts["form_submit"],
        intake_submitted: eventCounts["intake_submitted"],
        report_generation_started: reportGenStarted,
        report_generation_succeeded: reportGenSucceeded,
        report_generation_failed: eventCounts["report_generation_failed"],
        form_validation_failed: eventCounts["form_validation_failed"],
        api_errors: eventCounts["api_error"],
        success_rate: reportGenStarted > 0 ? Math.round((reportGenSucceeded / reportGenStarted) * 100) : 0,
      },
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Analytics error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: "Failed to fetch analytics",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
