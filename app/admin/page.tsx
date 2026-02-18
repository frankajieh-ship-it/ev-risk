"use client";

/**
 * Admin Analytics Dashboard
 *
 * Single source of truth: fetches all data from /api/admin/summary.
 * No race conditions, no cross-referencing multiple state variables.
 */

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types — mirrors /api/admin/summary response
// ---------------------------------------------------------------------------

interface SummaryWindow {
  start: string;
  end: string;
  period: string;
  timezone: string;
}

interface SummaryData {
  success: boolean;
  window: SummaryWindow;
  overview: {
    total_receipts: number;
    total_reports: number;
    free_reports: number;
    paid_reports: number;
    unique_sessions: number;
    unique_customers_by_email: number;
  };
  revenue: {
    paid_count: number;
    total_revenue: number;
    price_per_report: number;
  };
  receipt_funnel: {
    extraction_attempts: number;
    extraction_successes: number;
    extraction_failures: number;
    extraction_success_rate: number;
    receipts_generated: number;
    lint_failures: number;
    regens: number;
    copies: number;
    copy_reddit_draft: number;
    copy_seller_message: number;
    copy_checklist: number;
    lint_failed_fallback_served: number;
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
  why_checkpoint: {
    shown: number;
    submitted: number;
    skipped: number;
    submit_rate: number;
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
  email_captures: { submitted: number };
  receipt_server_events: {
    extract_success: number;
    extract_failed: number;
    extract_fallback_used: number;
    extract_total: number;
    success_rate: number;
  };
  report_server_events: {
    generated_success: number;
    generated_failed: number;
    generated_total: number;
    success_rate: number;
  };
  routine_engagement: {
    total_field_completions: number;
    fields: Array<{ field_id: string; count: number }>;
    check_started: number;
    check_completed: number;
    score_viewed: number;
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
    details: any;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("last_30_days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [botFilter, setBotFilter] = useState<"all" | "humans" | "bots">("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // Single fetch
  // -------------------------------------------------------------------------

  const fetchSummary = useCallback(
    async (key: string, selectedPeriod: Period = period, customStart?: string, customEnd?: string) => {
      setLoading(true);
      setError("");

      try {
        let url = `/api/admin/summary?period=${selectedPeriod}`;
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

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
      ["Total Revenue", `$${s.revenue.total_revenue}`],
      ["Paid Report Count", s.revenue.paid_count],
      [""],
      ["=== RECEIPT FUNNEL ==="],
      ["Extraction Attempts", s.receipt_funnel.extraction_attempts],
      ["Extraction Successes", s.receipt_funnel.extraction_successes],
      ["Extraction Failures", s.receipt_funnel.extraction_failures],
      ["Extraction Success Rate", `${s.receipt_funnel.extraction_success_rate}%`],
      ["Receipts Generated", s.receipt_funnel.receipts_generated],
      ["Lint Failures", s.receipt_funnel.lint_failures],
      ["Regens", s.receipt_funnel.regens],
      ["Total Copies", s.receipt_funnel.copies],
      ["Copy Reddit Draft", s.receipt_funnel.copy_reddit_draft],
      ["Copy Seller Message", s.receipt_funnel.copy_seller_message],
      ["Copy Checklist", s.receipt_funnel.copy_checklist],
      ["Lint Fallback Served", s.receipt_funnel.lint_failed_fallback_served],
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
      ["Shown", s.why_checkpoint.shown],
      ["Submitted", s.why_checkpoint.submitted],
      ["Skipped", s.why_checkpoint.skipped],
      ["Submit Rate", `${s.why_checkpoint.submit_rate}%`],
      [""],
      ["=== FEEDBACK ==="],
      ["Average Rating", s.feedback.avg_rating.toFixed(1)],
      ["Total Feedback", s.feedback.total_feedback],
      ["Recommendation Rate", `${s.feedback.recommendation_rate}%`],
      [""],
      ["=== SCENARIO SAVES ==="],
      ["Save Clicked", s.scenario_saves.clicked],
      ["Save Succeeded", s.scenario_saves.succeeded],
      [""],
      ["=== EMAIL CAPTURES ==="],
      ["Emails Submitted", s.email_captures.submitted],
      [""],
      ["=== SERVER-SIDE RECEIPT EVENTS ==="],
      ["Extract Total", s.receipt_server_events?.extract_total ?? 0],
      ["Extract Success", s.receipt_server_events?.extract_success ?? 0],
      ["Extract Failed", s.receipt_server_events?.extract_failed ?? 0],
      ["Extract Success Rate", `${s.receipt_server_events?.success_rate ?? 0}%`],
      ["Fallback Used", s.receipt_server_events?.extract_fallback_used ?? 0],
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
      ["=== ENTRY MODE ==="],
      ["Total Mode Selections", s.entry_mode?.total_selections ?? 0],
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

          {/* Export */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Export current view — data matches what you see on screen</p>
            <div className="flex gap-2">
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
          <MetricCard title="Receipts Generated" value={s.receipt_funnel.receipts_generated} subtitle={`${s.overview.total_receipts} receipts · ${s.overview.total_reports} EV-Risk reports stored`} icon="🧾" />
          <MetricCard title="Unique Sessions" value={s.overview.unique_sessions} subtitle={`${s.overview.unique_customers_by_email} with email (paid)`} icon="👥" />
          <MetricCard title="EV-Risk Reports" value={s.report_funnel.report_gen_started} subtitle={`${s.overview.total_reports} stored · ${s.report_funnel.report_gen_succeeded} persisted`} icon="📊" />
          <MetricCard title="Total Revenue" value={`$${s.revenue.total_revenue}`} subtitle={`${s.revenue.paid_count} paid @ $${s.revenue.price_per_report}`} icon="💵" />
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

        {/* Session Classification */}
        {s.session_classification && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Session Classification</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <FunnelCard label="Total Sessions" value={s.session_classification.total_sessions} color="blue" />
              <FunnelCard label="Human" value={s.session_classification.human} color="green" />
              <FunnelCard label="Likely Human" value={s.session_classification.likely_human} color="emerald" />
              <FunnelCard label="Suspicious" value={s.session_classification.suspicious} color="amber" />
              <FunnelCard label="Likely Bot" value={s.session_classification.likely_bot} color="red" />
              <FunnelCard label="Human Rate" value={`${s.session_classification.human_rate}%`} color="purple" />
            </div>
          </div>
        )}

        {/* Event Coverage */}
        {s.coverage && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Event Coverage</h2>
            <p className="text-sm text-gray-500 mb-4">% of sessions that fired each funnel stage</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FunnelCard label="Landing View" value={`${s.coverage.pct_landing}%`} color="blue" subtitle={`${s.coverage.sessions_with_landing_view} sessions`} />
              <FunnelCard label="Receipt Event" value={`${s.coverage.pct_receipt}%`} color="purple" subtitle={`${s.coverage.sessions_with_receipt_event} sessions`} />
              <FunnelCard label="Routine Event" value={`${s.coverage.pct_routine}%`} color="indigo" subtitle={`${s.coverage.sessions_with_routine_event} sessions`} />
              <FunnelCard label="Copy Event" value={`${s.coverage.pct_copy}%`} color="green" subtitle={`${s.coverage.sessions_with_copy_event} sessions`} />
            </div>
          </div>
        )}

        {/* Receipt Funnel */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">🧾 Receipt Funnel</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <FunnelCard label="Extractions" value={s.receipt_funnel.extraction_attempts} color="blue" />
            <FunnelCard label="Extract Success" value={`${s.receipt_funnel.extraction_success_rate}%`} color="green" />
            <FunnelCard label="Receipts Generated" value={s.receipt_funnel.receipts_generated} color="purple" />
            <FunnelCard label="Lint Failures" value={s.receipt_funnel.lint_failures} color="red" />
            <FunnelCard label="Lint Fallback" value={s.receipt_funnel.lint_failed_fallback_served} color="amber" />
            <FunnelCard label="Copy (Total)" value={s.receipt_funnel.copies} color="indigo" />
            <FunnelCard label="Regens" value={s.receipt_funnel.regens} color="gray" />
            <FunnelCard
              label="Copy Breakdown"
              value={`${s.receipt_funnel.copy_reddit_draft}/${s.receipt_funnel.copy_seller_message}/${s.receipt_funnel.copy_checklist}`}
              color="emerald"
              subtitle="Reddit / Seller / Checklist"
            />
          </div>
        </div>

        {/* Server-Side Receipt Events */}
        {s.receipt_server_events?.extract_total > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Server-Side Receipt Events</h2>
            <p className="text-sm text-gray-500 mb-4">Tracked server-side in /api/receipt</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <FunnelCard label="Extract Total" value={s.receipt_server_events.extract_total} color="blue" />
              <FunnelCard label="Extract Success" value={s.receipt_server_events.extract_success} color="green" />
              <FunnelCard label="Extract Failed" value={s.receipt_server_events.extract_failed} color="red" />
              <FunnelCard label="Success Rate" value={`${s.receipt_server_events.success_rate}%`} color="emerald" />
              <FunnelCard label="Fallback Used" value={s.receipt_server_events.extract_fallback_used} color="amber" />
            </div>
          </div>
        )}

        {/* Server-Side Report Events */}
        {s.report_server_events?.generated_total > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Server-Side Report Events</h2>
            <p className="text-sm text-gray-500 mb-4">Tracked server-side in /api/report</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FunnelCard label="Total Generated" value={s.report_server_events.generated_total} color="blue" />
              <FunnelCard label="Success" value={s.report_server_events.generated_success} color="green" />
              <FunnelCard label="Failed" value={s.report_server_events.generated_failed} color="red" />
              <FunnelCard label="Success Rate" value={`${s.report_server_events.success_rate}%`} color="emerald" />
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

        {/* Why Checkpoint */}
        {s.why_checkpoint.shown > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">❓ Why Checkpoint</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FunnelCard label="Shown" value={s.why_checkpoint.shown} color="blue" />
              <FunnelCard label="Submitted" value={s.why_checkpoint.submitted} color="green" />
              <FunnelCard label="Skipped" value={s.why_checkpoint.skipped} color="gray" />
              <FunnelCard label="Submit Rate" value={`${s.why_checkpoint.submit_rate}%`} color="purple" />
            </div>
          </div>
        )}

        {/* Scenario Saves & Email Captures */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💾 Scenario Saves</h2>
            <div className="grid grid-cols-2 gap-4">
              <FunnelCard label="Save Clicked" value={s.scenario_saves.clicked} color="indigo" />
              <FunnelCard label="Save Succeeded" value={s.scenario_saves.succeeded} color="green" />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📧 Email Captures</h2>
            <div className="grid grid-cols-1 gap-4">
              <FunnelCard label="Emails Submitted" value={s.email_captures.submitted} color="blue" />
            </div>
          </div>
        </div>

        {/* Routine Engagement + Entry Mode */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {s.routine_engagement && (s.routine_engagement.check_started > 0 || s.routine_engagement.total_field_completions > 0) && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Routine Fit Engagement</h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <FunnelCard label="Check Started" value={s.routine_engagement.check_started} color="blue" />
                <FunnelCard label="Check Completed" value={s.routine_engagement.check_completed} color="green" />
                <FunnelCard label="Score Viewed" value={s.routine_engagement.score_viewed} color="purple" />
                <FunnelCard label="Field Completions" value={s.routine_engagement.total_field_completions} color="indigo" />
              </div>
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

        {/* Recent Events (Enhanced) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Events (Last 50)</h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["all", "humans", "bots"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { setBotFilter(f); setExpandedRow(null); }}
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
                  <>
                    <tr
                      key={idx}
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
                        {event.details?.verdict && <span className="text-purple-600">{event.details.verdict}</span>}
                        {event.details?.url_domain && !event.details?.verdict && <span className="text-blue-600">{event.details.url_domain}</span>}
                        {event.details?.success !== undefined && (
                          <span className={event.details.success ? "text-green-600" : "text-red-600"}>
                            {event.details.success ? " ✓" : " ✗"}
                          </span>
                        )}
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
                  </>
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
