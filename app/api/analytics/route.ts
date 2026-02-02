/**
 * Analytics API
 *
 * GET /api/analytics
 * Returns comprehensive analytics data for admin dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { securityLogger } from "@/lib/security-logger";

const sql = neon(process.env.POSTGRES_URL!);

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

    // Calculate date filter
    let dateFilter = "";
    let feedbackDateFilter = "";
    const now = new Date();

    if (period === "custom" && startDate && endDate) {
      // Custom date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date
      dateFilter = `AND created_at >= '${start.toISOString()}' AND created_at <= '${end.toISOString()}'`;
      feedbackDateFilter = `AND f.created_at >= '${start.toISOString()}' AND f.created_at <= '${end.toISOString()}'`;
    } else if (period === "today") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = `AND created_at >= '${today.toISOString()}'`;
      feedbackDateFilter = `AND f.created_at >= '${today.toISOString()}'`;
    } else if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = `AND created_at >= '${weekAgo.toISOString()}'`;
      feedbackDateFilter = `AND f.created_at >= '${weekAgo.toISOString()}'`;
    } else if (period === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = `AND created_at >= '${monthAgo.toISOString()}'`;
      feedbackDateFilter = `AND f.created_at >= '${monthAgo.toISOString()}'`;
    }

    // 1. Overall statistics
    const overallStats = await sql`
      SELECT
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'free' THEN 1 END) as free_reports,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_reports,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_reports,
        COUNT(DISTINCT customer_email) FILTER (WHERE customer_email IS NOT NULL) as unique_customers
      FROM reports
      WHERE 1=1 ${dateFilter ? sql.unsafe(dateFilter) : sql``}
    `;

    // 1b. Count unique customers from events (using persistent_session_id)
    // This captures ALL users who generated reports, not just those who paid
    const uniqueCustomersFromEvents = await sql`
      SELECT
        COUNT(DISTINCT event_data->>'persistent_session_id') as unique_customers_by_session
      FROM user_events
      WHERE event_name IN ('report_generated', 'report_generation_succeeded', 'report_created')
        AND event_data->>'persistent_session_id' IS NOT NULL
        ${dateFilter ? sql.unsafe(dateFilter.replace('created_at', 'timestamp')) : sql``}
    `;

    // 2. Conversion metrics
    const conversionMetrics = await sql`
      SELECT
        COUNT(*) as total_generated,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as converted_to_paid,
        ROUND(
          (COUNT(CASE WHEN status = 'paid' THEN 1 END)::NUMERIC /
           NULLIF(COUNT(*), 0) * 100), 2
        ) as conversion_rate
      FROM reports
      WHERE 1=1 ${dateFilter ? sql.unsafe(dateFilter) : sql``}
    `;

    // 3. Revenue data
    const revenueData = await sql`
      SELECT
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) * 15 as total_revenue
      FROM reports
      WHERE 1=1 ${dateFilter ? sql.unsafe(dateFilter) : sql``}
    `;

    // 4. Popular vehicle makes and models
    const topVehicles = await sql`
      SELECT
        vehicle_model as model,
        vehicle_year as year,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'free' THEN 1 END) as free_count
      FROM reports
      WHERE vehicle_model IS NOT NULL ${dateFilter ? sql.unsafe(dateFilter) : sql``}
      GROUP BY vehicle_model, vehicle_year
      ORDER BY count DESC
      LIMIT 20
    `;

    // 5. Feedback metrics (from report_feedback table)
    const feedbackStats = await sql`
      SELECT
        COUNT(*) as total_feedback,
        ROUND(AVG(rating), 2) as avg_rating,
        COUNT(CASE WHEN would_recommend = true THEN 1 END) as would_recommend_count,
        COUNT(CASE WHEN would_recommend = false THEN 1 END) as would_not_recommend_count,
        ROUND(
          (COUNT(CASE WHEN would_recommend = true THEN 1 END)::NUMERIC /
           NULLIF(COUNT(CASE WHEN would_recommend IS NOT NULL THEN 1 END), 0) * 100), 2
        ) as recommendation_rate
      FROM report_feedback f
      WHERE 1=1 ${feedbackDateFilter ? sql.unsafe(feedbackDateFilter) : sql``}
    `;

    // 6. Rating distribution
    const ratingDistribution = await sql`
      SELECT
        rating,
        COUNT(*) as count
      FROM report_feedback f
      WHERE rating IS NOT NULL ${feedbackDateFilter ? sql.unsafe(feedbackDateFilter) : sql``}
      GROUP BY rating
      ORDER BY rating DESC
    `;

    // 7. Recent feedback with text
    const recentFeedback = await sql`
      SELECT
        f.rating,
        f.feedback_text,
        f.would_recommend,
        f.created_at,
        r.vehicle_year,
        r.vehicle_model
      FROM report_feedback f
      LEFT JOIN reports r ON f.report_id = r.id
      WHERE f.feedback_text IS NOT NULL ${feedbackDateFilter ? sql.unsafe(feedbackDateFilter) : sql``}
      ORDER BY f.created_at DESC
      LIMIT 10
    `;

    // 8. Daily activity trend (last 30 days)
    const dailyTrend = await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'free' THEN 1 END) as free,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // 9. User willingness to pay analysis
    const willingnessToPayByVehicle = await sql`
      SELECT
        vehicle_model as model,
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_reports,
        ROUND(
          (COUNT(CASE WHEN status = 'paid' THEN 1 END)::NUMERIC /
           NULLIF(COUNT(*), 0) * 100), 2
        ) as conversion_rate
      FROM reports
      WHERE vehicle_model IS NOT NULL ${dateFilter ? sql.unsafe(dateFilter) : sql``}
      GROUP BY vehicle_model
      HAVING COUNT(*) >= 1
      ORDER BY conversion_rate DESC, total_reports DESC
      LIMIT 15
    `;

    // 10. Risk score distribution
    const riskScoreDistribution = await sql`
      SELECT
        CASE
          WHEN (payload_json->'confidence'->>'overall_score')::INTEGER >= 70 THEN 'Green (70-100)'
          WHEN (payload_json->'confidence'->>'overall_score')::INTEGER >= 40 THEN 'Yellow (40-69)'
          ELSE 'Red (0-39)'
        END as risk_category,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count
      FROM reports
      WHERE payload_json->'confidence'->>'overall_score' IS NOT NULL ${dateFilter ? sql.unsafe(dateFilter) : sql``}
      GROUP BY risk_category
      ORDER BY risk_category
    `;

    // 11. Vehicle checkout stats (from user_events)
    const vehicleCheckouts = await sql`
      SELECT
        event_data->>'vehicle_year' as year,
        event_data->>'vehicle_model' as model,
        COUNT(*) as checkout_count
      FROM user_events
      WHERE event_name = 'vehicle_checkout'
        AND timestamp >= NOW() - INTERVAL '30 days'
        AND event_data->>'vehicle_model' IS NOT NULL
      GROUP BY year, model
      ORDER BY checkout_count DESC
      LIMIT 20
    `;

    // 12. Report download stats (from user_events - includes both created and downloaded)
    const reportDownloads = await sql`
      SELECT
        event_data->>'vehicle_year' as year,
        event_data->>'vehicle_model' as model,
        event_data->>'report_status' as status,
        COUNT(*) as download_count
      FROM user_events
      WHERE event_name IN ('report_downloaded', 'report_created')
        AND timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY year, model, status
      ORDER BY download_count DESC
      LIMIT 20
    `;

    // 13. Download summary (counts report_created as "Free Reports" since those are instant)
    const downloadSummary = await sql`
      SELECT
        COUNT(*) as total_downloads,
        COUNT(CASE WHEN event_data->>'report_status' = 'free' THEN 1 END) as free_downloads,
        COUNT(CASE WHEN event_data->>'report_status' = 'paid' THEN 1 END) as paid_downloads
      FROM user_events
      WHERE event_name IN ('report_downloaded', 'report_created')
        AND timestamp >= NOW() - INTERVAL '30 days'
    `;

    // 14. Why Checkpoint stats (form_submit → report funnel and why checkpoint)
    const whyCheckpointStats = await sql`
      SELECT
        COUNT(CASE WHEN event_name = 'why_checkpoint_shown' THEN 1 END) as why_shown,
        COUNT(CASE WHEN event_name = 'why_checkpoint_submitted' THEN 1 END) as why_submitted,
        COUNT(CASE WHEN event_name = 'why_checkpoint_skipped' THEN 1 END) as why_skipped,
        COUNT(CASE WHEN event_name = 'form_submit' THEN 1 END) as form_submissions,
        COUNT(CASE WHEN event_name = 'intake_submitted' THEN 1 END) as intake_submitted,
        COUNT(CASE WHEN event_name = 'report_generation_started' THEN 1 END) as report_gen_started,
        COUNT(CASE WHEN event_name = 'report_generation_succeeded' THEN 1 END) as report_gen_succeeded,
        COUNT(CASE WHEN event_name = 'report_generation_failed' THEN 1 END) as report_gen_failed,
        COUNT(CASE WHEN event_name = 'form_validation_failed' THEN 1 END) as form_validation_failed,
        COUNT(CASE WHEN event_name = 'api_error' THEN 1 END) as api_errors
      FROM user_events
      WHERE timestamp >= NOW() - INTERVAL '30 days'
    `;

    // Compile all analytics data
    const analytics = {
      period,
      generated_at: new Date().toISOString(),

      overview: {
        total_reports: parseInt(overallStats[0].total_reports),
        free_reports: parseInt(overallStats[0].free_reports),
        paid_reports: parseInt(overallStats[0].paid_reports),
        draft_reports: parseInt(overallStats[0].draft_reports),
        unique_customers: parseInt(overallStats[0].unique_customers),
        // NEW: Unique customers counted by persistent session (includes all report creators, not just paid)
        unique_customers_by_session: parseInt(uniqueCustomersFromEvents[0]?.unique_customers_by_session || 0),
      },

      conversion: {
        total_generated: parseInt(conversionMetrics[0].total_generated),
        converted_to_paid: parseInt(conversionMetrics[0].converted_to_paid),
        conversion_rate: parseFloat(conversionMetrics[0].conversion_rate || 0),
      },

      revenue: {
        paid_count: parseInt(revenueData[0].paid_count),
        total_revenue: parseInt(revenueData[0].total_revenue),
        price_per_report: 15,
      },

      feedback: {
        total_feedback: parseInt(feedbackStats[0]?.total_feedback || 0),
        avg_rating: parseFloat(feedbackStats[0]?.avg_rating || 0),
        would_recommend: parseInt(feedbackStats[0]?.would_recommend_count || 0),
        would_not_recommend: parseInt(feedbackStats[0]?.would_not_recommend_count || 0),
        recommendation_rate: parseFloat(feedbackStats[0]?.recommendation_rate || 0),
        rating_distribution: ratingDistribution.map((r) => ({
          rating: r.rating,
          count: parseInt(r.count),
        })),
      },

      top_vehicles: topVehicles.map((v) => ({
        model: v.model,
        year: v.year,
        total_count: parseInt(v.count),
        paid_count: parseInt(v.paid_count),
        free_count: parseInt(v.free_count),
      })),

      willingness_to_pay: willingnessToPayByVehicle.map((v) => ({
        model: v.model,
        total_reports: parseInt(v.total_reports),
        paid_reports: parseInt(v.paid_reports),
        conversion_rate: parseFloat(v.conversion_rate),
      })),

      risk_distribution: riskScoreDistribution.map((r) => ({
        category: r.risk_category,
        total_count: parseInt(r.count),
        paid_count: parseInt(r.paid_count),
      })),

      recent_feedback: recentFeedback.map((f) => ({
        rating: f.rating,
        text: f.feedback_text,
        would_recommend: f.would_recommend,
        created_at: f.created_at,
        vehicle: f.vehicle_model
          ? `${f.vehicle_year} ${f.vehicle_model}`
          : "Unknown",
      })),

      daily_trend: dailyTrend.map((d) => ({
        date: d.date,
        total: parseInt(d.total),
        free: parseInt(d.free),
        paid: parseInt(d.paid),
      })),

      vehicle_checkouts: vehicleCheckouts.map((v) => ({
        year: v.year,
        model: v.model,
        checkout_count: parseInt(v.checkout_count),
      })),

      report_downloads: reportDownloads.map((d) => ({
        year: d.year,
        model: d.model,
        status: d.status,
        download_count: parseInt(d.download_count),
      })),

      download_summary: {
        total_downloads: parseInt(downloadSummary[0]?.total_downloads || 0),
        free_downloads: parseInt(downloadSummary[0]?.free_downloads || 0),
        paid_downloads: parseInt(downloadSummary[0]?.paid_downloads || 0),
      },

      // Why Checkpoint funnel stats
      why_checkpoint: {
        shown: parseInt(whyCheckpointStats[0]?.why_shown || 0),
        submitted: parseInt(whyCheckpointStats[0]?.why_submitted || 0),
        skipped: parseInt(whyCheckpointStats[0]?.why_skipped || 0),
        submit_rate: whyCheckpointStats[0]?.why_shown > 0
          ? Math.round((parseInt(whyCheckpointStats[0]?.why_submitted || 0) / parseInt(whyCheckpointStats[0]?.why_shown || 1)) * 100)
          : 0,
      },

      // Form → Report generation funnel
      funnel: {
        form_submissions: parseInt(whyCheckpointStats[0]?.form_submissions || 0),
        intake_submitted: parseInt(whyCheckpointStats[0]?.intake_submitted || 0),
        report_generation_started: parseInt(whyCheckpointStats[0]?.report_gen_started || 0),
        report_generation_succeeded: parseInt(whyCheckpointStats[0]?.report_gen_succeeded || 0),
        report_generation_failed: parseInt(whyCheckpointStats[0]?.report_gen_failed || 0),
        form_validation_failed: parseInt(whyCheckpointStats[0]?.form_validation_failed || 0),
        api_errors: parseInt(whyCheckpointStats[0]?.api_errors || 0),
        success_rate: whyCheckpointStats[0]?.report_gen_started > 0
          ? Math.round((parseInt(whyCheckpointStats[0]?.report_gen_succeeded || 0) / parseInt(whyCheckpointStats[0]?.report_gen_started || 1)) * 100)
          : 0,
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
