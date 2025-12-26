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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setAnalytics(null);
    } finally {
      setLoading(false);
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
