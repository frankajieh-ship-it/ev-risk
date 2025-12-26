"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    model: "",
    year: new Date().getFullYear() - 3, // Default to 3 years old (realistic used EV)
    trim: "", // Battery size/trim (Standard, Long Range, Performance, etc.)
    currentMileage: 36000, // Default ~12k miles/year for 3 years
    zipCode: "",
    dailyMiles: 30,
    homeCharging: true,
    riskTolerance: "moderate" as "conservative" | "moderate" | "aggressive",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate score");
      }

      // Navigate to results page with score data
      const queryParams = new URLSearchParams({
        data: JSON.stringify(data),
      });
      router.push(`/report?${queryParams.toString()}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          {/* OFFO Lab Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/offo-lab-logo.png"
              alt="OFFO Lab Consulting"
              className="h-16 w-auto"
            />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            EV-Risk™
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            EV Reliability Copilot
          </p>
          <p className="text-xl font-semibold text-gray-800 mb-3">
            Don't guess the battery. Check any used EV's risk in 2 minutes.
          </p>
          <div className="flex justify-center items-center gap-6 text-sm text-gray-500">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>150+ EV models</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>10,000+ owner reports</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Updated Jan 2025</span>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Model Input */}
            <div>
              <label htmlFor="model" className="block text-sm font-semibold text-gray-700 mb-2">
                EV Model
              </label>
              <input
                type="text"
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Tesla Model 3 Long Range"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the full model name (e.g., "Tesla Model 3 Long Range", "Chevy Bolt EV")
              </p>
            </div>

            {/* Year Input */}
            <div>
              <label htmlFor="year" className="block text-sm font-semibold text-gray-700 mb-2">
                Model Year
              </label>
              <select
                id="year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select Year</option>
                {Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Trim/Battery Size Input */}
            <div>
              <label htmlFor="trim" className="block text-sm font-semibold text-gray-700 mb-2">
                Trim / Battery Size
              </label>
              <input
                type="text"
                id="trim"
                value={formData.trim}
                onChange={(e) => setFormData({ ...formData, trim: e.target.value })}
                placeholder="e.g., Long Range, Standard Range, Performance"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional - helps refine battery chemistry and range estimate
              </p>
            </div>

            {/* Current Mileage Input */}
            <div>
              <label htmlFor="currentMileage" className="block text-sm font-semibold text-gray-700 mb-2">
                Current Odometer (miles)
              </label>
              <input
                type="number"
                id="currentMileage"
                value={formData.currentMileage}
                onChange={(e) => setFormData({ ...formData, currentMileage: parseInt(e.target.value) })}
                min={0}
                max={300000}
                step={1000}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current mileage on the vehicle - affects battery degradation estimate
              </p>
            </div>

            {/* ZIP Code Input */}
            <div>
              <label htmlFor="zipCode" className="block text-sm font-semibold text-gray-700 mb-2">
                Your ZIP Code
              </label>
              <input
                type="text"
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                placeholder="e.g., 94103"
                pattern="\d{5}"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used to assess climate impact and charging infrastructure
              </p>
            </div>

            {/* Daily Miles Input */}
            <div>
              <label htmlFor="dailyMiles" className="block text-sm font-semibold text-gray-700 mb-2">
                Daily Driving (miles)
              </label>
              <input
                type="number"
                id="dailyMiles"
                value={formData.dailyMiles}
                onChange={(e) => setFormData({ ...formData, dailyMiles: parseInt(e.target.value) })}
                min={0}
                max={500}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current value: {formData.dailyMiles} miles/day (~{(formData.dailyMiles * 365).toLocaleString()} miles/year)
              </p>
            </div>

            {/* Home Charging Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label htmlFor="homeCharging" className="block text-sm font-semibold text-gray-700">
                  Home Charging Available?
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Do you have access to a home charger (Level 2 or 110V)?
                </p>
              </div>
              <input
                type="checkbox"
                id="homeCharging"
                checked={formData.homeCharging}
                onChange={(e) => setFormData({ ...formData, homeCharging: e.target.checked })}
                className="w-6 h-6 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Risk Tolerance Radio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Your Risk Tolerance
              </label>
              <div className="space-y-3">
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value="conservative"
                    checked={formData.riskTolerance === "conservative"}
                    onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                    className="w-4 h-4 mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-semibold text-gray-900">Conservative</span>
                    <p className="text-xs text-gray-600 mt-1">Only show Green if battery health is excellent and no major recalls. Recommended for most buyers.</p>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value="moderate"
                    checked={formData.riskTolerance === "moderate"}
                    onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                    className="w-4 h-4 mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-semibold text-gray-900">Moderate</span>
                    <p className="text-xs text-gray-600 mt-1">Balanced scoring - accept some degradation if price is right. Good for cost-conscious buyers.</p>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value="aggressive"
                    checked={formData.riskTolerance === "aggressive"}
                    onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                    className="w-4 h-4 mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-semibold text-gray-900">Aggressive</span>
                    <p className="text-xs text-gray-600 mt-1">Willing to accept higher risk for deep discounts. Assumes you can budget for repairs/replacement.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-green-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Calculating Score..." : "Get My Risk Score →"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-blue-900">⚡ Tool by EV analysts</span> - EV-Risk™ uses publicly available data, NHTSA recalls, and 10,000+ owner reports to provide risk assessments. Data updated January 2025.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            <strong>Always obtain a pre-purchase inspection</strong> from a certified EV technician before purchasing.
            <br />
            This tool provides guidance only and does not replace professional inspection.
          </p>

          {/* OFFO Lab Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-center mb-3">
              <img
                src="/offo-lab-logo.png"
                alt="OFFO Lab Consulting"
                className="h-10 w-auto opacity-80"
              />
            </div>
            <p className="text-xs text-gray-500">
              Powered by{" "}
              <a
                href="https://offolab.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                OFFO Lab Consulting
              </a>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
