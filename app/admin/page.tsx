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
}

export default function AdminDashboard() {
  const [apiKey, setApiKey] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [visitorStats, setVisitorStats] = useState<any>(null);
  const [eventStats, setEventStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [visitorTimeframe, setVisitorTimeframe] = useState("30d");
  const [eventTimeframe, setEventTimeframe] = useState("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);

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

      // Fetch visitor stats and event stats
      await fetchVisitorStats(visitorTimeframe);
      await fetchEventStats(eventTimeframe);
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
          <MetricCard
            title="Avg Rating"
            value={analytics.feedback.avg_rating.toFixed(1)}
            subtitle={`${analytics.feedback.total_feedback} feedback submissions`}
            icon="⭐"
          />
        </div>

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

        {/* Recent Feedback */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Feedback</h2>
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
