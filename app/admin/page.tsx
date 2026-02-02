"use client";

/**
 * Admin Analytics Dashboard
 *
 * Displays comprehensive analytics for EV-Risk application
 * Access: /admin (requires admin API key)
 */

import { useState, useEffect } from "react";

interface AnalyticsData {
  period: string;
  generated_at: string;
  overview: {
    total_reports: number;
    free_reports: number;
    paid_reports: number;
    draft_reports: number;
    unique_customers: number;
    unique_customers_by_session?: number; // NEW: Unique customers by persistent session
  };
  conversion: {
    total_generated: number;
    converted_to_paid: number;
    conversion_rate: number;
  };
  revenue: {
    paid_count: number;
    total_revenue: number;
    price_per_report: number;
  };
  feedback: {
    total_feedback: number;
    avg_rating: number;
    would_recommend: number;
    would_not_recommend: number;
    recommendation_rate: number;
    rating_distribution: Array<{ rating: number; count: number }>;
  };
  top_vehicles: Array<{
    model: string;
    year: number | null;
    total_count: number;
    paid_count: number;
    free_count: number;
  }>;
  willingness_to_pay: Array<{
    model: string;
    total_reports: number;
    paid_reports: number;
    conversion_rate: number;
  }>;
  risk_distribution: Array<{
    category: string;
    total_count: number;
    paid_count: number;
  }>;
  recent_feedback: Array<{
    rating: number;
    text: string;
    would_recommend: boolean;
    created_at: string;
    vehicle: string;
  }>;
  daily_trend: Array<{
    date: string;
    total: number;
    free: number;
    paid: number;
  }>;
  vehicle_checkouts: Array<{
    year: string | null;
    model: string | null;
    checkout_count: number;
  }>;
  report_downloads: Array<{
    year: string | null;
    model: string | null;
    status: string | null;
    download_count: number;
  }>;
  download_summary: {
    total_downloads: number;
    free_downloads: number;
    paid_downloads: number;
  };
  // NEW: Why Checkpoint funnel stats
  why_checkpoint?: {
    shown: number;
    submitted: number;
    skipped: number;
    submit_rate: number;
  };
  // NEW: Form → Report generation funnel
  funnel?: {
    form_submissions: number;
    intake_submitted: number;
    report_generation_started: number;
    report_generation_succeeded: number;
    report_generation_failed: number;
    form_validation_failed: number;
    api_errors: number;
    success_rate: number;
  };
}

export default function AdminDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [visitorStats, setVisitorStats] = useState<any>(null);
  const [eventStats, setEventStats] = useState<any>(null);
  const [appFeedback, setAppFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [visitorTimeframe, setVisitorTimeframe] = useState("30d");
  const [eventTimeframe, setEventTimeframe] = useState("30d");
  const [feedbackLimit, setFeedbackLimit] = useState(50);
  const [feedbackType, setFeedbackType] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [whyCheckpointStats, setWhyCheckpointStats] = useState<{
    shown: number;
    submitted: number;
    skipped: number;
    submitRate: string;
    choiceCounts: Record<string, number>;
  } | null>(null);
  const [sessionAnalytics, setSessionAnalytics] = useState<{
    overview: {
      total_sessions: number;
      completed_sessions: number;
      viewed_results: number;
      with_resolution: number;
      completion_rate: number;
      resolution_rate: number;
    };
    decision_outcomes: Array<{ outcome: string; count: number; label: string }>;
    fit_signals: Array<{ signal: string; count: number; label: string }>;
    sources: Array<{ source: string; count: number }>;
    regions: Array<{ region: string; count: number }>;
    surfaced_tradeoff: { yes: number; no: number; total: number; rate: number };
    recent_sessions: Array<{
      id: string;
      created_at: string;
      fit_signal: string | null;
      decision_outcome: string | null;
      surfaced_new_tradeoff: boolean | null;
      region: string;
      source: string;
      vehicle_model: string | null;
    }>;
    daily_trend: Array<{ date: string; total: number; completed: number; resolved: number }>;
    ip_metrics?: {
      unique_scenarios: number;
      novel_scenarios: number;
      engine_version: string;
    };
  } | null>(null);
  const [exportPeriod, setExportPeriod] = useState<"today" | "week" | "month">("today");
  const [isExporting, setIsExporting] = useState(false);
  const [emailFunnelStats, setEmailFunnelStats] = useState<{
    email_entry_start: number;
    email_entry_submitted: number;
    email_confirmed: number;
    conversion_rate: string;
  } | null>(null);
  const [scenarioSaveStats, setScenarioSaveStats] = useState<{
    save_clicked: number;
    save_clicked_authenticated: number;
    save_success: number;
    new_saves: number;
    conversion_rate: string;
  } | null>(null);

  // Generate export summary data
  const generateExportSummary = () => {
    if (!analytics || !visitorStats || !eventStats) return null;

    const summary = {
      period: exportPeriod,
      generatedAt: new Date().toISOString(),
      // Overview
      totalReports: analytics.overview.total_reports,
      freeReports: analytics.overview.free_reports,
      paidReports: analytics.overview.paid_reports,
      uniqueCustomers: analytics.overview.unique_customers,
      uniqueCustomersBySession: analytics.overview.unique_customers_by_session || 0,
      // Conversion
      conversionRate: analytics.conversion.conversion_rate,
      totalGenerated: analytics.conversion.total_generated,
      convertedToPaid: analytics.conversion.converted_to_paid,
      // Revenue
      totalRevenue: analytics.revenue.total_revenue,
      paidCount: analytics.revenue.paid_count,
      // Feedback
      avgRating: analytics.feedback.avg_rating,
      totalFeedback: analytics.feedback.total_feedback,
      recommendationRate: analytics.feedback.recommendation_rate,
      // Visitors
      totalVisitors: visitorStats.totalVisits || visitorStats.totalPageViews || 0,
      uniqueVisitors: visitorStats.uniqueVisitors || 0,
      // Events
      formSubmissions: eventStats.formSubmissions?.total_attempts || 0,
      formSuccessRate: eventStats.formSubmissions?.total_attempts > 0
        ? ((eventStats.formSubmissions.successful / eventStats.formSubmissions.total_attempts) * 100).toFixed(1)
        : "0",
      urlAutofillAttempts: eventStats.urlAutofill?.total_attempts || 0,
      urlAutofillSuccessRate: eventStats.urlAutofill?.total_attempts > 0
        ? ((eventStats.urlAutofill.successful / eventStats.urlAutofill.total_attempts) * 100).toFixed(1)
        : "0",
      // Why Checkpoint (from API)
      whyCheckpointShown: analytics.why_checkpoint?.shown || whyCheckpointStats?.shown || 0,
      whyCheckpointSubmitted: analytics.why_checkpoint?.submitted || whyCheckpointStats?.submitted || 0,
      whyCheckpointSubmitRate: analytics.why_checkpoint?.submit_rate || whyCheckpointStats?.submitRate || "0",
      // Report Generation Funnel
      funnelFormSubmissions: analytics.funnel?.form_submissions || 0,
      funnelIntakeSubmitted: analytics.funnel?.intake_submitted || 0,
      funnelReportGenStarted: analytics.funnel?.report_generation_started || 0,
      funnelReportGenSucceeded: analytics.funnel?.report_generation_succeeded || 0,
      funnelReportGenFailed: analytics.funnel?.report_generation_failed || 0,
      funnelSuccessRate: analytics.funnel?.success_rate || 0,
    };

    return summary;
  };

  // Export as CSV
  const exportToCSV = async () => {
    setIsExporting(true);

    // Fetch fresh data for the selected period
    const storedKey = sessionStorage.getItem("admin_api_key");
    if (!storedKey) {
      setIsExporting(false);
      return;
    }

    // Map export period to API period
    const apiPeriod = exportPeriod === "today" ? "today" : exportPeriod === "week" ? "week" : "month";
    const timeframe = exportPeriod === "today" ? "24h" : exportPeriod === "week" ? "7d" : "30d";

    try {
      // Fetch all data for the period
      await fetchAnalytics(storedKey, apiPeriod);
      await fetchVisitorStats(timeframe);
      await fetchEventStats(timeframe);
      await fetchWhyCheckpointStats(timeframe);
      await fetchEmailFunnelStats(timeframe);
      await fetchScenarioSaveStats(timeframe);

      // Wait a bit for state to update
      setTimeout(() => {
        const summary = generateExportSummary();
        if (!summary) {
          setIsExporting(false);
          return;
        }

        // Create CSV content
        const csvRows = [
          ["EV-Risk Analytics Summary"],
          ["Export Period", exportPeriod.charAt(0).toUpperCase() + exportPeriod.slice(1)],
          ["Generated At", new Date().toLocaleString()],
          [""],
          ["=== OVERVIEW ==="],
          ["Total Reports", summary.totalReports],
          ["Free Reports", summary.freeReports],
          ["Paid Reports", summary.paidReports],
          ["Unique Customers", summary.uniqueCustomers],
          [""],
          ["=== CONVERSION ==="],
          ["Conversion Rate", `${summary.conversionRate}%`],
          ["Total Generated", summary.totalGenerated],
          ["Converted to Paid", summary.convertedToPaid],
          [""],
          ["=== REVENUE ==="],
          ["Total Revenue", `$${summary.totalRevenue}`],
          ["Paid Report Count", summary.paidCount],
          [""],
          ["=== FEEDBACK ==="],
          ["Average Rating", summary.avgRating.toFixed(1)],
          ["Total Feedback", summary.totalFeedback],
          ["Recommendation Rate", `${summary.recommendationRate}%`],
          [""],
          ["=== VISITORS ==="],
          ["Total Visits", summary.totalVisitors],
          ["Unique Visitors", summary.uniqueVisitors],
          [""],
          ["=== USER EVENTS ==="],
          ["Form Submissions", summary.formSubmissions],
          ["Form Success Rate", `${summary.formSuccessRate}%`],
          ["URL Autofill Attempts", summary.urlAutofillAttempts],
          ["URL Autofill Success Rate", `${summary.urlAutofillSuccessRate}%`],
          [""],
          ["=== WHY CHECKPOINT ==="],
          ["Shown", summary.whyCheckpointShown],
          ["Submitted", summary.whyCheckpointSubmitted],
          ["Submit Rate", `${summary.whyCheckpointSubmitRate}%`],
        ];

        const csvContent = csvRows.map(row => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ev-risk-summary-${exportPeriod}-${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setIsExporting(false);
      }, 500);
    } catch (err) {
      console.error("Export failed:", err);
      setIsExporting(false);
    }
  };

  // Export as JSON
  const exportToJSON = async () => {
    setIsExporting(true);

    const storedKey = sessionStorage.getItem("admin_api_key");
    if (!storedKey) {
      setIsExporting(false);
      return;
    }

    const apiPeriod = exportPeriod === "today" ? "today" : exportPeriod === "week" ? "week" : "month";
    const timeframe = exportPeriod === "today" ? "24h" : exportPeriod === "week" ? "7d" : "30d";

    try {
      await fetchAnalytics(storedKey, apiPeriod);
      await fetchVisitorStats(timeframe);
      await fetchEventStats(timeframe);
      await fetchWhyCheckpointStats(timeframe);
      await fetchEmailFunnelStats(timeframe);
      await fetchScenarioSaveStats(timeframe);

      setTimeout(() => {
        const summary = generateExportSummary();
        if (!summary) {
          setIsExporting(false);
          return;
        }

        const jsonContent = JSON.stringify(summary, null, 2);
        const blob = new Blob([jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ev-risk-summary-${exportPeriod}-${new Date().toISOString().split("T")[0]}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setIsExporting(false);
      }, 500);
    } catch (err) {
      console.error("Export failed:", err);
      setIsExporting(false);
    }
  };

  const fetchAnalytics = async (
    key: string,
    selectedPeriod: string = period,
    customStart?: string,
    customEnd?: string
  ) => {
    setLoading(true);
    setError("");

    try {
      let url = `/api/analytics?period=${selectedPeriod}`;
      if (customStart) url += `&start=${customStart}`;
      if (customEnd) url += `&end=${customEnd}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${key}`,
        },
      });

      if (response.status === 401) {
        setError("Invalid admin key");
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const data = await response.json();
      setAnalytics(data);
      setIsAuthenticated(true);

      // Store API key in session storage for convenience
      sessionStorage.setItem("admin_api_key", key);

      // Fetch visitor stats, event stats, app feedback, why checkpoint stats, email funnel, scenario saves, and session analytics
      await fetchVisitorStats(visitorTimeframe);
      await fetchEventStats(eventTimeframe);
      await fetchAppFeedback(feedbackLimit, feedbackType);
      await fetchWhyCheckpointStats(eventTimeframe);
      await fetchEmailFunnelStats(eventTimeframe);
      await fetchScenarioSaveStats(eventTimeframe);
      await fetchSessionAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitorStats = async (timeframe: string = visitorTimeframe) => {
    try {
      const response = await fetch(`/api/track-visitor?timeframe=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        setVisitorStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch visitor stats:", err);
    }
  };

  const fetchEventStats = async (timeframe: string = eventTimeframe) => {
    try {
      const response = await fetch(`/api/track-event?timeframe=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        setEventStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch event stats:", err);
    }
  };

  const fetchAppFeedback = async (limit: number = feedbackLimit, type: string | null = feedbackType) => {
    try {
      const storedKey = sessionStorage.getItem("admin_api_key");
      if (!storedKey) return;

      let url = `/api/feedback?limit=${limit}`;
      if (type) url += `&type=${type}`;

      const response = await fetch(url, {
        headers: {
          "x-api-key": storedKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAppFeedback(data);
      }
    } catch (err) {
      console.error("Failed to fetch app feedback:", err);
    }
  };

  const fetchWhyCheckpointStats = async (timeframe: string = eventTimeframe) => {
    try {
      const response = await fetch(`/api/track-event?timeframe=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        // Filter for why_checkpoint events from recent events
        const whyEvents = data.stats.recentEvents?.filter(
          (e: { event_name: string }) => e.event_name.startsWith('why_checkpoint_')
        ) || [];

        const shown = whyEvents.filter((e: { event_name: string }) => e.event_name === 'why_checkpoint_shown').length;
        const submitted = whyEvents.filter((e: { event_name: string }) => e.event_name === 'why_checkpoint_submitted').length;
        const skipped = whyEvents.filter((e: { event_name: string }) => e.event_name === 'why_checkpoint_skipped').length;

        // Count choices from submitted events
        const choiceCounts: Record<string, number> = {};
        whyEvents
          .filter((e: { event_name: string }) => e.event_name === 'why_checkpoint_submitted')
          .forEach((e: { event_data?: { why_choice?: string } }) => {
            const choice = e.event_data?.why_choice || 'unknown';
            choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
          });

        setWhyCheckpointStats({
          shown,
          submitted,
          skipped,
          submitRate: shown > 0 ? ((submitted / shown) * 100).toFixed(1) : '0',
          choiceCounts,
        });
      }
    } catch (err) {
      console.error("Failed to fetch why checkpoint stats:", err);
    }
  };

  const fetchSessionAnalytics = async () => {
    try {
      const storedKey = sessionStorage.getItem("admin_api_key");
      if (!storedKey) return;

      const response = await fetch(`/api/session/analytics?period=30`, {
        headers: {
          Authorization: `Bearer ${storedKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessionAnalytics(data.session_analytics);
      }
    } catch (err) {
      console.error("Failed to fetch session analytics:", err);
    }
  };

  // Fetch email funnel stats from event data
  const fetchEmailFunnelStats = async (timeframe: string = eventTimeframe) => {
    try {
      const response = await fetch(`/api/track-event?timeframe=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        const events = data.stats.recentEvents || [];

        // Count email funnel events
        const emailStart = events.filter((e: { event_name: string }) => e.event_name === 'email_entry_start').length;
        const emailSubmitted = events.filter((e: { event_name: string }) => e.event_name === 'email_entry_submitted').length;
        const emailConfirmed = events.filter((e: { event_name: string }) => e.event_name === 'email_confirmed').length;

        setEmailFunnelStats({
          email_entry_start: emailStart,
          email_entry_submitted: emailSubmitted,
          email_confirmed: emailConfirmed,
          conversion_rate: emailStart > 0 ? ((emailConfirmed / emailStart) * 100).toFixed(1) : '0',
        });
      }
    } catch (err) {
      console.error("Failed to fetch email funnel stats:", err);
    }
  };

  // Fetch scenario save stats from event data
  const fetchScenarioSaveStats = async (timeframe: string = eventTimeframe) => {
    try {
      const response = await fetch(`/api/track-event?timeframe=${timeframe}`);
      if (response.ok) {
        const data = await response.json();
        const events = data.stats.recentEvents || [];

        // Count scenario save events
        const saveClicked = events.filter((e: { event_name: string }) => e.event_name === 'scenario_save_clicked');
        const saveClickedAuth = saveClicked.filter((e: { event_data?: { is_authenticated?: boolean } }) => e.event_data?.is_authenticated === true).length;
        const saveSuccess = events.filter((e: { event_name: string }) => e.event_name === 'scenario_save_success');
        const newSaves = saveSuccess.filter((e: { event_data?: { is_new?: boolean } }) => e.event_data?.is_new === true).length;

        setScenarioSaveStats({
          save_clicked: saveClicked.length,
          save_clicked_authenticated: saveClickedAuth,
          save_success: saveSuccess.length,
          new_saves: newSaves,
          conversion_rate: saveClicked.length > 0 ? ((saveSuccess.length / saveClicked.length) * 100).toFixed(1) : '0',
        });
      }
    } catch (err) {
      console.error("Failed to fetch scenario save stats:", err);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics(apiKey);
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    setShowCustomDate(newPeriod === "custom");
    const storedKey = sessionStorage.getItem("admin_api_key");
    if (storedKey && newPeriod !== "custom") {
      fetchAnalytics(storedKey, newPeriod);
    }
  };

  const handleCustomDateFilter = () => {
    const storedKey = sessionStorage.getItem("admin_api_key");
    if (storedKey && startDate && endDate) {
      fetchAnalytics(storedKey, "custom", startDate, endDate);
    }
  };

  // Check for stored API key on mount
  useEffect(() => {
    const storedKey = sessionStorage.getItem("admin_api_key");
    if (storedKey) {
      setApiKey(storedKey);
      fetchAnalytics(storedKey);
    }
  }, []);

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600 mb-6">Enter your admin API key to access analytics</p>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin API Key
              </label>
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
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? "Authenticating..." : "Access Dashboard"}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Note:</strong> The admin API key is set in your environment variables
              (ADMIN_API_KEY in .env.local)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard
  if (!analytics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">EV-Risk Analytics</h1>
              <p className="text-gray-600 mt-1">
                Last updated: {new Date(analytics.generated_at).toLocaleString()}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["all", "today", "week", "month", "custom"].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    period === p
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Export Summary Section */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Export Summary</h3>
                <div className="flex gap-2">
                  {(["today", "week", "month"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setExportPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        exportPeriod === p
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportToCSV}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <span className="animate-spin">...</span>
                  ) : (
                    <span>CSV</span>
                  )}
                  Export CSV
                </button>
                <button
                  onClick={exportToJSON}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <span className="animate-spin">...</span>
                  ) : (
                    <span>JSON</span>
                  )}
                  Export JSON
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Download a summary of all analytics data for the selected period
            </p>
          </div>

          {/* Custom Date Range Picker */}
          {showCustomDate && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleCustomDateFilter}
                  disabled={!startDate || !endDate}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Apply Filter
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Use this to filter out test data or view specific time periods
              </p>
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard
            title="Total Reports"
            value={analytics.overview.total_reports}
            subtitle={`${analytics.overview.free_reports} free, ${analytics.overview.paid_reports} paid`}
            icon="📊"
          />
          <MetricCard
            title="Unique Customers"
            value={analytics.overview.unique_customers_by_session || analytics.overview.unique_customers}
            subtitle={analytics.overview.unique_customers_by_session
              ? `By session (${analytics.overview.unique_customers} by email)`
              : "By email only"}
            icon="👥"
          />
          <MetricCard
            title="Conversion Rate"
            value={`${analytics.conversion.conversion_rate}%`}
            subtitle={`${analytics.conversion.converted_to_paid} of ${analytics.conversion.total_generated} converted`}
            icon="💰"
          />
          <MetricCard
            title="Total Revenue"
            value={`$${analytics.revenue.total_revenue}`}
            subtitle={`${analytics.revenue.paid_count} paid reports @ $${analytics.revenue.price_per_report}`}
            icon="💵"
          />
        </div>

        {/* Report Generation Funnel */}
        {analytics.funnel && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📈 Report Generation Funnel</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-sm text-blue-600 font-medium">Form Submissions</p>
                <p className="text-2xl font-bold text-blue-900">{analytics.funnel.form_submissions}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl">
                <p className="text-sm text-indigo-600 font-medium">Intake Submitted</p>
                <p className="text-2xl font-bold text-indigo-900">{analytics.funnel.intake_submitted}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl">
                <p className="text-sm text-purple-600 font-medium">Gen Started</p>
                <p className="text-2xl font-bold text-purple-900">{analytics.funnel.report_generation_started}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <p className="text-sm text-green-600 font-medium">Gen Succeeded</p>
                <p className="text-2xl font-bold text-green-900">{analytics.funnel.report_generation_succeeded}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-xl">
                <p className="text-sm text-red-600 font-medium">Gen Failed</p>
                <p className="text-2xl font-bold text-red-900">{analytics.funnel.report_generation_failed}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-xl">
                <p className="text-sm text-yellow-600 font-medium">Validation Failed</p>
                <p className="text-2xl font-bold text-yellow-900">{analytics.funnel.form_validation_failed}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl">
                <p className="text-sm text-emerald-600 font-medium">Success Rate</p>
                <p className="text-2xl font-bold text-emerald-900">{analytics.funnel.success_rate}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Why Checkpoint Stats */}
        {analytics.why_checkpoint && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">❓ Why Checkpoint Funnel</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-sm text-blue-600 font-medium">Shown</p>
                <p className="text-2xl font-bold text-blue-900">{analytics.why_checkpoint.shown}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <p className="text-sm text-green-600 font-medium">Submitted</p>
                <p className="text-2xl font-bold text-green-900">{analytics.why_checkpoint.submitted}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl">
                <p className="text-sm text-gray-600 font-medium">Skipped</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.why_checkpoint.skipped}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl">
                <p className="text-sm text-purple-600 font-medium">Submit Rate</p>
                <p className="text-2xl font-bold text-purple-900">{analytics.why_checkpoint.submit_rate}%</p>
              </div>
            </div>
          </div>
        )}

        {/* User Event Analytics Section */}
        {eventStats && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">📊 User Event Analytics</h2>
              <div className="flex gap-2">
                {["24h", "7d", "30d", "all"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setEventTimeframe(tf);
                      fetchEventStats(tf);
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      eventTimeframe === tf
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {tf === "24h" ? "24 Hours" : tf === "7d" ? "7 Days" : tf === "30d" ? "30 Days" : "All Time"}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Submissions */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Form Submissions</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Total Attempts</p>
                  <p className="text-2xl font-bold">{eventStats.formSubmissions?.total_attempts || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{eventStats.formSubmissions?.successful || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{eventStats.formSubmissions?.failed || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {eventStats.formSubmissions?.total_attempts > 0
                      ? ((eventStats.formSubmissions.successful / eventStats.formSubmissions.total_attempts) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* URL Autofill */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">URL Autofill</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Total Attempts</p>
                  <p className="text-2xl font-bold">{eventStats.urlAutofill?.total_attempts || 0}</p>
                </div>
                <div className="bg-green-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{eventStats.urlAutofill?.successful || 0}</p>
                </div>
                <div className="bg-red-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{eventStats.urlAutofill?.failed || 0}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {eventStats.urlAutofill?.total_attempts > 0
                      ? ((eventStats.urlAutofill.successful / eventStats.urlAutofill.total_attempts) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Blog Clicks */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Blog Engagement</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-orange-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Total Blog Clicks</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {eventStats.blogClicks?.reduce((sum: number, item: any) => sum + parseInt(item.total_clicks || 0), 0) || 0}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Unique Users</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {eventStats.blogClicks?.reduce((sum: number, item: any) => sum + parseInt(item.unique_users || 0), 0) || 0}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded">
                  <p className="text-sm text-gray-600">Click Sources</p>
                  <p className="text-2xl font-bold text-orange-600">{eventStats.blogClicks?.length || 0}</p>
                </div>
              </div>
            </div>

            {/* Conversion Funnel */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Conversion Funnel</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span>Total Visitors</span>
                  <span className="font-bold">{eventStats.conversionFunnel?.totalVisitors || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                  <span>Tried URL Autofill</span>
                  <span className="font-bold">
                    {eventStats.conversionFunnel?.triedAutofill || 0} ({eventStats.conversionFunnel?.autofillConversion || 0}%)
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                  <span>Submitted Form</span>
                  <span className="font-bold">
                    {eventStats.conversionFunnel?.submittedForm || 0} ({eventStats.conversionFunnel?.formConversion || 0}%)
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                  <span>Generated Report</span>
                  <span className="font-bold">
                    {eventStats.conversionFunnel?.generatedReport || 0} ({eventStats.conversionFunnel?.reportConversion || 0}%)
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
                  <span>Clicked Blog</span>
                  <span className="font-bold">
                    {eventStats.conversionFunnel?.clickedBlog || 0} ({eventStats.conversionFunnel?.blogConversion || 0}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Extracted Data Summary */}
            {eventStats.extractedDataSummary && eventStats.extractedDataSummary.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Most Extracted Vehicles (URL Autofill)</h3>
                <div className="space-y-2">
                  {eventStats.extractedDataSummary.slice(0, 10).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium">
                        {item.make} {item.model}
                      </span>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                        {item.count} extractions
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Events */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Recent Events (Last 50)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Event</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Details</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Visitor ID</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventStats.recentEvents?.slice(0, 50).map((event: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">
                          {event.event_name === "form_submit" && "📝 Form Submit"}
                          {event.event_name === "url_autofill_attempt" && "🔗 URL Autofill"}
                          {event.event_name === "blog_link_click" && "📖 Blog Click"}
                          {event.event_name === "button_click" && "🖱️ Button Click"}
                          {event.event_name === "report_generated" && "📊 Report Generated"}
                        </td>
                        <td className="px-4 py-2 text-gray-700 truncate max-w-[300px]">
                          {event.event_name === "form_submit" && (
                            <span className={event.event_data?.success ? "text-green-600" : "text-red-600"}>
                              {event.event_data?.success ? "✓ Success" : "✗ Failed"}
                              {event.event_data?.formData?.model && ` - ${event.event_data.formData.model}`}
                            </span>
                          )}
                          {event.event_name === "url_autofill_attempt" && (
                            <span className={event.event_data?.success ? "text-green-600" : "text-red-600"}>
                              {event.event_data?.success ? "✓ Success" : "✗ Failed"}
                              {event.event_data?.extractedData?.make && ` - ${event.event_data.extractedData.make} ${event.event_data.extractedData.model}`}
                            </span>
                          )}
                          {event.event_name === "blog_link_click" && (
                            <span className="text-orange-600">
                              {event.event_data?.source} → {event.event_data?.destination}
                            </span>
                          )}
                          {event.event_name === "button_click" && (
                            <span className="text-blue-600">{event.event_data?.buttonName}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-600 truncate max-w-[150px]">
                          {event.visitor_id?.substring(0, 16)}...
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Why Checkpoint Section */}
        {whyCheckpointStats && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">🎯 Why Checkpoint</h2>
              <div className="flex gap-2">
                {["24h", "7d", "30d", "all"].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      fetchWhyCheckpointStats(tf);
                      fetchEmailFunnelStats(tf);
                      fetchScenarioSaveStats(tf);
                    }}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      eventTimeframe === tf
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {tf === "24h" ? "24 Hours" : tf === "7d" ? "7 Days" : tf === "30d" ? "30 Days" : "All Time"}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkpoint Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium mb-1">Shown</p>
                <p className="text-3xl font-bold text-blue-900">{whyCheckpointStats.shown}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Submitted</p>
                <p className="text-3xl font-bold text-green-900">{whyCheckpointStats.submitted}</p>
              </div>
              <div className="bg-gray-100 rounded-xl p-4">
                <p className="text-sm text-gray-600 font-medium mb-1">Skipped</p>
                <p className="text-3xl font-bold text-gray-900">{whyCheckpointStats.skipped}</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-medium mb-1">Submit Rate</p>
                <p className="text-3xl font-bold text-purple-900">{whyCheckpointStats.submitRate}%</p>
              </div>
            </div>

            {/* Choice Distribution */}
            {Object.keys(whyCheckpointStats.choiceCounts).length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Choice Distribution</h3>
                <div className="space-y-2">
                  {Object.entries(whyCheckpointStats.choiceCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([choice, count]) => (
                      <div key={choice} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium capitalize text-gray-900">
                          {choice.replace(/_/g, ' ')}
                        </span>
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {Object.keys(whyCheckpointStats.choiceCounts).length === 0 && whyCheckpointStats.shown > 0 && (
              <p className="text-gray-500 text-sm">No submissions yet - users have only seen or skipped the checkpoint.</p>
            )}

            {whyCheckpointStats.shown === 0 && (
              <p className="text-gray-500 text-sm">No checkpoint data yet. Checkpoints appear on the report view page.</p>
            )}
          </div>
        )}

        {/* Email Funnel Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">📧 Email Funnel</h2>
          <p className="text-sm text-gray-500 mb-4">Login modal opens → Magic link sent → Auth confirmed</p>

          {emailFunnelStats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium mb-1">Modal Opened</p>
                <p className="text-3xl font-bold text-blue-900">{emailFunnelStats.email_entry_start}</p>
                <p className="text-xs text-blue-700 mt-1">Login modal views</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-medium mb-1">Magic Links Sent</p>
                <p className="text-3xl font-bold text-purple-900">{emailFunnelStats.email_entry_submitted}</p>
                <p className="text-xs text-purple-700 mt-1">Email submissions</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Auth Confirmed</p>
                <p className="text-3xl font-bold text-green-900">{emailFunnelStats.email_confirmed}</p>
                <p className="text-xs text-green-700 mt-1">Successful logins</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-sm text-amber-600 font-medium mb-1">Conversion Rate</p>
                <p className="text-3xl font-bold text-amber-900">{emailFunnelStats.conversion_rate}%</p>
                <p className="text-xs text-amber-700 mt-1">Open → Confirmed</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No email funnel data yet.</p>
          )}
        </div>

        {/* Scenario Save Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">💾 Scenario Saves</h2>
          <p className="text-sm text-gray-500 mb-4">Save button clicks → Successful saves</p>

          {scenarioSaveStats ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-sm text-indigo-600 font-medium mb-1">Save Clicked</p>
                <p className="text-3xl font-bold text-indigo-900">{scenarioSaveStats.save_clicked}</p>
                <p className="text-xs text-indigo-700 mt-1">Total clicks</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium mb-1">Authenticated</p>
                <p className="text-3xl font-bold text-blue-900">{scenarioSaveStats.save_clicked_authenticated}</p>
                <p className="text-xs text-blue-700 mt-1">Logged in users</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Save Success</p>
                <p className="text-3xl font-bold text-green-900">{scenarioSaveStats.save_success}</p>
                <p className="text-xs text-green-700 mt-1">Saved to DB</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-medium mb-1">New Saves</p>
                <p className="text-3xl font-bold text-purple-900">{scenarioSaveStats.new_saves}</p>
                <p className="text-xs text-purple-700 mt-1">First-time saves</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-sm text-amber-600 font-medium mb-1">Conversion</p>
                <p className="text-3xl font-bold text-amber-900">{scenarioSaveStats.conversion_rate}%</p>
                <p className="text-xs text-amber-700 mt-1">Click → Success</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No scenario save data yet.</p>
          )}
        </div>

        {/* Visitor Stats Section */}
        {visitorStats && (
          <>
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">🌐 Website Visitor Tracking</h2>
                <div className="flex gap-2">
                  {["24h", "7d", "30d", "all"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => {
                        setVisitorTimeframe(tf);
                        fetchVisitorStats(tf);
                      }}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        visitorTimeframe === tf
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {tf === "24h" ? "24 Hours" : tf === "7d" ? "7 Days" : tf === "30d" ? "30 Days" : "All Time"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visitor Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-purple-600 font-medium mb-1">Unique Visitors</p>
                  <p className="text-3xl font-bold text-purple-900">{visitorStats.uniqueVisitors || 0}</p>
                  <p className="text-xs text-purple-700 mt-1">
                    {visitorTimeframe === "24h" ? "Last 24 hours" : visitorTimeframe === "7d" ? "Last 7 days" : visitorTimeframe === "30d" ? "Last 30 days" : "All time"}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-600 font-medium mb-1">Total Page Views</p>
                  <p className="text-3xl font-bold text-blue-900">{visitorStats.totalPageViews || 0}</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Avg {visitorStats.uniqueVisitors > 0 ? (visitorStats.totalPageViews / visitorStats.uniqueVisitors).toFixed(1) : 0} views/visitor
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-sm text-green-600 font-medium mb-1">Top Page</p>
                  <p className="text-lg font-bold text-green-900 truncate">
                    {visitorStats.topPages?.[0]?.page_path || "/"}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {visitorStats.topPages?.[0]?.view_count || 0} views
                  </p>
                </div>
              </div>

              {/* Recent Visitors Table */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Recent Visitors (Last 20)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Visitor ID</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Page</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Referrer</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">First Visit</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Last Visit</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Visits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visitorStats.recentVisitors?.slice(0, 20).map((visitor: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-gray-600 truncate max-w-[150px]">
                            {visitor.visitor_id?.substring(0, 16)}...
                          </td>
                          <td className="px-4 py-2 text-gray-900 font-medium">{visitor.page_path || "/"}</td>
                          <td className="px-4 py-2 text-gray-600 truncate max-w-[200px]">
                            {visitor.referrer ? new URL(visitor.referrer).hostname : "Direct"}
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {new Date(visitor.first_visit).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-gray-600">
                            {new Date(visitor.last_visit).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                              {visitor.visit_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Pages */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">Top Pages</h3>
                <div className="space-y-2">
                  {visitorStats.topPages?.slice(0, 5).map((page: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-gray-400">{idx + 1}</span>
                        <div>
                          <p className="font-mono text-sm font-medium text-gray-900">{page.page_path}</p>
                          <p className="text-xs text-gray-600">
                            {page.unique_visitors} unique visitors
                          </p>
                        </div>
                      </div>
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                        {page.view_count} views
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Risk Distribution */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Risk Score Distribution</h2>
            <div className="space-y-3">
              {analytics.risk_distribution.map((risk) => (
                <div key={risk.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{risk.category}</span>
                    <span className="text-gray-600">
                      {risk.total_count} total ({risk.paid_count} paid)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        risk.category.includes("Green")
                          ? "bg-green-500"
                          : risk.category.includes("Yellow")
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${
                          (risk.total_count / analytics.overview.total_reports) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Rating Distribution</h2>
            <div className="space-y-3">
              {analytics.feedback.rating_distribution
                .sort((a, b) => b.rating - a.rating)
                .map((rating) => (
                  <div key={rating.rating}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{rating.rating} ⭐</span>
                      <span className="text-gray-600">{rating.count} reviews</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full"
                        style={{
                          width: `${
                            (rating.count / analytics.feedback.total_feedback) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Top Vehicles */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Top Vehicle Models</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Model</th>
                  <th className="text-left py-3 px-4">Year</th>
                  <th className="text-center py-3 px-4">Total Reports</th>
                  <th className="text-center py-3 px-4">Free</th>
                  <th className="text-center py-3 px-4">Paid</th>
                  <th className="text-center py-3 px-4">Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {analytics.top_vehicles.slice(0, 10).map((vehicle, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{vehicle.model}</td>
                    <td className="py-3 px-4">{vehicle.year || "N/A"}</td>
                    <td className="py-3 px-4 text-center">{vehicle.total_count}</td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {vehicle.free_count}
                    </td>
                    <td className="py-3 px-4 text-center text-green-600 font-medium">
                      {vehicle.paid_count}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {((vehicle.paid_count / vehicle.total_count) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicle Checkouts (from tracking) */}
        {analytics.vehicle_checkouts && analytics.vehicle_checkouts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Top Vehicles Checked Out (Last 30 Days)
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Vehicles users have viewed/analyzed on the report page
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Vehicle</th>
                    <th className="text-center py-3 px-4">Year</th>
                    <th className="text-center py-3 px-4">Checkouts</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.vehicle_checkouts.slice(0, 15).map((vehicle, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{vehicle.model || "Unknown"}</td>
                      <td className="py-3 px-4 text-center">{vehicle.year || "N/A"}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {vehicle.checkout_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Downloads */}
        {analytics.download_summary && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Report Downloads (Last 30 Days)
            </h2>

            {/* Download Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-sm text-indigo-600 font-medium mb-1">Total Downloads</p>
                <p className="text-3xl font-bold text-indigo-900">{analytics.download_summary.total_downloads}</p>
              </div>
              <div className="bg-gray-100 rounded-xl p-4">
                <p className="text-sm text-gray-600 font-medium mb-1">Free Reports</p>
                <p className="text-3xl font-bold text-gray-900">{analytics.download_summary.free_downloads}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Paid Reports</p>
                <p className="text-3xl font-bold text-green-900">{analytics.download_summary.paid_downloads}</p>
              </div>
            </div>

            {/* Downloads by Vehicle */}
            {analytics.report_downloads && analytics.report_downloads.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Downloads by Vehicle</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Vehicle</th>
                        <th className="text-center py-3 px-4">Year</th>
                        <th className="text-center py-3 px-4">Status</th>
                        <th className="text-center py-3 px-4">Downloads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.report_downloads.slice(0, 15).map((download, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">{download.model || "Unknown"}</td>
                          <td className="py-3 px-4 text-center">{download.year || "N/A"}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                download.status === "paid"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {download.status || "unknown"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                              {download.download_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Session Analytics (Decision Resolution) */}
        {sessionAnalytics && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Session Analytics (Last 30 Days)
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Tracking decision resolution from the EV Routine Check
            </p>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium mb-1">Total Sessions</p>
                <p className="text-2xl font-bold text-blue-900">{sessionAnalytics.overview.total_sessions}</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-green-600 font-medium mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-900">{sessionAnalytics.overview.completed_sessions}</p>
                <p className="text-xs text-green-600">{sessionAnalytics.overview.completion_rate}% rate</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-sm text-purple-600 font-medium mb-1">Viewed Results</p>
                <p className="text-2xl font-bold text-purple-900">{sessionAnalytics.overview.viewed_results}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-sm text-orange-600 font-medium mb-1">With Resolution</p>
                <p className="text-2xl font-bold text-orange-900">{sessionAnalytics.overview.with_resolution}</p>
                <p className="text-xs text-orange-600">{sessionAnalytics.overview.resolution_rate}% of viewed</p>
              </div>
            </div>

            {/* IP & Scenario Metrics */}
            {sessionAnalytics.ip_metrics && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">IP & Scenario Metrics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-indigo-50 rounded-xl p-4">
                    <p className="text-sm text-indigo-600 font-medium mb-1">Unique Scenarios</p>
                    <p className="text-2xl font-bold text-indigo-900">{sessionAnalytics.ip_metrics.unique_scenarios}</p>
                    <p className="text-xs text-indigo-600">Distinct input combinations</p>
                  </div>
                  <div className="bg-teal-50 rounded-xl p-4">
                    <p className="text-sm text-teal-600 font-medium mb-1">Novel Scenarios</p>
                    <p className="text-2xl font-bold text-teal-900">{sessionAnalytics.ip_metrics.novel_scenarios}</p>
                    <p className="text-xs text-teal-600">First-time combinations</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-600 font-medium mb-1">Engine Version</p>
                    <p className="text-2xl font-bold text-gray-900">v{sessionAnalytics.ip_metrics.engine_version}</p>
                    <p className="text-xs text-gray-600">Scoring algorithm</p>
                  </div>
                </div>
              </div>
            )}

            {/* Decision Outcomes */}
            {sessionAnalytics.decision_outcomes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Decision Outcomes</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {sessionAnalytics.decision_outcomes.map((outcome, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{outcome.count}</p>
                      <p className="text-xs text-gray-600">{outcome.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fit Signals Distribution */}
            {sessionAnalytics.fit_signals.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Fit Signal Distribution</h3>
                <div className="flex flex-wrap gap-3">
                  {sessionAnalytics.fit_signals.map((signal, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg px-4 py-2 ${
                        signal.signal === "GOOD"
                          ? "bg-green-100 text-green-800"
                          : signal.signal === "CONDITIONAL"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      <span className="font-bold">{signal.count}</span>
                      <span className="ml-2 text-sm">{signal.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Surfaced New Tradeoff */}
            {sessionAnalytics.surfaced_tradeoff.total > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Surfaced New Tradeoff?</h3>
                <div className="flex items-center gap-4">
                  <div className="bg-green-50 rounded-lg px-4 py-2">
                    <span className="font-bold text-green-800">{sessionAnalytics.surfaced_tradeoff.yes}</span>
                    <span className="ml-2 text-sm text-green-700">Yes</span>
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <span className="font-bold text-gray-800">{sessionAnalytics.surfaced_tradeoff.no}</span>
                    <span className="ml-2 text-sm text-gray-700">No</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    ({sessionAnalytics.surfaced_tradeoff.rate}% surfaced new considerations)
                  </div>
                </div>
              </div>
            )}

            {/* Recent Sessions with Resolution */}
            {sessionAnalytics.recent_sessions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Recent Sessions with Resolution</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Date</th>
                        <th className="text-left py-2 px-3">Fit Signal</th>
                        <th className="text-left py-2 px-3">Decision</th>
                        <th className="text-center py-2 px-3">New Tradeoff?</th>
                        <th className="text-left py-2 px-3">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionAnalytics.recent_sessions.slice(0, 10).map((session, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-600">
                            {new Date(session.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                session.fit_signal === "GOOD"
                                  ? "bg-green-100 text-green-800"
                                  : session.fit_signal === "CONDITIONAL"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : session.fit_signal === "HIGH_FRICTION"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {session.fit_signal || "N/A"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-900">
                            {session.decision_outcome?.replace(/_/g, " ").toLowerCase() || "N/A"}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {session.surfaced_new_tradeoff === true
                              ? "✅"
                              : session.surfaced_new_tradeoff === false
                              ? "❌"
                              : "—"}
                          </td>
                          <td className="py-2 px-3 text-gray-600">{session.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Willingness to Pay Analysis */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Willingness to Pay by Vehicle Model
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Model</th>
                  <th className="text-center py-3 px-4">Total Reports</th>
                  <th className="text-center py-3 px-4">Paid Reports</th>
                  <th className="text-center py-3 px-4">Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                {analytics.willingness_to_pay.map((item, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{item.model}</td>
                    <td className="py-3 px-4 text-center">{item.total_reports}</td>
                    <td className="py-3 px-4 text-center text-green-600 font-medium">
                      {item.paid_reports}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          item.conversion_rate >= 50
                            ? "bg-green-100 text-green-800"
                            : item.conversion_rate >= 25
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.conversion_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Feedback (Report-specific) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Report Feedback</h2>
          <div className="space-y-4">
            {analytics.recent_feedback.map((feedback, idx) => (
              <div key={idx} className="border-b pb-4 last:border-b-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-500">
                        {"⭐".repeat(feedback.rating)}
                      </span>
                      <span className="text-sm text-gray-600">{feedback.vehicle}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      feedback.would_recommend
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {feedback.would_recommend ? "Would Recommend" : "Would Not Recommend"}
                  </span>
                </div>
                <p className="text-gray-700">{feedback.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Application Feedback (New System) */}
        {appFeedback && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">📣 Application Feedback</h2>
              <div className="flex gap-2">
                <select
                  value={feedbackType || "all"}
                  onChange={(e) => {
                    const type = e.target.value === "all" ? null : e.target.value;
                    setFeedbackType(type);
                    fetchAppFeedback(feedbackLimit, type);
                  }}
                  className="px-3 py-1 rounded-lg text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="general">General</option>
                  <option value="bug">Bug Reports</option>
                  <option value="feature">Feature Requests</option>
                  <option value="accuracy">Accuracy Issues</option>
                  <option value="ux">UX Feedback</option>
                </select>
                <select
                  value={feedbackLimit}
                  onChange={(e) => {
                    const limit = parseInt(e.target.value);
                    setFeedbackLimit(limit);
                    fetchAppFeedback(limit, feedbackType);
                  }}
                  className="px-3 py-1 rounded-lg text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Feedback</p>
                <p className="text-2xl font-bold">{appFeedback.count || 0}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-600">General</p>
                <p className="text-2xl font-bold text-blue-900">
                  {appFeedback.feedback?.filter((f: any) => f.feedback_type === "general").length || 0}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-600">Bugs</p>
                <p className="text-2xl font-bold text-red-900">
                  {appFeedback.feedback?.filter((f: any) => f.feedback_type === "bug").length || 0}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-600">Features</p>
                <p className="text-2xl font-bold text-green-900">
                  {appFeedback.feedback?.filter((f: any) => f.feedback_type === "feature").length || 0}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-600">Accuracy</p>
                <p className="text-2xl font-bold text-purple-900">
                  {appFeedback.feedback?.filter((f: any) => f.feedback_type === "accuracy").length || 0}
                </p>
              </div>
            </div>

            {/* Feedback Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Feedback</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">IP</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {appFeedback.feedback?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.feedback_type === "bug"
                              ? "bg-red-100 text-red-800"
                              : item.feedback_type === "feature"
                              ? "bg-green-100 text-green-800"
                              : item.feedback_type === "accuracy"
                              ? "bg-purple-100 text-purple-800"
                              : item.feedback_type === "ux"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.feedback_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700 truncate max-w-[150px]">
                        {item.email || <span className="text-gray-400">No email</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-900">
                        <details className="cursor-pointer">
                          <summary className="font-medium">View Details</summary>
                          <div className="mt-2 p-3 bg-gray-50 rounded text-xs space-y-2">
                            {item.helpful && (
                              <div>
                                <strong className="text-gray-700">Helpful?</strong>
                                <p className="text-gray-600">{item.helpful}</p>
                              </div>
                            )}
                            {item.missing && (
                              <div>
                                <strong className="text-gray-700">Missing/Inaccurate:</strong>
                                <p className="text-gray-600">{item.missing}</p>
                              </div>
                            )}
                            {item.additional_data && (
                              <div>
                                <strong className="text-gray-700">Additional Data Needed:</strong>
                                <p className="text-gray-600">{item.additional_data}</p>
                              </div>
                            )}
                            {item.comments && (
                              <div>
                                <strong className="text-gray-700">Comments:</strong>
                                <p className="text-gray-600">{item.comments}</p>
                              </div>
                            )}
                          </div>
                        </details>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-600 truncate max-w-[120px]">
                        {item.ip_address}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Daily Trend */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Daily Activity (Last 30 Days)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-center py-3 px-4">Total</th>
                  <th className="text-center py-3 px-4">Free</th>
                  <th className="text-center py-3 px-4">Paid</th>
                </tr>
              </thead>
              <tbody>
                {analytics.daily_trend.slice(0, 14).map((day, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {new Date(day.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center font-medium">{day.total}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{day.free}</td>
                    <td className="py-3 px-4 text-center text-green-600 font-medium">
                      {day.paid}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Logout Button */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              sessionStorage.removeItem("admin_api_key");
              setIsAuthenticated(false);
              setAnalytics(null);
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

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
}) {
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
