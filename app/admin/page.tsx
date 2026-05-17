"use client";

/**
 * Admin Analytics Dashboard
 *
 * Single source of truth: fetches all data from /api/admin/summary.
 * No race conditions, no cross-referencing multiple state variables.
 */

import { useState, useEffect, useCallback, Fragment } from "react";

// ---------------------------------------------------------------------------
// Types — mirrors /api/admin/summary response
// ---------------------------------------------------------------------------

interface SummaryWindow {
  start: string;
  end: string;
  period: string;
  timezone: string;
}

interface RetentionData {
  window: string;
  start_date: string;
  end_date: string;
  total_unique_visitors: number;
  total_sessions: number;
  total_events: number;
  repeat_users: {
    total: number;
    percentage: number;
    by_visit_count: {
      "2_visits": number;
      "3_5_visits": number;
      "6_10_visits": number;
      "11_plus_visits": number;
    };
    top_power_users: Array<{
      visitor_id: string;
      visit_count: number;
      session_count: number;
      first_visit: string;
      last_visit: string;
      days_active: number;
      referrer?: string | null;
    }>;
  };
  active_users: {
    daily_active_users: number;
    weekly_active_users: number;
    monthly_active_users: number;
    dau_wau_ratio: number;
    dau_mau_ratio: number;
  };
  user_segments: {
    one_time_users: number;
    occasional_users: number;
    frequent_users: number;
    power_users: number;
  };
  session_patterns: {
    avg_sessions_per_user: number;
    avg_events_per_session: number;
  };
}

interface SummaryData {
  success: boolean;
  filter_mode?: "humans" | "all";
  window: SummaryWindow;
  overview: {
    total_receipts: number;
    total_reports: number;
    free_reports: number;
    paid_reports: number;
    unique_sessions: number;
    unique_customers_by_email: number;
  };
  revenue?: {
    total_revenue: number;
    total_transactions: number;
    pending: number;
    pending_list?: Array<{ stripe_session_id: string | null; scenario_type: string; pack_tier: string | null; amount: number; created_at: string }>;
    failed: number;
    refunded: number;
    by_product: Record<string, { count: number; revenue: number; price: number }>;
    actual: {
      revenue_per_day: number;
      revenue_per_week: number;
      revenue_per_month: number;
      conversion_rate_pct: number;
      window_days: number;
    };
    potential: {
      human_sessions_per_day: number;
      projected_receipts_per_day: number;
      projected_paid_per_day: number;
      projected_revenue_per_day: number;
      projected_revenue_per_week: number;
      projected_revenue_per_month: number;
      assumptions: string;
      upside_scenario: {
        projected_revenue_per_day: number;
        projected_revenue_per_week: number;
        projected_revenue_per_month: number;
        assumptions: string;
      };
    };
  };
  receipt_pipeline: {
    url_scrape_attempts: number;
    url_scrape_successes: number;
    url_scrape_failures: number;
    url_scrape_success_rate: number;
    receipts_generated: number;
    lint_failures: number;
    regens: number;
    copies: number;
    copies_legacy: number;
    copy_reddit_draft: number;
    copy_seller_message: number;
    copy_checklist: number;
    negotiator_copy: number;
    lint_failed_fallback_served: number;
    entry_source_breakdown?: Record<string, number>;
  };
  post_receipt_engagement: {
    receipt_result_viewed: number;
    copy: {
      checklist: number;
      reddit_draft: number;
      seller_message: number;
      negotiator_shown: number;
      negotiator_copy: number;
      total: number;
      pct_of_viewers: number;
    };
    share: {
      qr_clicked: number;
      modal_opened: number;
      link_copied: number;
      card_downloaded: number;
      pct_initiated: number;
    };
    email: {
      shown: number;
      submitted: number;
      submit_rate: number;
      pct_of_viewers: number;
    };
    save: {
      clicked: number;
      succeeded: number;
      pct_saved: number;
    };
    pdf: {
      download_clicked: number;
      pct_downloaded: number;
    };
    vin_check: {
      entered: number;
      decode_succeeded: number;
      decode_failed: number;
      recall_clicked: number;
      pct_used: number;
    };
    monetization: {
      teaser_shown: number;
      paywall_shown: number;
      paywall_dismissed: number;
      checkout_started: number;
      teaser_to_paywall_rate: number;
      paywall_to_checkout_rate: number;
    };
    feedback: {
      shown: number;
      submitted: number;
      submit_rate: number;
    };
    other: {
      contact_clicked: number;
      history_viewed: number;
    };
  };
  report_funnel: {
    form_submissions: number;
    intake_submitted: number;
    v2_score_submit: number;
    report_gen_started: number;
    report_gen_succeeded: number;
    report_gen_failed: number;
    success_rate: number;
  };
  visitors: {
    total_visits: number;
    unique_visitors: number;
    top_pages: Array<{
      page_path: string;
      view_count: number;
      unique_visitors: number;
    }>;
  };
  feedback: {
    total_feedback: number;
    avg_rating: number;
    recommendation_rate: number;
    rating_distribution: Array<{ rating: number; count: number }>;
  };
  daily_trend: Array<{
    date: string;
    receipts: number;
    reports_free: number;
    reports_paid: number;
  }>;
  top_vehicles: Array<{
    model: string;
    year: number | null;
    total_count: number;
    paid_count: number;
    free_count: number;
  }>;
  scenario_saves: { clicked: number; succeeded: number };
  saved_listings: {
    total: number;
    unique_users: number;
    by_type: { receipt: number; evroutine: number };
    top_savers: Array<{ user_id: string; count: number; latest_vehicle: string }>;
  };
  email_captures?: { submitted: number; sent: number; failed: number; auth_email_entered: number; auth_email_confirmed: number };
  email_deliveries?: {
    total: number;
    sent: number;
    failed: number;
    success_rate: number;
    unique_recipients: number;
    by_type: { receipt: number; evroutine: number };
  };
  ai_generation: {
    succeeded: number;
    failed: number;
    fallback_used: number;
    total: number;
    success_rate: number;
  };
  report_server_events?: {
    generated_success: number;
    generated_failed: number;
    generated_total: number;
    success_rate: number;
  };
  extraction_health?: {
    total_attempts: number;
    url_attempts: number;
    url_successes: number;
    url_success_rate: number;
    text_attempts: number;
    text_successes: number;
    text_success_rate: number;
    clean_url_cleans: number;
    failures_by_reason: {
      timeout: number;
      blocked_by_bot_protection: number;
      search_page: number;
      parse_failure: number;
      network_error: number;
      other: number;
    };
  };
  retention?: {
    garage_total_vehicles: number;
    garage_unique_users: number;
    my_garage_viewed: number;
    my_garage_vehicle_added: number;
    saved_scenarios_total: number;
    saved_scenarios_unique_users: number;
    save_receipt_clicked: number;
    save_receipt_succeeded: number;
    save_rate_pct: number;
    compare_started: number;
    compare_completed: number;
    high_intent_users: number;
  };
  repeat_usage?: {
    returned_in_7d: number;
    returned_in_30d: number;
    single_visit: number;
  };
  why_checkpoint?: { shown: number; submitted: number; skipped: number; submit_rate: number };
  routine_engagement: {
    total_field_completions: number;
    fields: Array<{ field_id: string; count: number }>;
    check_started: number;
    check_completed: number;
    score_viewed: number;
    result_viewed: number;
    // NEW: Comprehensive analytics (March 2026)
    form_completed: number;
    form_partial_abandon: number;
    vehicle_list_generated: number;
    vehicle_full_report_clicked: number;
    external_link_clicked: number;
    offo_dealer_viewed: number;
    offo_dealer_message_sent: number;
  };
  evfit_funnel?: {
    evfit_started: number;
    evfit_completed: number;
    completion_rate_pct: number;
    refine_completed: number;
    with_refine_pct: number;
    shortlist_saved: number;
    with_shortlist_pct: number;
    compare_started: number;
    compare_completed: number;
    compare_start_to_finish_pct: number;
    with_compare_pct: number;
    listing_saved: number;
    garage_created: number;
    anon_attached: number;
    ai_job_queued: number;
    ai_job_succeeded: number;
    ai_job_failed: number;
    ai_success_rate_pct: number;
  };
  user_segments?: {
    users_with_garage_vehicle: number;
    users_with_saved_listing: number;
    high_intent_users: number;
  };
  entry_mode: {
    total_selections: number;
    modes: Array<{ mode: string; count: number }>;
  };
  extraction_domains: Array<{
    domain: string;
    attempts: number;
    successes: number;
    failures: number;
  }>;
  attribution: Array<{
    source: string;
    event_count: number;
  }>;
  risk_distribution: Array<{
    category: string;
    total_count: number;
    paid_count: number;
  }>;
  verdict_distribution: Array<{ verdict: string; count: number }>;
  recent_feedback: Array<{
    rating: number;
    text: string;
    would_recommend: boolean;
    created_at: string;
  }>;
  recent_events: Array<{
    source: string;
    event_name: string;
    details: Record<string, unknown>;
    visitor_id: string;
    session_id: string | null;
    user_agent: string | null;
    actor_label: string;
    bot_score: number | null;
    page_path: string;
    timestamp: string;
  }>;
  session_classification: {
    total_sessions: number;
    human: number;
    likely_human: number;
    suspicious: number;
    likely_bot: number;
    human_rate: number;
  };
  engagement_bins?: {
    total_human_sessions: number;
    no_activity: number;
    scroll_only: number;
    engaged: number;
    pct_no_activity: number;
    pct_scroll_only: number;
    pct_engaged: number;
  };
  coverage: {
    sessions_with_landing_view: number;
    sessions_with_receipt_event: number;
    sessions_with_routine_event: number;
    sessions_with_copy_event: number;
    total_sessions: number;
    pct_landing: number;
    pct_receipt: number;
    pct_routine: number;
    pct_copy: number;
  };
  insights: string[];
  chat_metrics?: {
    total_sessions: number;
    total_user_messages: number;
    avg_messages_per_session: number;
    by_scenario: Record<string, number>;
    intent_distribution: Record<string, number>;
    model_distribution: Record<string, number>;
    fallback_count: number;
    fallback_rate_pct: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    chat_pass_purchases: number;
    chat_pass_revenue_cents: number;
    chat_conversion_pct: number;
  };
  homepage_funnel?: {
    landing_views: number;
    featured_deals_viewed: number;
    featured_deal_clicked: number;
    view_all_deals_clicked: number;
    deal_watch_cta_clicked: number;
    for_dealers_nav_clicked: number;
    for_dealers_page_viewed: number;
    dealer_apply_cta_clicked: number;
    deals_section_to_click_rate: number;
    dealer_apply_rate: number;
  };
  tools_engagement?: {
    charging_tool_views: number;
    charging_tool_preset_uses: number;
    charging_tool_results: number;
    charging_tool_cta_clicks: number;
    tco_tool_views: number;
    tco_tool_results: number;
    tco_breakdown_opens: number;
    tco_tool_cta_clicks: number;
    warranty_tool_views: number;
    warranty_checks: number;
    warranty_results: number;
    warranty_tweets: number;
    charging_view_to_result: number;
    warranty_view_to_check: number;
    tco_view_to_result: number;
  };
  page_reach?: {
    deals_views: number;
    news_views: number;
    news_article_clicks: number;
    routine_entry_views: number;
    routine_results_views: number;
    pricing_views: number;
    methodology_views: number;
    shortlist_views: number;
    auth_login_views: number;
    auth_signup_views: number;
    workspace_evfit_views: number;
    workspace_dealwatch_views: number;
    report_page_views: number;
    auction_result_views: number;
    copart_batch_views: number;
  };
  deal_watch?: {
    total_searches: number;
    alert_searches: number;
    unique_users: number;
    new_7d: number;
    alerts_sent_7d: number;
  };
  payments_detail?: {
    revenue_by_tier: Array<{ pack_tier: string; price_variant: string; count: number; revenue: number }>;
    cart_abandonment: { checkout_started_7d: number; paid_7d: number; abandonment_rate_pct: number };
    refunds_30d: { count: number; total_refunded: number };
    recent_payments: Array<{ amount: number; pack_tier: string; created_at: string }>;
  };
  upgrade_jobs?: {
    dead_letter_count: number;
    failed_count: number;
    pending_count: number;
    recent_dead_letters: Array<{ job_id: string; receipt_id: string; last_error: string | null; created_at: string }>;
  };
  real_users?: {
    total_registered: number;
    registered_last_7d: number;
    registered_last_30d: number;
    with_purchase: number;
    with_garage_vehicle: number;
    with_deal_watch: number;
    active_last_7d: number;
    active_last_30d: number;
  };
}

type Period = "day" | "week" | "last_30_days" | "month_to_date" | "custom";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Today",
  week: "This Week",
  last_30_days: "Last 30 Days",
  month_to_date: "Month to Date",
  custom: "Custom",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [retentionData, setRetentionData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("last_30_days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [botFilter, setBotFilter] = useState<"all" | "humans" | "bots">("humans");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Single fetch
  // -------------------------------------------------------------------------

  const fetchSummary = useCallback(
    async (key: string, selectedPeriod: Period = period, customStart?: string, customEnd?: string, selectedFilter?: "all" | "humans" | "bots") => {
      setLoading(true);
      setError("");

      try {
        // "bots" is client-side only — send "all" to server, filter in UI
        const serverFilter = (selectedFilter ?? botFilter) === "humans" ? "humans" : "all";
        let url = `/api/admin/summary?period=${selectedPeriod}&filter=${serverFilter}`;
        if (customStart) url += `&start=${customStart}`;
        if (customEnd) url += `&end=${customEnd}`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${key}` },
        });

        if (response.status === 401) {
          setError("Invalid admin key");
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        if (!response.ok) throw new Error("Failed to fetch summary");

        const data: SummaryData = await response.json();
        setSummary(data);
        setIsAuthenticated(true);
        sessionStorage.setItem("admin_api_key", key);

        // Fetch retention data in parallel
        fetchRetention(key, selectedPeriod);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [period, botFilter]
  );

  const fetchRetention = async (key: string, selectedPeriod: Period = period) => {
    try {
      const windowMap: Record<Period, string> = {
        day: "today",
        week: "week",
        last_30_days: "last_30_days",
        month_to_date: "month",
        custom: "last_30_days",
      };

      const response = await fetch(`/api/admin/user-retention?window=${windowMap[selectedPeriod]}`, {
        headers: { Authorization: `Bearer ${key}` },
      });

      if (response.ok) {
        const data: RetentionData = await response.json();
        setRetentionData(data);
      }
    } catch (err) {
      console.error("Failed to fetch retention data:", err);
    }
  };

  // -------------------------------------------------------------------------
  // Export (reads from summary state — no race condition)
  // -------------------------------------------------------------------------

  const exportData = (format: "csv" | "json") => {
    if (!summary) return;

    if (format === "json") {
      const blob = new Blob([JSON.stringify(summary, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, `offo-summary-${summary.window.period}-${new Date().toISOString().split("T")[0]}.json`);
      return;
    }

    // CSV
    const s = summary;
    const rows = [
      ["OFFO Analytics Summary"],
      ["Period", PERIOD_LABELS[period]],
      ["Window Start", s.window.start],
      ["Window End", s.window.end],
      ["Timezone", s.window.timezone],
      ["Generated At", new Date().toLocaleString()],
      [""],
      ["=== OVERVIEW ==="],
      ["Total Receipts (Deal Checker)", s.overview.total_receipts],
      ["Total Reports (EV-Risk)", s.overview.total_reports],
      ["Free Reports", s.overview.free_reports],
      ["Paid Reports", s.overview.paid_reports],
      ["Unique Sessions (Receipt)", s.overview.unique_sessions],
      ["Unique Customers (by email)", s.overview.unique_customers_by_email],
      [""],
      ["=== REVENUE ==="],
      ["Total Revenue", s.revenue ? `$${s.revenue.total_revenue.toFixed(2)}` : "n/a"],
      ["Total Transactions", s.revenue?.total_transactions ?? 0],
      ["Receipt Single Revenue", s.revenue ? `$${(s.revenue.by_product.receipt_single?.revenue ?? 0).toFixed(2)}` : "n/a"],
      ["Pending", s.revenue?.pending ?? 0],
      ["Failed", s.revenue?.failed ?? 0],
      ["Refunded", s.revenue?.refunded ?? 0],
      ["Legacy Reports Paid", s.revenue?.by_product.legacy_reports?.count ?? 0],
      ["Legacy Report Revenue", s.revenue ? `$${(s.revenue.by_product.legacy_reports?.revenue ?? 0).toFixed(2)}` : "n/a"],
      [""],
      ["=== RECEIPT PIPELINE ==="],
      ["URL Scrape Attempts", s.receipt_pipeline.url_scrape_attempts],
      ["URL Scrape Successes", s.receipt_pipeline.url_scrape_successes],
      ["URL Scrape Failures", s.receipt_pipeline.url_scrape_failures],
      ["URL Scrape Success Rate", `${s.receipt_pipeline.url_scrape_success_rate}%`],
      ["Receipts Generated", s.receipt_pipeline.receipts_generated],
      ["Lint Failures", s.receipt_pipeline.lint_failures],
      ["Regens", s.receipt_pipeline.regens],
      ["Total Copies", s.receipt_pipeline.copies],
      ["Copy Reddit Draft", s.receipt_pipeline.copy_reddit_draft],
      ["Copy Seller Message", s.receipt_pipeline.copy_seller_message],
      ["Copy Checklist", s.receipt_pipeline.copy_checklist],
      ["Copy Negotiator", s.receipt_pipeline.negotiator_copy],
      ["Lint Fallback Served", s.receipt_pipeline.lint_failed_fallback_served],
      [""],
      ["=== POST-RECEIPT ENGAGEMENT ==="],
      ["Receipt Views (base)", s.post_receipt_engagement?.receipt_result_viewed ?? 0],
      ["Copy Total", s.post_receipt_engagement?.copy?.total ?? 0],
      ["Copy Checklist", s.post_receipt_engagement?.copy?.checklist ?? 0],
      ["Copy Negotiator", s.post_receipt_engagement?.copy?.negotiator_copy ?? 0],
      ["Copy Reddit Draft", s.post_receipt_engagement?.copy?.reddit_draft ?? 0],
      ["Copy Seller Message", s.post_receipt_engagement?.copy?.seller_message ?? 0],
      ["Copy % of Viewers", `${s.post_receipt_engagement?.copy?.pct_of_viewers ?? 0}%`],
      ["Share QR Clicked", s.post_receipt_engagement?.share?.qr_clicked ?? 0],
      ["Share Link Copied", s.post_receipt_engagement?.share?.link_copied ?? 0],
      ["Share Card Downloaded", s.post_receipt_engagement?.share?.card_downloaded ?? 0],
      ["Email Capture Shown", s.post_receipt_engagement?.email?.shown ?? 0],
      ["Email Capture Submitted", s.post_receipt_engagement?.email?.submitted ?? 0],
      ["Email Submit Rate", `${s.post_receipt_engagement?.email?.submit_rate ?? 0}%`],
      ["Save Clicked", s.post_receipt_engagement?.save?.clicked ?? 0],
      ["Save Succeeded", s.post_receipt_engagement?.save?.succeeded ?? 0],
      ["PDF Downloaded", s.post_receipt_engagement?.pdf?.download_clicked ?? 0],
      ["VIN Entered", s.post_receipt_engagement?.vin_check?.entered ?? 0],
      ["VIN Decode Succeeded", s.post_receipt_engagement?.vin_check?.decode_succeeded ?? 0],
      ["VIN Decode Failed", s.post_receipt_engagement?.vin_check?.decode_failed ?? 0],
      ["Teaser Shown", s.post_receipt_engagement?.monetization?.teaser_shown ?? 0],
      ["Paywall Shown", s.post_receipt_engagement?.monetization?.paywall_shown ?? 0],
      ["Paywall Dismissed", s.post_receipt_engagement?.monetization?.paywall_dismissed ?? 0],
      ["Checkout Started", s.post_receipt_engagement?.monetization?.checkout_started ?? 0],
      ["Feedback Shown", s.post_receipt_engagement?.feedback?.shown ?? 0],
      ["Feedback Submitted", s.post_receipt_engagement?.feedback?.submitted ?? 0],
      [""],
      ["=== REPORT FUNNEL (Legacy EV-Risk) ==="],
      ["Form Submissions", s.report_funnel.form_submissions],
      ["Report Gen Started", s.report_funnel.report_gen_started],
      ["Report Gen Succeeded", s.report_funnel.report_gen_succeeded],
      ["Report Gen Failed", s.report_funnel.report_gen_failed],
      ["Success Rate", `${s.report_funnel.success_rate}%`],
      [""],
      ["=== VISITORS ==="],
      ["Total Visits", s.visitors.total_visits],
      ["Unique Visitors", s.visitors.unique_visitors],
      [""],
      ["=== WHY CHECKPOINT ==="],
      ["Shown", s.why_checkpoint?.shown ?? 0],
      ["Submitted", s.why_checkpoint?.submitted ?? 0],
      ["Skipped", s.why_checkpoint?.skipped ?? 0],
      ["Submit Rate", `${s.why_checkpoint?.submit_rate ?? 0}%`],
      [""],
      ["=== FEEDBACK ==="],
      ["Average Rating", s.feedback.avg_rating.toFixed(1)],
      ["Total Feedback", s.feedback.total_feedback],
      ["Recommendation Rate", `${s.feedback.recommendation_rate}%`],
      [""],
      ["=== SAVED LISTINGS ==="],
      ["Total Saved", s.saved_listings.total],
      ["Unique Users", s.saved_listings.unique_users],
      ["Receipt Saves", s.saved_listings.by_type.receipt],
      ["EVRoutine Saves", s.saved_listings.by_type.evroutine],
      ["Save Clicked (events)", s.scenario_saves.clicked],
      ["Save Succeeded (events)", s.scenario_saves.succeeded],
      [""],
      ["=== EMAIL DELIVERIES ==="],
      ["Total Emails", s.email_deliveries?.total ?? 0],
      ["Sent", s.email_deliveries?.sent ?? 0],
      ["Failed", s.email_deliveries?.failed ?? 0],
      ["Success Rate", `${s.email_deliveries?.success_rate ?? 0}%`],
      ["Unique Recipients", s.email_deliveries?.unique_recipients ?? 0],
      ["Receipt Emails", s.email_deliveries?.by_type.receipt ?? 0],
      ["EVRoutine Emails", s.email_deliveries?.by_type.evroutine ?? 0],
      [""],
      ["=== EMAIL EVENTS ==="],
      ["Submitted (client)", s.email_captures?.submitted ?? 0],
      ["Sent (client)", s.email_captures?.sent ?? 0],
      ["Failed (client)", s.email_captures?.failed ?? 0],
      ["Auth Email Entered", s.email_captures?.auth_email_entered ?? 0],
      ["Auth Email Confirmed", s.email_captures?.auth_email_confirmed ?? 0],
      [""],
      ["=== AI GENERATION ==="],
      ["Generation Total", s.ai_generation?.total ?? 0],
      ["Generation Succeeded", s.ai_generation?.succeeded ?? 0],
      ["Generation Failed", s.ai_generation?.failed ?? 0],
      ["Generation Success Rate", `${s.ai_generation?.success_rate ?? 0}%`],
      ["Fallback Used", s.ai_generation?.fallback_used ?? 0],
      [""],
      ["=== SERVER-SIDE REPORT EVENTS ==="],
      ["Generated Total", s.report_server_events?.generated_total ?? 0],
      ["Generated Success", s.report_server_events?.generated_success ?? 0],
      ["Generated Failed", s.report_server_events?.generated_failed ?? 0],
      ["Success Rate", `${s.report_server_events?.success_rate ?? 0}%`],
      [""],
      ["=== ROUTINE ENGAGEMENT ==="],
      ["Check Started", s.routine_engagement?.check_started ?? 0],
      ["Check Completed", s.routine_engagement?.check_completed ?? 0],
      ["Score Viewed", s.routine_engagement?.score_viewed ?? 0],
      ["Total Field Completions", s.routine_engagement?.total_field_completions ?? 0],
      [""],
      ["=== NEW ANALYTICS (March 2026) ==="],
      ["Form Completed", s.routine_engagement?.form_completed ?? 0],
      ["Form Partial Abandon", s.routine_engagement?.form_partial_abandon ?? 0],
      ["Vehicle Lists Generated", s.routine_engagement?.vehicle_list_generated ?? 0],
      ["Full Report Clicks", s.routine_engagement?.vehicle_full_report_clicked ?? 0],
      ["External Link Clicks", s.routine_engagement?.external_link_clicked ?? 0],
      ["Dealer Views", s.routine_engagement?.offo_dealer_viewed ?? 0],
      ["Dealer Messages", s.routine_engagement?.offo_dealer_message_sent ?? 0],
      [""],
      ["=== ENTRY MODE ==="],
      ["Total Mode Selections", s.entry_mode?.total_selections ?? 0],
      [""],
      ["=== ATTRIBUTION ==="],
      ...(s.attribution || []).map((a) => [a.source, a.event_count] as [string, number]),
      [""],
      ["=== SESSION CLASSIFICATION ==="],
      ["Total Sessions", s.session_classification?.total_sessions ?? 0],
      ["Human", s.session_classification?.human ?? 0],
      ["Likely Human", s.session_classification?.likely_human ?? 0],
      ["Suspicious", s.session_classification?.suspicious ?? 0],
      ["Likely Bot", s.session_classification?.likely_bot ?? 0],
      ["Human Rate", `${s.session_classification?.human_rate ?? 0}%`],
      [""],
      ["=== EVENT COVERAGE ==="],
      ["Landing View Coverage", `${s.coverage?.pct_landing ?? 0}%`],
      ["Receipt Coverage", `${s.coverage?.pct_receipt ?? 0}%`],
      ["Routine Coverage", `${s.coverage?.pct_routine ?? 0}%`],
      ["Copy Coverage", `${s.coverage?.pct_copy ?? 0}%`],
    ];

    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `offo-summary-${summary.window.period}-${new Date().toISOString().split("T")[0]}.csv`);
  };

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // -------------------------------------------------------------------------
  // Period change
  // -------------------------------------------------------------------------

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    setShowCustomDate(newPeriod === "custom");
    const storedKey = sessionStorage.getItem("admin_api_key");
    if (storedKey && newPeriod !== "custom") {
      fetchSummary(storedKey, newPeriod);
    }
  };

  const handleCustomDateFilter = () => {
    const storedKey = sessionStorage.getItem("admin_api_key");
    if (storedKey && startDate && endDate) {
      fetchSummary(storedKey, "custom", startDate, endDate);
    }
  };

  // -------------------------------------------------------------------------
  // On mount
  // -------------------------------------------------------------------------

  useEffect(() => {
    const storedKey = sessionStorage.getItem("admin_api_key");
    if (storedKey) {
      setApiKey(storedKey);
      fetchSummary(storedKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSummary(apiKey);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600 mb-6">Enter your admin API key to access analytics</p>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Admin API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admin key..."
                required
              />
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400">
              {loading ? "Authenticating..." : "Access Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const s = summary;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">OFFO Analytics</h1>
              <p className="text-gray-500 text-sm mt-1">
                {new Date(s.window.start).toLocaleDateString()} — {new Date(s.window.end).toLocaleDateString()} ({s.window.timezone})
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Metrics filter:</span>
                <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
                  {(["humans", "all"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setBotFilter(f);
                        setExpandedRow(null);
                        const storedKey = sessionStorage.getItem("admin_api_key");
                        if (storedKey) fetchSummary(storedKey, period, undefined, undefined, f);
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        botFilter === f ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {f === "humans" ? "Humans Only" : "All (incl. bots)"}
                    </button>
                  ))}
                </div>
                {s.filter_mode && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    s.filter_mode === "humans" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {s.filter_mode === "humans" ? "Bot-filtered" : "Raw data"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                    period === p ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Export + Tools */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Export current view — data matches what you see on screen</p>
            <div className="flex gap-2 flex-wrap">
              <a href="/admin/reddit" className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium">
                ⚡ Reddit Operator
              </a>
              <a href="/admin/news" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
                📰 News
              </a>
              <button onClick={() => exportData("csv")} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                Export CSV
              </button>
              <button onClick={() => exportData("json")} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                Export JSON
              </button>
            </div>
          </div>

          {/* Custom Date */}
          {showCustomDate && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={handleCustomDateFilter} disabled={!startDate || !endDate} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400">
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard title="Receipts Generated" value={s.receipt_pipeline.receipts_generated} subtitle={`${s.overview.unique_sessions} unique sessions`} icon="🧾" />
          <MetricCard title="Unique Visitors" value={s.visitors.unique_visitors} subtitle={`${s.visitors.total_visits} total visits`} icon="👥" />
          <MetricCard title="Human Rate" value={`${s.session_classification?.human_rate ?? 0}%`} subtitle={`${s.session_classification?.human ?? 0} confirmed human · ${s.session_classification?.likely_human ?? 0} likely`} icon="🧠" />
          <MetricCard title="AI Success Rate" value={`${s.ai_generation?.success_rate ?? 0}%`} subtitle={`${s.ai_generation?.succeeded ?? 0} ok · ${s.ai_generation?.failed ?? 0} failed`} icon="⚡" />
        </div>

        {/* Quick Summary / Insights */}
        {s.insights && s.insights.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-blue-400">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Quick Summary</h2>
            <ul className="space-y-2">
              {s.insights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5 shrink-0">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upgrade Job Health — shown prominently when action is needed */}
        {s.upgrade_jobs && (s.upgrade_jobs.dead_letter_count > 0 || s.upgrade_jobs.failed_count > 0) && (
          <div className={`rounded-2xl shadow-lg p-5 mb-6 border-l-4 ${s.upgrade_jobs.dead_letter_count > 0 ? "bg-red-50 border-red-500" : "bg-amber-50 border-amber-400"}`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">
                  {s.upgrade_jobs.dead_letter_count > 0 ? "⚠️ Upgrade Job Failures" : "🔄 Upgrade Jobs Pending"}
                </h2>
                <p className="text-sm text-gray-600 mb-3">
                  {s.upgrade_jobs.dead_letter_count > 0
                    ? `${s.upgrade_jobs.dead_letter_count} job(s) exhausted all retries — users may have paid without getting a full AI receipt.`
                    : `${s.upgrade_jobs.failed_count} failed job(s) queued for retry by the scanner.`}
                </p>
              </div>
              <div className="flex gap-3 ml-4 shrink-0">
                {s.upgrade_jobs.dead_letter_count > 0 && (
                  <span className="bg-red-100 text-red-800 text-sm font-semibold px-3 py-1 rounded-full">
                    {s.upgrade_jobs.dead_letter_count} dead-lettered
                  </span>
                )}
                {s.upgrade_jobs.failed_count > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-sm font-semibold px-3 py-1 rounded-full">
                    {s.upgrade_jobs.failed_count} failed
                  </span>
                )}
                {s.upgrade_jobs.pending_count > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
                    {s.upgrade_jobs.pending_count} pending
                  </span>
                )}
              </div>
            </div>
            {s.upgrade_jobs.recent_dead_letters.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dead-lettered Jobs</h3>
                <div className="space-y-2">
                  {s.upgrade_jobs.recent_dead_letters.map((j) => (
                    <div key={j.job_id} className="flex items-center justify-between bg-white rounded-lg p-3 text-sm border border-red-100">
                      <div>
                        <span className="font-mono text-gray-700 text-xs">{j.receipt_id}</span>
                        {j.last_error && (
                          <span className="ml-2 text-red-600 text-xs">{j.last_error}</span>
                        )}
                      </div>
                      <span className="text-gray-400 text-xs shrink-0 ml-3">{new Date(j.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* All clear — show quiet confirmation when job queue is healthy */}
        {s.upgrade_jobs && s.upgrade_jobs.dead_letter_count === 0 && s.upgrade_jobs.failed_count === 0 && (
          <div className="rounded-2xl bg-green-50 border border-green-200 p-4 mb-6 flex items-center gap-3">
            <span className="text-green-600 text-lg">✓</span>
            <span className="text-sm text-green-800 font-medium">Upgrade job queue healthy — no dead-letters or failed jobs.</span>
            {s.upgrade_jobs.pending_count > 0 && (
              <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{s.upgrade_jobs.pending_count} pending</span>
            )}
          </div>
        )}

        {/* ── Real Users ── */}
        {s.real_users && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 mb-0.5">Real Users</h2>
              <p className="text-sm text-gray-500">Authenticated accounts (email-confirmed, excludes internal team)</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-indigo-700">{s.real_users.total_registered}</div>
                <div className="text-xs font-semibold text-indigo-500 mt-1">Total Registered</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-green-700">+{s.real_users.registered_last_7d}</div>
                <div className="text-xs font-semibold text-green-600 mt-1">New Last 7 Days</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-blue-700">+{s.real_users.registered_last_30d}</div>
                <div className="text-xs font-semibold text-blue-600 mt-1">New Last 30 Days</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4">
                <div className="text-3xl font-bold text-emerald-700">{s.real_users.with_purchase}</div>
                <div className="text-xs font-semibold text-emerald-600 mt-1">Paid Customers</div>
                <div className="text-xs text-emerald-500 mt-0.5">
                  {s.real_users.total_registered > 0
                    ? `${Math.round((s.real_users.with_purchase / s.real_users.total_registered) * 100)}% conversion`
                    : "—"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-700">{s.real_users.active_last_7d}</div>
                <div className="text-xs font-semibold text-gray-500 mt-1">Active Last 7d</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {s.real_users.total_registered > 0
                    ? `${Math.round((s.real_users.active_last_7d / s.real_users.total_registered) * 100)}% of registered`
                    : "—"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-700">{s.real_users.active_last_30d}</div>
                <div className="text-xs font-semibold text-gray-500 mt-1">Active Last 30d</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {s.real_users.total_registered > 0
                    ? `${Math.round((s.real_users.active_last_30d / s.real_users.total_registered) * 100)}% of registered`
                    : "—"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-700">{s.real_users.with_garage_vehicle}</div>
                <div className="text-xs font-semibold text-gray-500 mt-1">With Garage Vehicle</div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-2xl font-bold text-gray-700">{s.real_users.with_deal_watch}</div>
                <div className="text-xs font-semibold text-gray-500 mt-1">Using Deal Watch</div>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 1: Acquisition Overview ── */}
        <div className="mb-2 mt-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Section 1 · Acquisition Overview</h2>
        </div>

        {/* Engagement Bins */}
        {s.engagement_bins && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Engagement Bins</h2>
            <p className="text-sm text-gray-500 mb-4">Human sessions only — how far users got before leaving</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-600 mb-0.5">{s.engagement_bins.no_activity}</div>
                <div className="text-sm font-semibold text-red-800 mb-1">No Activity</div>
                <div className="text-xs text-red-600 mb-2">Landed · no scroll · no click</div>
                <div className="text-lg font-bold text-red-700">{s.engagement_bins.pct_no_activity}%</div>
                <div className="w-full bg-red-100 rounded-full h-1.5 mt-2">
                  <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${s.engagement_bins.pct_no_activity}%` }} />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="text-2xl font-bold text-amber-600 mb-0.5">{s.engagement_bins.scroll_only}</div>
                <div className="text-sm font-semibold text-amber-800 mb-1">Scroll Only</div>
                <div className="text-xs text-amber-600 mb-2">Scrolled past 25% · no interaction</div>
                <div className="text-lg font-bold text-amber-700">{s.engagement_bins.pct_scroll_only}%</div>
                <div className="w-full bg-amber-100 rounded-full h-1.5 mt-2">
                  <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${s.engagement_bins.pct_scroll_only}%` }} />
                </div>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600 mb-0.5">{s.engagement_bins.engaged}</div>
                <div className="text-sm font-semibold text-green-800 mb-1">Engaged</div>
                <div className="text-xs text-green-600 mb-2">Clicked or typed · active interaction</div>
                <div className="text-lg font-bold text-green-700">{s.engagement_bins.pct_engaged}%</div>
                <div className="w-full bg-green-100 rounded-full h-1.5 mt-2">
                  <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${s.engagement_bins.pct_engaged}%` }} />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Based on {s.engagement_bins.total_human_sessions} human sessions · signals: scroll_depth_25, first_interaction</p>
          </div>
        )}


        {/* User Retention & Engagement */}
        {retentionData && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-indigo-400">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">User Retention & Engagement</h2>
            <p className="text-sm text-gray-500 mb-4">
              Tracking repeated users, active users, and engagement patterns
            </p>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium mb-1">Total Unique Users</p>
                <p className="text-3xl font-bold text-blue-900">{retentionData.total_unique_visitors}</p>
                <p className="text-xs text-blue-700 mt-1">Last 30 days</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-medium mb-1">Repeat Users</p>
                <p className="text-3xl font-bold text-purple-900">{retentionData.repeat_users.total}</p>
                <p className="text-xs text-purple-700 mt-1">{retentionData.repeat_users.percentage}% of total</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Daily Active Users</p>
                <p className="text-3xl font-bold text-green-900">{retentionData.active_users.daily_active_users}</p>
                <p className="text-xs text-green-700 mt-1">Today</p>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-sm text-indigo-600 font-medium mb-1">DAU/MAU Ratio</p>
                <p className="text-3xl font-bold text-indigo-900">{Math.round(retentionData.active_users.dau_mau_ratio * 100)}%</p>
                <p className="text-xs text-indigo-700 mt-1">Stickiness</p>
              </div>
            </div>

            {/* Active Users Breakdown */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Users Breakdown</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                <FunnelCard label="DAU" value={retentionData.active_users.daily_active_users} color="green" subtitle="Daily" />
                <FunnelCard label="WAU" value={retentionData.active_users.weekly_active_users} color="blue" subtitle="Weekly" />
                <FunnelCard label="MAU" value={retentionData.active_users.monthly_active_users} color="purple" subtitle="Monthly" />
                <FunnelCard label="DAU/WAU" value={`${Math.round(retentionData.active_users.dau_wau_ratio * 100)}%`} color="indigo" subtitle="Stickiness" />
                <FunnelCard label="DAU/MAU" value={`${Math.round(retentionData.active_users.dau_mau_ratio * 100)}%`} color="indigo" subtitle="Stickiness" />
              </div>
            </div>

            {/* User Segmentation */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">User Segments by Visit Count</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 font-medium mb-1">One-time Users</p>
                    <p className="text-2xl font-bold text-gray-900">{retentionData.user_segments.one_time_users}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {Math.round((retentionData.user_segments.one_time_users / retentionData.total_unique_visitors) * 100)}% of total
                    </p>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 rounded-b-xl"
                    style={{ width: `${(retentionData.user_segments.one_time_users / retentionData.total_unique_visitors) * 100}%` }}
                  />
                </div>
                <div className="relative">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-sm text-blue-600 font-medium mb-1">Occasional (2-5)</p>
                    <p className="text-2xl font-bold text-blue-900">{retentionData.user_segments.occasional_users}</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {Math.round((retentionData.user_segments.occasional_users / retentionData.total_unique_visitors) * 100)}% of total
                    </p>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400 rounded-b-xl"
                    style={{ width: `${(retentionData.user_segments.occasional_users / retentionData.total_unique_visitors) * 100}%` }}
                  />
                </div>
                <div className="relative">
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-sm text-green-600 font-medium mb-1">Frequent (6-10)</p>
                    <p className="text-2xl font-bold text-green-900">{retentionData.user_segments.frequent_users}</p>
                    <p className="text-xs text-green-700 mt-1">
                      {Math.round((retentionData.user_segments.frequent_users / retentionData.total_unique_visitors) * 100)}% of total
                    </p>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-green-400 rounded-b-xl"
                    style={{ width: `${(retentionData.user_segments.frequent_users / retentionData.total_unique_visitors) * 100}%` }}
                  />
                </div>
                <div className="relative">
                  <div className="bg-purple-50 rounded-xl p-4">
                    <p className="text-sm text-purple-600 font-medium mb-1">Power (11+)</p>
                    <p className="text-2xl font-bold text-purple-900">{retentionData.user_segments.power_users}</p>
                    <p className="text-xs text-purple-700 mt-1">
                      {Math.round((retentionData.user_segments.power_users / retentionData.total_unique_visitors) * 100)}% of total
                    </p>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-purple-400 rounded-b-xl"
                    style={{ width: `${(retentionData.user_segments.power_users / retentionData.total_unique_visitors) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Repeat User Breakdown */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Repeat Users by Visit Count</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FunnelCard label="2 Visits" value={retentionData.repeat_users.by_visit_count["2_visits"]} color="blue" />
                <FunnelCard label="3-5 Visits" value={retentionData.repeat_users.by_visit_count["3_5_visits"]} color="indigo" />
                <FunnelCard label="6-10 Visits" value={retentionData.repeat_users.by_visit_count["6_10_visits"]} color="purple" />
                <FunnelCard label="11+ Visits" value={retentionData.repeat_users.by_visit_count["11_plus_visits"]} color="purple" />
              </div>
            </div>

            {/* Session Patterns */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Session Patterns</h3>
              <div className="grid grid-cols-2 gap-3">
                <FunnelCard
                  label="Avg Sessions per User"
                  value={retentionData.session_patterns.avg_sessions_per_user.toFixed(1)}
                  color="gray"
                />
                <FunnelCard
                  label="Avg Events per Session"
                  value={retentionData.session_patterns.avg_events_per_session.toFixed(1)}
                  color="gray"
                />
              </div>
            </div>

            {/* Top Power Users Table */}
            {retentionData.repeat_users.top_power_users.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Power Users (Most Active)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Visitor ID</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">Visits</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">Sessions</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">Days Active</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700">Last Visit</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">Referrer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retentionData.repeat_users.top_power_users.slice(0, 10).map((user, idx) => {
                        const lastVisit = new Date(user.last_visit);
                        const daysAgo = Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-xs text-gray-600">
                              {user.visitor_id.substring(0, 16)}...
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-purple-600">
                              {user.visit_count}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {user.session_count}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {user.days_active}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600 text-xs">
                              {daysAgo === 0 ? "today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500 max-w-[180px]">
                              {user.referrer ? (
                                (() => {
                                  try {
                                    const h = new URL(user.referrer).hostname.replace(/^www\./, "");
                                    return <span title={user.referrer}>{h}</span>;
                                  } catch {
                                    return <span className="truncate block" title={user.referrer}>{user.referrer}</span>;
                                  }
                                })()
                              ) : (
                                <span className="text-gray-300">direct</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 2: Extraction Health ── */}
        <div className="mb-2 mt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Section 2 · Extraction Health</h2>
        </div>

        {/* Receipt Pipeline */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Receipt Pipeline</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <FunnelCard label="URL Scrapes" value={s.receipt_pipeline.url_scrape_attempts} color="blue" />
            <FunnelCard label="Scrape Success" value={`${s.receipt_pipeline.url_scrape_success_rate}%`} color="green" />
            <FunnelCard label="Receipts Generated" value={s.receipt_pipeline.receipts_generated} color="purple" />
            <FunnelCard label="Lint Failures" value={s.receipt_pipeline.lint_failures} color="red" />
            <FunnelCard label="Lint Fallback" value={s.receipt_pipeline.lint_failed_fallback_served} color="amber" />
            <FunnelCard label="Copy (Total)" value={s.receipt_pipeline.copies} color="indigo"
              subtitle={s.receipt_pipeline.copies_legacy > (s.receipt_pipeline.copy_reddit_draft + s.receipt_pipeline.copy_seller_message + s.receipt_pipeline.copy_checklist + s.receipt_pipeline.negotiator_copy)
                ? `${s.receipt_pipeline.copies_legacy - (s.receipt_pipeline.copy_reddit_draft + s.receipt_pipeline.copy_seller_message + s.receipt_pipeline.copy_checklist + s.receipt_pipeline.negotiator_copy)} pre-tracking`
                : undefined}
            />
            <FunnelCard label="Regens" value={s.receipt_pipeline.regens} color="gray" />
            <FunnelCard
              label="Copy Breakdown"
              value={`${s.receipt_pipeline.copy_checklist}/${s.receipt_pipeline.negotiator_copy}/${s.receipt_pipeline.copy_reddit_draft}/${s.receipt_pipeline.copy_seller_message}`}
              color="emerald"
              subtitle="Check / Nego / Reddit / Seller"
            />
          </div>

          {/* Entry Source Breakdown */}
          {s.receipt_pipeline.entry_source_breakdown && Object.keys(s.receipt_pipeline.entry_source_breakdown).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Entry Source Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(s.receipt_pipeline.entry_source_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([src, count]) => {
                    const total = s.receipt_pipeline.receipts_generated || 1;
                    const pct = Math.round((count / total) * 100);
                    const colorMap: Record<string, string> = {
                      homepage: "bg-blue-50 border-blue-200 text-blue-700",
                      deal_watch: "bg-emerald-50 border-emerald-200 text-emerald-700",
                      extension: "bg-purple-50 border-purple-200 text-purple-700",
                      direct_url: "bg-amber-50 border-amber-200 text-amber-700",
                      unknown: "bg-gray-50 border-gray-200 text-gray-500",
                    };
                    const cls = colorMap[src] ?? "bg-gray-50 border-gray-200 text-gray-500";
                    return (
                      <div key={src} className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>
                        <span className="font-semibold">{src.replace(/_/g, " ")}</span>
                        <span className="ml-2 font-bold">{count}</span>
                        <span className="ml-1 text-xs opacity-60">({pct}%)</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Extraction Health */}
        {s.extraction_health && s.extraction_health.total_attempts > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-cyan-400">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Extraction Health</h2>
            <p className="text-sm text-gray-500 mb-4">URL vs. text mode success rates + failure breakdown</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <FunnelCard label="URL Success Rate" value={`${s.extraction_health.url_success_rate}%`} color={s.extraction_health.url_success_rate >= 70 ? "green" : s.extraction_health.url_success_rate >= 40 ? "amber" : "red"} subtitle={`${s.extraction_health.url_successes}/${s.extraction_health.url_attempts} attempts`} />
              <FunnelCard label="Text Success Rate" value={`${s.extraction_health.text_success_rate}%`} color="green" subtitle={`${s.extraction_health.text_successes}/${s.extraction_health.text_attempts} attempts`} />
              <FunnelCard label="Clean URL Conversions" value={s.extraction_health.clean_url_cleans} color="teal" subtitle="messy_url_cleaned events" />
              <FunnelCard label="Total Attempts" value={s.extraction_health.total_attempts} color="blue" />
            </div>
            {Object.values(s.extraction_health.failures_by_reason).some(v => v > 0) && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Failure Reasons</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <FunnelCard label="Timeout" value={s.extraction_health.failures_by_reason.timeout} color="red" />
                  <FunnelCard label="Bot Protected" value={s.extraction_health.failures_by_reason.blocked_by_bot_protection} color="amber" />
                  <FunnelCard label="Search Page" value={s.extraction_health.failures_by_reason.search_page} color="amber" />
                  <FunnelCard label="Parse Failure" value={s.extraction_health.failures_by_reason.parse_failure} color="red" />
                  <FunnelCard label="Network Error" value={s.extraction_health.failures_by_reason.network_error} color="gray" />
                  <FunnelCard label="Other" value={s.extraction_health.failures_by_reason.other} color="gray" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 3: Routine & Fit Engagement ── */}
        <div className="mb-2 mt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Section 3 · Routine &amp; Fit Engagement</h2>
        </div>

        {/* Post-Receipt Engagement Funnel */}
        {s.post_receipt_engagement && s.post_receipt_engagement.receipt_result_viewed > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-orange-400">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Post-Receipt Engagement</h2>
            <p className="text-sm text-gray-500 mb-4">
              What users do after viewing their receipt ({s.post_receipt_engagement.receipt_result_viewed} views)
            </p>

            {/* Copy Actions */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Copy Actions ({s.post_receipt_engagement.copy.pct_of_viewers}% of viewers)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <FunnelCard label="Checklist" value={s.post_receipt_engagement.copy.checklist} color="green" />
                <FunnelCard label="Negotiator" value={s.post_receipt_engagement.copy.negotiator_copy} color="emerald" />
                <FunnelCard label="Reddit Draft" value={s.post_receipt_engagement.copy.reddit_draft} color="green" />
                <FunnelCard label="Seller Msg" value={s.post_receipt_engagement.copy.seller_message} color="green" />
                <FunnelCard label="Total Copies" value={s.post_receipt_engagement.copy.total} color="emerald"
                  subtitle={`${s.post_receipt_engagement.copy.pct_of_viewers}% of viewers`} />
              </div>
            </div>

            {/* Share */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Share ({s.post_receipt_engagement.share.pct_initiated}% initiated)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FunnelCard label="QR Clicked" value={s.post_receipt_engagement.share.qr_clicked} color="purple" />
                <FunnelCard label="Modal Opened" value={s.post_receipt_engagement.share.modal_opened} color="purple" />
                <FunnelCard label="Link Copied" value={s.post_receipt_engagement.share.link_copied} color="indigo" />
                <FunnelCard label="Card Downloaded" value={s.post_receipt_engagement.share.card_downloaded} color="indigo" />
              </div>
            </div>

            {/* Email + Save + PDF + VIN */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Capture & Save</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <FunnelCard label="Email Shown" value={s.post_receipt_engagement.email.shown} color="blue" />
                <FunnelCard label="Email Submitted" value={s.post_receipt_engagement.email.submitted} color="blue"
                  subtitle={`${s.post_receipt_engagement.email.submit_rate}% rate`} />
                <FunnelCard label="Save Clicked" value={s.post_receipt_engagement.save.clicked} color="indigo" />
                <FunnelCard label="Save Succeeded" value={s.post_receipt_engagement.save.succeeded} color="indigo"
                  subtitle={`${s.post_receipt_engagement.save.pct_saved}% of viewers`} />
                <FunnelCard label="PDF Download" value={s.post_receipt_engagement.pdf.download_clicked} color="gray"
                  subtitle={`${s.post_receipt_engagement.pdf.pct_downloaded}% of viewers`} />
                <FunnelCard label="VIN Checked" value={s.post_receipt_engagement.vin_check.entered} color="amber"
                  subtitle={`${s.post_receipt_engagement.vin_check.pct_used}% of viewers`} />
              </div>
            </div>

            {/* Monetization Funnel */}
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Monetization Funnel</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <FunnelCard label="Teaser Shown" value={s.post_receipt_engagement.monetization.teaser_shown} color="amber" />
                <FunnelCard label="Paywall Shown" value={s.post_receipt_engagement.monetization.paywall_shown} color="amber"
                  subtitle={`${s.post_receipt_engagement.monetization.teaser_to_paywall_rate}% of teaser`} />
                <FunnelCard label="Paywall Dismissed" value={s.post_receipt_engagement.monetization.paywall_dismissed} color="red" />
                <FunnelCard label="Checkout Started" value={s.post_receipt_engagement.monetization.checkout_started} color="green"
                  subtitle={`${s.post_receipt_engagement.monetization.paywall_to_checkout_rate}% of paywall`} />
                <FunnelCard label="Paid" value={s.revenue?.total_transactions ?? 0} color="green"
                  subtitle={s.revenue ? `$${s.revenue.total_revenue.toFixed(2)} confirmed` : undefined} />
              </div>
            </div>

            {/* Revenue breakdown + projections */}
            {s.revenue && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Revenue — Actual vs. Potential</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <FunnelCard label="Total Revenue" value={`$${s.revenue.total_revenue.toFixed(2)}`} color="green" subtitle={`${s.revenue.total_transactions} paid transactions`} />
                  <FunnelCard label="Rev / Day (actual)" value={`$${s.revenue.actual.revenue_per_day.toFixed(2)}`} color="green" subtitle={`${s.revenue.actual.window_days}d window`} />
                  <FunnelCard label="Rev / Month (actual)" value={`$${s.revenue.actual.revenue_per_month.toFixed(2)}`} color="green" subtitle={`${s.revenue.actual.conversion_rate_pct}% conversion`} />
                  <FunnelCard label="Pending Checkouts" value={s.revenue.pending} color="amber" subtitle={`${s.revenue.failed} failed · ${s.revenue.refunded} refunded`} />
                </div>
                {s.revenue.pending > 0 && s.revenue.pending_list && s.revenue.pending_list.length > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-2">Stuck Pending Payments — click Fulfill to manually complete</p>
                    <div className="space-y-2">
                      {s.revenue.pending_list.map((p, i) => (
                        <div key={p.stripe_session_id ?? i} className="flex items-center justify-between gap-3 bg-white rounded border border-amber-100 px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="font-mono text-gray-500 truncate block">{p.stripe_session_id ?? "no session id"}</span>
                            <span className="text-gray-400">{p.scenario_type} · {p.pack_tier ?? "—"} · ${(p.amount / 100).toFixed(2)} · {new Date(p.created_at).toLocaleDateString()}</span>
                          </div>
                          {p.stripe_session_id && (
                            <button
                              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded"
                              onClick={async () => {
                                const res = await fetch("/api/admin/fulfill-purchase", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
                                  body: JSON.stringify({ stripe_session_id: p.stripe_session_id }),
                                });
                                const json = await res.json();
                                if (res.ok) {
                                  alert(`✅ Fulfilled! purchase_id: ${json.purchase_id}`);
                                } else {
                                  alert(`❌ Error: ${json.error ?? "unknown"}`);
                                }
                              }}
                            >
                              Fulfill
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
                  <p className="font-semibold text-gray-600 mb-2">Projections (based on {s.revenue.potential.human_sessions_per_day} human sessions/day)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 mb-1">Conservative — {s.revenue.potential.assumptions}</p>
                      <p>Daily: <span className="font-semibold text-gray-700">${s.revenue.potential.projected_revenue_per_day.toFixed(2)}</span></p>
                      <p>Weekly: <span className="font-semibold text-gray-700">${s.revenue.potential.projected_revenue_per_week.toFixed(2)}</span></p>
                      <p>Monthly: <span className="font-semibold text-gray-700">${s.revenue.potential.projected_revenue_per_month.toFixed(2)}</span></p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">Upside — {s.revenue.potential.upside_scenario.assumptions}</p>
                      <p>Daily: <span className="font-semibold text-emerald-600">${s.revenue.potential.upside_scenario.projected_revenue_per_day.toFixed(2)}</span></p>
                      <p>Weekly: <span className="font-semibold text-emerald-600">${s.revenue.potential.upside_scenario.projected_revenue_per_week.toFixed(2)}</span></p>
                      <p>Monthly: <span className="font-semibold text-emerald-600">${s.revenue.potential.upside_scenario.projected_revenue_per_month.toFixed(2)}</span></p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
                  {Object.entries(s.revenue.by_product).map(([key, prod]) => (
                    <div key={key} className="rounded border border-gray-100 bg-white p-2 text-center">
                      <p className="text-[10px] text-gray-400 truncate">{key.replace(/_/g, " ")}</p>
                      <p className="text-sm font-bold text-gray-700">{prod.count}</p>
                      <p className="text-[10px] text-emerald-600">${prod.revenue.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-300">${prod.price}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Feedback & Other</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FunnelCard label="Feedback Shown" value={s.post_receipt_engagement.feedback.shown} color="gray" />
                <FunnelCard label="Feedback Submitted" value={s.post_receipt_engagement.feedback.submitted} color="gray"
                  subtitle={`${s.post_receipt_engagement.feedback.submit_rate}% rate`} />
                <FunnelCard label="Contact Clicked" value={s.post_receipt_engagement.other.contact_clicked} color="gray" />
                <FunnelCard label="History Viewed" value={s.post_receipt_engagement.other.history_viewed} color="gray" />
              </div>
            </div>
          </div>
        )}

        {/* AI Generation */}
        {s.ai_generation?.total > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">AI Generation</h2>
            <p className="text-sm text-gray-500 mb-4">OpenAI receipt generation tracked server-side</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <FunnelCard label="Total" value={s.ai_generation.total} color="blue" />
              <FunnelCard label="Succeeded" value={s.ai_generation.succeeded} color="green" />
              <FunnelCard label="Failed" value={s.ai_generation.failed} color="red" />
              <FunnelCard label="Success Rate" value={`${s.ai_generation.success_rate}%`} color="emerald" />
              <FunnelCard label="Fallback Used" value={s.ai_generation.fallback_used} color="amber" />
            </div>
          </div>
        )}


        {/* Extraction Domains */}
        {s.extraction_domains.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔗 Extraction Sources</h2>
            <div className="space-y-2">
              {s.extraction_domains.slice(0, 10).map((d, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium font-mono text-sm">{d.domain}</span>
                  <div className="flex gap-3 text-sm">
                    <span className="text-green-600">{d.successes} ok</span>
                    <span className="text-red-600">{d.failures} fail</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">{d.attempts} total</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attribution */}
        {s.attribution && s.attribution.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Traffic Attribution</h2>
            <p className="text-sm text-gray-500 mb-3">page_source from event payloads</p>
            <div className="space-y-2">
              {s.attribution.slice(0, 10).map((a, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium font-mono text-sm">{a.source}</span>
                  <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium text-sm">{a.event_count} events</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 5: Outcome Metrics ── */}
        <div className="mb-2 mt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Section 5 · Outcome Metrics</h2>
        </div>

        {/* Verdict Distribution */}
        {s.verdict_distribution.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">⚖️ Verdict Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {s.verdict_distribution.map((v, idx) => (
                <div key={idx} className={`p-4 rounded-xl ${
                  v.verdict.toLowerCase().includes("green") || v.verdict.toLowerCase().includes("good") ? "bg-green-50" :
                  v.verdict.toLowerCase().includes("red") || v.verdict.toLowerCase().includes("risk") ? "bg-red-50" :
                  v.verdict.toLowerCase().includes("yellow") || v.verdict.toLowerCase().includes("fair") ? "bg-amber-50" : "bg-gray-50"
                }`}>
                  <p className="text-2xl font-bold text-gray-900">{v.count}</p>
                  <p className="text-xs text-gray-600 capitalize">{v.verdict}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report Funnel (Legacy) */}
        {(s.report_funnel.form_submissions > 0 || s.report_funnel.report_gen_started > 0) && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">📈 Report Funnel (Legacy EV-Risk)</h2>
            <p className="text-sm text-gray-500 mb-4">Old paid-report pipeline</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <FunnelCard label="Form Submissions" value={s.report_funnel.form_submissions} color="blue" />
              <FunnelCard label="Intake Submitted" value={s.report_funnel.intake_submitted} color="indigo" />
              <FunnelCard label="Gen Started" value={s.report_funnel.report_gen_started} color="purple" />
              <FunnelCard label="Gen Succeeded" value={s.report_funnel.report_gen_succeeded} color="green" />
              <FunnelCard label="Gen Failed" value={s.report_funnel.report_gen_failed} color="red" />
              <FunnelCard label="Success Rate" value={`${s.report_funnel.success_rate}%`} color="emerald" />
            </div>
          </div>
        )}

        {/* Visitors */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🌐 Visitors</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-sm text-purple-600 font-medium mb-1">Unique Visitors</p>
              <p className="text-3xl font-bold text-purple-900">{s.visitors.unique_visitors}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium mb-1">Total Visits</p>
              <p className="text-3xl font-bold text-blue-900">{s.visitors.total_visits}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-green-600 font-medium mb-1">Top Page</p>
              <p className="text-lg font-bold text-green-900 truncate">{s.visitors.top_pages[0]?.page_path || "/"}</p>
              <p className="text-xs text-green-700">{s.visitors.top_pages[0]?.view_count || 0} views</p>
            </div>
          </div>
          {s.visitors.top_pages.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold mb-2">Top Pages</h3>
              {s.visitors.top_pages.slice(0, 8).map((page, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-gray-400">{idx + 1}</span>
                    <div>
                      <p className="font-mono text-sm font-medium text-gray-900">{page.page_path}</p>
                      <p className="text-xs text-gray-600">{page.unique_visitors} unique visitors</p>
                    </div>
                  </div>
                  <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">{page.view_count} views</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Homepage Funnel */}
        {s.homepage_funnel && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">🏠 Homepage Funnel</h2>
            <p className="text-sm text-gray-500 mb-4">Engagement with recently-added homepage features</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="Page Views" value={s.homepage_funnel.landing_views} color="blue" />
              <FunnelCard label="Deal Watch Section Shown" value={s.homepage_funnel.featured_deals_viewed} color="green" />
              <FunnelCard label="Deal Card → Run Analysis" value={s.homepage_funnel.featured_deal_clicked} color="green" />
              <FunnelCard label="Deal Section CTR" value={`${s.homepage_funnel.deals_section_to_click_rate}%`} color="indigo" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="View All Deals →" value={s.homepage_funnel.view_all_deals_clicked} color="purple" />
              <FunnelCard label="Set Up Deal Watch CTA" value={s.homepage_funnel.deal_watch_cta_clicked} color="purple" />
              <FunnelCard label="For Dealers Nav Clicks" value={s.homepage_funnel.for_dealers_nav_clicked} color="yellow" />
              <FunnelCard label="For Dealers Page Views" value={s.homepage_funnel.for_dealers_page_viewed} color="yellow" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FunnelCard label="Dealer Apply CTA Clicked" value={s.homepage_funnel.dealer_apply_cta_clicked} color="red" />
              <FunnelCard label="Dealer Page → Apply Rate" value={`${s.homepage_funnel.dealer_apply_rate}%`} color="red" />
            </div>
          </div>
        )}

        {/* Free Tools Engagement */}
        {s.tools_engagement && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">🔧 Free Tools Engagement</h2>
            <p className="text-sm text-gray-500 mb-4">Charging Time, TCO, and Warranty tool usage</p>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Charging Time Tool</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <FunnelCard label="Views" value={s.tools_engagement.charging_tool_views} color="blue" />
              <FunnelCard label="Preset Uses" value={s.tools_engagement.charging_tool_preset_uses} color="green" />
              <FunnelCard label="Results Shown" value={s.tools_engagement.charging_tool_results} color="green" />
              <FunnelCard label="CTA Clicks" value={s.tools_engagement.charging_tool_cta_clicks} color="indigo" />
              <FunnelCard label="View → Result" value={`${s.tools_engagement.charging_view_to_result}%`} color="purple" />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">TCO Calculator</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <FunnelCard label="Views" value={s.tools_engagement.tco_tool_views} color="blue" />
              <FunnelCard label="Results Calculated" value={s.tools_engagement.tco_tool_results} color="green" />
              <FunnelCard label="Breakdown Opens" value={s.tools_engagement.tco_breakdown_opens} color="yellow" />
              <FunnelCard label="CTA Clicks" value={s.tools_engagement.tco_tool_cta_clicks} color="indigo" />
              <FunnelCard label="View → Result" value={`${s.tools_engagement.tco_view_to_result}%`} color="purple" />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Warranty Checker</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <FunnelCard label="Views" value={s.tools_engagement.warranty_tool_views} color="blue" />
              <FunnelCard label="Checks Run" value={s.tools_engagement.warranty_checks} color="green" />
              <FunnelCard label="Results Shown" value={s.tools_engagement.warranty_results} color="green" />
              <FunnelCard label="X Posts" value={s.tools_engagement.warranty_tweets} color="gray" />
              <FunnelCard label="View → Check" value={`${s.tools_engagement.warranty_view_to_check}%`} color="purple" />
            </div>
          </div>
        )}

        {/* Page Reach */}
        {s.page_reach && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">📊 Page Reach</h2>
            <p className="text-sm text-gray-500 mb-4">Views across deals, news, auth, workspace, and content pages</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="Deals Page" value={s.page_reach.deals_views} color="blue" />
              <FunnelCard label="News Page" value={s.page_reach.news_views} color="blue" />
              <FunnelCard label="News Article Clicks" value={s.page_reach.news_article_clicks} color="indigo" />
              <FunnelCard label="Routine Entry" value={s.page_reach.routine_entry_views} color="green" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="Routine Results" value={s.page_reach.routine_results_views} color="green" />
              <FunnelCard label="Auth Login" value={s.page_reach.auth_login_views} color="yellow" />
              <FunnelCard label="Auth Signup" value={s.page_reach.auth_signup_views} color="yellow" />
              <FunnelCard label="Workspace EV Fit" value={s.page_reach.workspace_evfit_views} color="purple" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FunnelCard label="Deal Watch WS" value={s.page_reach.workspace_dealwatch_views} color="purple" />
              <FunnelCard label="Report Pages" value={s.page_reach.report_page_views} color="gray" />
              <FunnelCard label="Auction Results" value={s.page_reach.auction_result_views} color="gray" />
              <FunnelCard label="Pricing Page" value={s.page_reach.pricing_views} color="gray" />
            </div>
          </div>
        )}

        {/* Saved Listings */}
        {s.saved_listings.total > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💾 Saved Listings</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="Total Saved" value={s.saved_listings.total} color="indigo" />
              <FunnelCard label="Unique Users" value={s.saved_listings.unique_users} color="green" />
              <FunnelCard label="Receipt Saves" value={s.saved_listings.by_type.receipt} color="blue" />
              <FunnelCard label="EVRoutine Saves" value={s.saved_listings.by_type.evroutine} color="purple" />
            </div>
          </div>
        )}

        {/* EVFit Backend Funnel */}
        {s.evfit_funnel && (s.evfit_funnel.evfit_started > 0 || s.evfit_funnel.ai_job_queued > 0) && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">⚡ EVFit Backend Funnel</h2>
            <p className="text-sm text-gray-500 mb-4">Server-side events — not ad-blockable, deduplicated</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="EVFit Started" value={s.evfit_funnel.evfit_started} color="blue" />
              <FunnelCard label="EVFit Completed" value={s.evfit_funnel.evfit_completed} color="green" subtitle={`${s.evfit_funnel.completion_rate_pct}% completion`} />
              <FunnelCard label="Refine Completed" value={s.evfit_funnel.refine_completed} color="indigo" subtitle={`${s.evfit_funnel.with_refine_pct}% of completions`} />
              <FunnelCard label="Shortlist Saved" value={s.evfit_funnel.shortlist_saved} color="purple" subtitle={`${s.evfit_funnel.with_shortlist_pct}% of completions`} />
              <FunnelCard label="Compare Started" value={s.evfit_funnel.compare_started ?? 0} color="sky" />
              <FunnelCard label="Compare Completed" value={s.evfit_funnel.compare_completed} color="cyan" subtitle={`${s.evfit_funnel.compare_start_to_finish_pct ?? 0}% finish rate`} />
              <FunnelCard label="Listing Saved" value={s.evfit_funnel.listing_saved} color="emerald" />
              <FunnelCard label="Garage Created" value={s.evfit_funnel.garage_created} color="teal" />
              <FunnelCard label="Anon Attached" value={s.evfit_funnel.anon_attached} color="amber" />
            </div>
            {s.evfit_funnel.ai_job_queued > 0 && (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 mt-2">AI Job Lifecycle</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <FunnelCard label="AI Jobs Queued" value={s.evfit_funnel.ai_job_queued} color="blue" />
                  <FunnelCard label="AI Succeeded" value={s.evfit_funnel.ai_job_succeeded} color="green" subtitle={`${s.evfit_funnel.ai_success_rate_pct}% success`} />
                  <FunnelCard label="AI Failed" value={s.evfit_funnel.ai_job_failed} color="red" />
                </div>
              </>
            )}
          </div>
        )}

        {/* OFFO AI Chat Metrics */}
        {s.chat_metrics && s.chat_metrics.total_sessions > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">💬 OFFO AI Chat</h2>
            <p className="text-sm text-gray-500 mb-4">Chat sessions, pipeline performance, and monetization.</p>

            {/* Core stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="Chat Sessions" value={s.chat_metrics.total_sessions} color="blue" />
              <FunnelCard label="User Messages" value={s.chat_metrics.total_user_messages} color="indigo" subtitle={`${s.chat_metrics.avg_messages_per_session} avg/session`} />
              <FunnelCard label="AI Unlimited Purchases" value={s.chat_metrics.chat_pass_purchases} color="green" subtitle={`$${(s.chat_metrics.chat_pass_revenue_cents / 100).toFixed(2)} revenue`} />
              <FunnelCard label="Conversion Rate" value={`${s.chat_metrics.chat_conversion_pct}%`} color="emerald" subtitle="sessions → purchase" />
            </div>

            {/* Pipeline performance */}
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Pipeline Performance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <FunnelCard label="Avg Latency" value={`${s.chat_metrics.avg_latency_ms}ms`} color="sky" />
              <FunnelCard label="P95 Latency" value={`${s.chat_metrics.p95_latency_ms}ms`} color="cyan" />
              <FunnelCard label="Fallbacks" value={s.chat_metrics.fallback_count} color="red" subtitle={`${s.chat_metrics.fallback_rate_pct}% fallback rate`} />
              <FunnelCard
                label="Scenario Split"
                value={`${s.chat_metrics.by_scenario["receipt"] ?? 0}R / ${s.chat_metrics.by_scenario["compare"] ?? 0}C`}
                color="violet"
                subtitle="receipt / compare"
              />
            </div>

            {/* Intent + Model distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Query Intent</h3>
                <div className="space-y-1">
                  {Object.entries(s.chat_metrics.intent_distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([intent, count]) => (
                      <div key={intent} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 capitalize">{intent.replace(/_/g, " ")}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Model Used (primary)</h3>
                <div className="space-y-1">
                  {Object.entries(s.chat_metrics.model_distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([model, count]) => (
                      <div key={model} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 capitalize">{model}</span>
                        <span className="font-medium text-gray-900">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* User Segments */}
        {s.user_segments && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">🎯 User Segments</h2>
            <p className="text-sm text-gray-500 mb-4">All-time counts (authenticated users). High intent = completed EVFit (all-time) + saved ≥1 vehicle (all-time) + ≥2 sessions in window.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <FunnelCard label="Saved a Vehicle" value={s.user_segments.users_with_garage_vehicle} color="emerald" />
              <FunnelCard label="Saved a Listing" value={s.user_segments.users_with_saved_listing} color="teal" />
              <FunnelCard label="High Intent Users" value={s.user_segments.high_intent_users} color="violet" subtitle="EVFit + vehicle + 2+ sessions" />
            </div>
          </div>
        )}

        {/* ── SECTION 4: Retention & My Garage ── */}
        <div className="mb-2 mt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Section 4 · Retention &amp; My Garage</h2>
        </div>

        {/* Retention & My Garage */}
        {s.retention && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-violet-400">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Retention &amp; My Garage</h2>
            <p className="text-sm text-gray-500 mb-4">Save rate, garage activity, compare funnel, repeat usage</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <FunnelCard label="Save Rate" value={`${s.retention.save_rate_pct}%`} color={s.retention.save_rate_pct >= 20 ? "green" : "amber"} subtitle={`${s.retention.save_receipt_succeeded}/${s.retention.save_receipt_clicked} clicked`} />
              <FunnelCard label="Garage Vehicles" value={s.retention.garage_total_vehicles} color="emerald" subtitle={`${s.retention.garage_unique_users} unique users`} />
              <FunnelCard label="Saved Scenarios" value={s.retention.saved_scenarios_total} color="indigo" subtitle={`${s.retention.saved_scenarios_unique_users} unique users`} />
              <FunnelCard label="High Intent Users" value={s.retention.high_intent_users} color="violet" subtitle="saved + compare + 2+ sessions" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <FunnelCard label="Compare Started" value={s.retention.compare_started} color="blue" />
              <FunnelCard label="Compare Completed" value={s.retention.compare_completed} color="green" subtitle={s.retention.compare_started > 0 ? `${Math.round((s.retention.compare_completed / s.retention.compare_started) * 100)}% finish rate` : undefined} />
              <FunnelCard label="Garage Views" value={s.retention.my_garage_viewed} color="teal" />
              <FunnelCard label="Vehicles Added" value={s.retention.my_garage_vehicle_added} color="cyan" />
            </div>
            {s.repeat_usage && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Repeat Usage (from visitors table)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FunnelCard label="Returned in 7 days" value={s.repeat_usage.returned_in_7d} color="green" />
                  <FunnelCard label="Returned in 30 days" value={s.repeat_usage.returned_in_30d} color="blue" />
                  <FunnelCard label="Single Visit" value={s.repeat_usage.single_visit} color="gray" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deal Watch */}
        {s.deal_watch && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-sky-400">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Deal Watch</h2>
            <p className="text-sm text-gray-500 mb-4">Saved search usage and alert delivery (all-time)</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <FunnelCard label="Total Searches" value={s.deal_watch.total_searches} color="blue" />
              <FunnelCard label="Unique Users" value={s.deal_watch.unique_users} color="indigo" />
              <FunnelCard label="Alert-Enabled" value={s.deal_watch.alert_searches} color="sky"
                subtitle={`${s.deal_watch.total_searches > 0 ? Math.round((s.deal_watch.alert_searches / s.deal_watch.total_searches) * 100) : 0}% of searches`} />
              <FunnelCard label="New (Last 7d)" value={s.deal_watch.new_7d} color="cyan" />
              <FunnelCard label="Alerts Sent (7d)" value={s.deal_watch.alerts_sent_7d} color="green" />
            </div>
          </div>
        )}

        {/* Payments Detail */}
        {s.payments_detail && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-emerald-400">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Payment Analytics</h2>
            <p className="text-sm text-gray-500 mb-4">Revenue breakdown by tier, cart abandonment, and refunds (all-time paid)</p>

            {/* Cart abandonment + Refunds */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <FunnelCard label="Checkout Started (7d)" value={s.payments_detail.cart_abandonment.checkout_started_7d} color="amber" />
              <FunnelCard label="Paid (7d)" value={s.payments_detail.cart_abandonment.paid_7d} color="green" />
              <FunnelCard label="Abandonment Rate" value={`${s.payments_detail.cart_abandonment.abandonment_rate_pct}%`}
                color={s.payments_detail.cart_abandonment.abandonment_rate_pct > 70 ? "red" : "amber"} />
              <FunnelCard label="Refunds (30d)" value={s.payments_detail.refunds_30d.count}
                subtitle={`$${(s.payments_detail.refunds_30d.total_refunded ?? 0).toFixed(2)} refunded`}
                color={s.payments_detail.refunds_30d.count > 0 ? "red" : "gray"} />
            </div>

            {/* Revenue by tier/variant */}
            {s.payments_detail.revenue_by_tier?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Revenue by Pack &amp; Variant</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2 pr-4 font-medium">Pack Tier</th>
                        <th className="pb-2 pr-4 font-medium">Price Variant</th>
                        <th className="pb-2 pr-4 font-medium text-right">Count</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.payments_detail.revenue_by_tier.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-4 font-medium text-gray-800">{row.pack_tier}</td>
                          <td className="py-2 pr-4 text-gray-600">{row.price_variant || "—"}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{row.count}</td>
                          <td className="py-2 text-right tabular-nums font-semibold text-emerald-700">${row.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent payments */}
            {s.payments_detail.recent_payments?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Payments (last 10)</h3>
                <div className="space-y-2">
                  {s.payments_detail.recent_payments.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-600">{p.pack_tier}</span>
                      <span className="font-semibold text-emerald-700">${(p.amount ?? 0).toFixed(2)}</span>
                      <span className="text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Routine Engagement + Entry Mode */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {s.routine_engagement && (s.routine_engagement.check_started > 0 || s.routine_engagement.total_field_completions > 0) && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Routine Fit Engagement</h2>

              {/* Legacy metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <FunnelCard label="Check Started" value={s.routine_engagement.check_started} color="blue" />
                <FunnelCard label="Check Completed" value={s.routine_engagement.check_completed} color="green" />
                <FunnelCard label="Score Viewed" value={s.routine_engagement.score_viewed} color="purple" />
                <FunnelCard label="Result Viewed" value={s.routine_engagement.result_viewed} color="cyan" />
                <FunnelCard label="Field Completions" value={s.routine_engagement.total_field_completions} color="indigo" />
              </div>

              {/* NEW: Comprehensive analytics (March 2026) */}
              {(s.routine_engagement.form_completed > 0 || s.routine_engagement.vehicle_list_generated > 0) && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-6">New Analytics (March 2026)</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <FunnelCard label="Form Completed" value={s.routine_engagement.form_completed} color="green" />
                    <FunnelCard label="Form Abandoned" value={s.routine_engagement.form_partial_abandon} color="amber" />
                    <FunnelCard label="Vehicle Lists" value={s.routine_engagement.vehicle_list_generated} color="blue" />
                    <FunnelCard label="Reports Clicked" value={s.routine_engagement.vehicle_full_report_clicked} color="purple" />
                    <FunnelCard label="External Links" value={s.routine_engagement.external_link_clicked} color="cyan" />
                    <FunnelCard label="Dealer Views" value={s.routine_engagement.offo_dealer_viewed} color="indigo" />
                  </div>
                </>
              )}
              {s.routine_engagement.fields.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Per-Field Breakdown</h3>
                  {s.routine_engagement.fields.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <span className="font-mono text-gray-700">{f.field_id}</span>
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {s.entry_mode && s.entry_mode.total_selections > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Entry Mode Selection</h2>
              <FunnelCard label="Total Mode Switches" value={s.entry_mode.total_selections} color="blue" />
              {s.entry_mode.modes.length > 0 && (
                <div className="mt-4 space-y-2">
                  {s.entry_mode.modes.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium capitalize">{m.mode}</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium">{m.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Risk Distribution + Feedback */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {s.risk_distribution.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ownership Friction Distribution</h2>
              <div className="space-y-3">
                {s.risk_distribution.map((risk) => (
                  <div key={risk.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{risk.category}</span>
                      <span className="text-gray-600">{risk.total_count} total ({risk.paid_count} paid)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          risk.category.includes("Green") ? "bg-green-500" :
                          risk.category.includes("Yellow") ? "bg-yellow-500" : "bg-red-500"
                        }`}
                        style={{ width: `${s.overview.total_reports > 0 ? (risk.total_count / s.overview.total_reports) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Feedback</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-yellow-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold">{s.feedback.avg_rating.toFixed(1)}</p>
                <p className="text-xs text-gray-600">Avg Rating</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold">{s.feedback.recommendation_rate}%</p>
                <p className="text-xs text-gray-600">Recommend</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold">{s.feedback.total_feedback}</p>
                <p className="text-xs text-gray-600">Total</p>
              </div>
            </div>
            {s.feedback.rating_distribution.length > 0 && (
              <div className="space-y-2">
                {s.feedback.rating_distribution.map((r) => (
                  <div key={r.rating} className="flex items-center gap-2">
                    <span className="text-sm font-medium w-8">{r.rating}★</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${s.feedback.total_feedback > 0 ? (r.count / s.feedback.total_feedback) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-6 text-right">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Vehicles */}
        {s.top_vehicles.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Top Vehicle Models</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Model</th>
                    <th className="text-left py-3 px-4">Year</th>
                    <th className="text-center py-3 px-4">Total</th>
                    <th className="text-center py-3 px-4">Free</th>
                    <th className="text-center py-3 px-4">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {s.top_vehicles.slice(0, 15).map((v, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{v.model}</td>
                      <td className="py-3 px-4">{v.year || "N/A"}</td>
                      <td className="py-3 px-4 text-center">{v.total_count}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{v.free_count}</td>
                      <td className="py-3 px-4 text-center text-green-600 font-medium">{v.paid_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Trend */}
        {s.daily_trend.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Daily Activity</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-center py-3 px-4">Receipts</th>
                    <th className="text-center py-3 px-4">Free Reports</th>
                    <th className="text-center py-3 px-4">Paid Reports</th>
                  </tr>
                </thead>
                <tbody>
                  {s.daily_trend.slice(0, 14).map((day, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{new Date(day.date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-center font-medium">{day.receipts}</td>
                      <td className="py-3 px-4 text-center text-gray-600">{day.reports_free}</td>
                      <td className="py-3 px-4 text-center text-green-600 font-medium">{day.reports_paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Feedback */}
        {s.recent_feedback.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Feedback</h2>
            <div className="space-y-4">
              {s.recent_feedback.map((f, idx) => (
                <div key={idx} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">{"⭐".repeat(f.rating)}</span>
                      <span className="text-sm text-gray-500">{new Date(f.created_at).toLocaleDateString()}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${f.would_recommend ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {f.would_recommend ? "Would Recommend" : "Would Not"}
                    </span>
                  </div>
                  <p className="text-gray-700">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 6: VINaudit Readiness ── */}
        <div className="mb-2 mt-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Section 6 · VINaudit Readiness</h2>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-dashed border-gray-300">
          <h2 className="text-xl font-bold text-gray-900 mb-1">VINaudit Readiness</h2>
          <p className="text-sm text-gray-400">Coming soon — VIN history calls, deal ratings generated, and dealer integration metrics will appear here once integrated.</p>
        </div>

        {/* Recent Events (Enhanced) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Events (Last 50)</h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["all", "humans", "bots"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setBotFilter(f);
                    setExpandedRow(null);
                    const storedKey = sessionStorage.getItem("admin_api_key");
                    if (storedKey) fetchSummary(storedKey, period, undefined, undefined, f);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    botFilter === f ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {f === "all" ? "All" : f === "humans" ? "Humans Only" : "Bots Only"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Source</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Event</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Actor</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Session</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Score</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Details</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Time</th>
                </tr>
              </thead>
              <tbody>
                {s.recent_events
                  .filter((event) => {
                    if (botFilter === "all") return true;
                    if (botFilter === "humans") return event.actor_label === "human" || event.actor_label === "likely_human";
                    return event.actor_label === "suspicious" || event.actor_label === "likely_bot";
                  })
                  .slice(0, 50)
                  .map((event, idx) => (
                  <Fragment key={idx}>
                    <tr
                      onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          event.source === "receipt_events" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {event.source === "receipt_events" ? "receipt" : "user"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{event.event_name}</td>
                      <td className="px-3 py-2">
                        <ActorBadge label={event.actor_label} />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">
                        {event.session_id ? event.session_id.substring(0, 12) + "..." : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {event.bot_score != null ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            event.bot_score <= 25 ? "bg-green-100 text-green-700" :
                            event.bot_score <= 50 ? "bg-blue-100 text-blue-700" :
                            event.bot_score <= 75 ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {event.bot_score}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]">
                        {(() => {
                          const d = event.details as { verdict?: string; url_domain?: string; success?: boolean } | undefined;
                          return <>
                            {d?.verdict && <span className="text-purple-600">{d.verdict}</span>}
                            {d?.url_domain && !d?.verdict && <span className="text-blue-600">{d.url_domain}</span>}
                            {d?.success !== undefined && (
                              <span className={d.success ? "text-green-600" : "text-red-600"}>
                                {d.success ? " ✓" : " ✗"}
                              </span>
                            )}
                          </>;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{new Date(event.timestamp).toLocaleString()}</td>
                    </tr>
                    {expandedRow === idx && (
                      <tr key={`${idx}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="font-medium text-gray-500 mb-1">Visitor ID</p>
                              <p className="font-mono text-gray-700 break-all">{event.visitor_id || "—"}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-500 mb-1">Session ID</p>
                              <p className="font-mono text-gray-700 break-all">{event.session_id || "—"}</p>
                            </div>
                            <div>
                              <p className="font-medium text-gray-500 mb-1">User Agent</p>
                              <p className="text-gray-700 break-all">{event.user_agent || "—"}</p>
                            </div>
                          </div>
                          {event.details && (
                            <div className="mt-3">
                              <p className="font-medium text-gray-500 mb-1 text-xs">Details</p>
                              <pre className="bg-white border border-gray-200 rounded-lg p-2 text-xs text-gray-700 overflow-auto max-h-40">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Logout */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              sessionStorage.removeItem("admin_api_key");
              setIsAuthenticated(false);
              setSummary(null);
            }}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function MetricCard({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  green: { bg: "bg-green-50", text: "text-green-600" },
  red: { bg: "bg-red-50", text: "text-red-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  gray: { bg: "bg-gray-100", text: "text-gray-600" },
};

function FunnelCard({ label, value, color, subtitle }: { label: string; value: string | number; color: string; subtitle?: string }) {
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div className={`${c.bg} p-4 rounded-xl`}>
      <p className={`text-sm ${c.text} font-medium`}>{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

const ACTOR_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  human: { bg: "bg-green-100", text: "text-green-700", label: "human" },
  likely_human: { bg: "bg-blue-100", text: "text-blue-700", label: "likely" },
  suspicious: { bg: "bg-amber-100", text: "text-amber-700", label: "suspect" },
  likely_bot: { bg: "bg-red-100", text: "text-red-700", label: "bot" },
  unknown: { bg: "bg-gray-100", text: "text-gray-600", label: "?" },
};

function ActorBadge({ label }: { label: string }) {
  const style = ACTOR_STYLES[label] || ACTOR_STYLES.unknown;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
