"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface BatteryRisk {
  score: number;
  weight: number;
  degradation_percent: number;
  estimated_replacement_cost: number;
  chemistry: string;
  details: string;
}

interface PlatformRisk {
  score: number;
  weight: number;
  critical_recalls: number;
  total_recalls: number;
  reliability_score: number;
  details: string;
}

interface OwnershipFit {
  score: number;
  weight: number;
  climate_impact: string;
  charger_density: string;
  annual_miles_fit: string;
  details: string;
}

interface BuyConfidence {
  overall_score: number;
  rating: "GREEN" | "YELLOW" | "RED";
  emoji: "🟢" | "🟡" | "🔴";
  recommendation: string;
  battery_risk: BatteryRisk;
  platform_risk: PlatformRisk;
  ownership_fit: OwnershipFit;
}

interface ReportData {
  success: boolean;
  input: {
    model: string;
    year: number;
    zipCode: string;
    dailyMiles: number;
    homeCharging: boolean;
    riskTolerance: string;
  };
  confidence: BuyConfidence;
  breakdown: string[];
  timestamp: string;
}

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    // Check for 'data' param (normal flow) or 'payload' param (after payment)
    const dataParam = searchParams.get("data");
    const payloadParam = searchParams.get("payload");
    const paidParam = searchParams.get("paid");
    const reportIdParam = searchParams.get("reportId");

    // Set paid status and reportId
    setIsPaid(paidParam === "true");
    setReportId(reportIdParam);

    if (dataParam) {
      try {
        const parsed = JSON.parse(dataParam) as ReportData;
        setReportData(parsed);
      } catch (e) {
        console.error("Failed to parse report data:", e);
        router.push("/");
      }
    } else if (payloadParam) {
      try {
        // Decode base64 payload (with Unicode support)
        const decoded = decodeURIComponent(
          atob(payloadParam)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const parsed = JSON.parse(decoded) as ReportData;
        setReportData(parsed);
      } catch (e) {
        console.error("Failed to parse payload:", e);
        router.push("/");
      }
    } else {
      router.push("/");
    }
  }, [searchParams, router]);

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  const { confidence, input, breakdown } = reportData;

  // Determine background color based on rating
  const bgColorClass = {
    GREEN: "from-green-50 via-white to-green-50",
    YELLOW: "from-yellow-50 via-white to-yellow-50",
    RED: "from-red-50 via-white to-red-50",
  }[confidence.rating];

  const scoreColorClass = {
    GREEN: "text-green-600",
    YELLOW: "text-yellow-600",
    RED: "text-red-600",
  }[confidence.rating];

  const badgeColorClass = {
    GREEN: "bg-green-100 text-green-800 border-green-300",
    YELLOW: "bg-yellow-100 text-yellow-800 border-yellow-300",
    RED: "bg-red-100 text-red-800 border-red-300",
  }[confidence.rating];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgColorClass}`}>
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Back Button and Actions */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            New Analysis
          </button>

          <div className="flex gap-3">
            {isPaid && reportId && (
              <a
                href={`/api/report/${reportId}/pdf`}
                download
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </a>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
            <button
              onClick={() => {
                const shareData = {
                  title: `EV-Risk™ Report: ${input.year} ${input.model}`,
                  text: `Risk Score: ${confidence.overall_score}/100 (${confidence.rating})`,
                  url: window.location.href,
                };
                if (navigator.share) {
                  navigator.share(shareData);
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  alert("Link copied to clipboard!");
                }
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            EV-Risk™ Report
          </h1>
          <p className="text-gray-600">
            {input.year} {input.model}
          </p>
        </div>

        {/* Main Score Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-10 mb-8 border border-gray-200">
          <div className="text-center mb-8">
            <div className="text-8xl mb-4">{confidence.emoji}</div>
            <div className={`text-7xl font-bold ${scoreColorClass} mb-2`}>
              {confidence.overall_score}/100
            </div>
            <div className="text-sm text-gray-500 mb-4">
              {confidence.overall_score >= 80 ? "Better than 75% of similar vehicles" :
               confidence.overall_score >= 65 ? "Better than 50% of similar vehicles" :
               confidence.overall_score >= 50 ? "Average for this model year" :
               "Below average - proceed with caution"}
            </div>
            <div className={`inline-block px-6 py-2 rounded-full border-2 ${badgeColorClass} text-xl font-semibold mb-4`}>
              {confidence.rating} BUY CONFIDENCE
            </div>
            <p className="text-lg text-gray-700 max-w-2xl mx-auto">
              {confidence.recommendation}
            </p>
          </div>

          {/* Score Breakdown */}
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {/* Battery Risk */}
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">
                Battery Risk
              </h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {confidence.battery_risk.score}
              </div>
              <div className="text-xs text-gray-500 mb-3">
                Weight: {confidence.battery_risk.weight * 100}%
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${confidence.battery_risk.score}%` }}
                />
              </div>
            </div>

            {/* Platform Risk */}
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">
                Platform Risk
              </h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {confidence.platform_risk.score}
              </div>
              <div className="text-xs text-gray-500 mb-3">
                Weight: {confidence.platform_risk.weight * 100}%
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${confidence.platform_risk.score}%` }}
                />
              </div>
            </div>

            {/* Ownership Fit */}
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">
                Ownership Fit
              </h3>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {confidence.ownership_fit.score}
              </div>
              <div className="text-xs text-gray-500 mb-3">
                Weight: {confidence.ownership_fit.weight * 100}%
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: `${confidence.ownership_fit.score}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Score Interpretation Guide */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-6 mb-8 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Understanding Your Score</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-2">🟢</span>
                <span className="font-bold text-green-700">75-100: Low Risk</span>
              </div>
              <p className="text-sm text-gray-600">
                Good purchase candidate. Battery health is strong, minimal recalls, good ownership fit.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-yellow-500">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-2">🟡</span>
                <span className="font-bold text-yellow-700">50-74: Moderate Risk</span>
              </div>
              <p className="text-sm text-gray-600">
                Consider carefully. Get battery health report and budget for potential repairs within 2-3 years.
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border-l-4 border-red-500">
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-2">🔴</span>
                <span className="font-bold text-red-700">0-49: High Risk</span>
              </div>
              <p className="text-sm text-gray-600">
                Proceed with caution. Likely needs battery replacement or major repairs soon. Negotiate price accordingly.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Detailed Risk Analysis
          </h2>

          {/* Battery Risk Details */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
              Battery Risk ({confidence.battery_risk.score}/100)
            </h3>
            <p className="text-gray-700 mb-2">{confidence.battery_risk.details}</p>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Estimated Degradation</p>
                <p className="text-2xl font-bold text-blue-600">{confidence.battery_risk.degradation_percent}%</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Replacement Cost Estimate</p>
                <p className="text-2xl font-bold text-blue-600">${confidence.battery_risk.estimated_replacement_cost.toLocaleString()}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Typical range: ${Math.round(confidence.battery_risk.estimated_replacement_cost * 0.6).toLocaleString()} - ${Math.round(confidence.battery_risk.estimated_replacement_cost * 1.25).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Platform Risk Details */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-purple-600 rounded-full mr-3"></span>
              Platform Risk ({confidence.platform_risk.score}/100)
            </h3>
            <p className="text-gray-700 mb-2">{confidence.platform_risk.details}</p>
            <div className="grid md:grid-cols-3 gap-4 mt-3">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Total Recalls</p>
                <p className="text-2xl font-bold text-purple-600">{confidence.platform_risk.total_recalls}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Critical Recalls</p>
                <p className="text-2xl font-bold text-purple-600">{confidence.platform_risk.critical_recalls}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Reliability Score</p>
                <p className="text-2xl font-bold text-purple-600">{confidence.platform_risk.reliability_score}/10</p>
              </div>
            </div>
          </div>

          {/* Ownership Fit Details */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-3"></span>
              Ownership Fit ({confidence.ownership_fit.score}/100)
            </h3>
            <p className="text-gray-700 mb-2">{confidence.ownership_fit.details}</p>
            <div className="grid md:grid-cols-3 gap-4 mt-3">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Climate Impact</p>
                <p className="text-lg font-bold text-green-600">{confidence.ownership_fit.climate_impact}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Charger Density</p>
                <p className="text-lg font-bold text-green-600">{confidence.ownership_fit.charger_density}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Daily Range Fit</p>
                <p className="text-lg font-bold text-green-600">{confidence.ownership_fit.annual_miles_fit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Paid Upsell CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl shadow-2xl p-8 mb-8 text-white">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-3">🔍 Want the Full Picture?</h2>
            <p className="text-xl text-blue-100">Get our comprehensive 12-page report for only $15</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">What's Included:</h3>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Model-specific failure rate analysis</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Price negotiation talking points</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Pre-purchase inspection checklist</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Dealer questions script</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Battery health verification steps</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>5-year total cost of ownership estimate</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">Why Upgrade?</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">💰</span>
                  <div>
                    <div className="font-semibold">Save Thousands</div>
                    <div className="text-sm text-blue-100">Armed with negotiation data points</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-3xl mr-3">🛡️</span>
                  <div>
                    <div className="font-semibold">Avoid Costly Mistakes</div>
                    <div className="text-sm text-blue-100">Know exactly what to inspect</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-3xl mr-3">📊</span>
                  <div>
                    <div className="font-semibold">Data-Backed Confidence</div>
                    <div className="text-sm text-blue-100">Real failure rates, not guesses</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={async () => {
                try {
                  // Step 1: Create draft report in database
                  const createResponse = await fetch('/api/report/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportData })
                  });

                  if (!createResponse.ok) {
                    throw new Error('Failed to create report');
                  }

                  const { reportId } = await createResponse.json();

                  // Step 2: Create Stripe checkout session with reportId
                  const checkoutResponse = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportId })
                  });

                  const checkoutData = await checkoutResponse.json();

                  if (checkoutData.url) {
                    // Redirect to Stripe Checkout
                    window.location.href = checkoutData.url;
                  } else {
                    alert('Failed to create checkout session. Please try again.');
                  }
                } catch (error) {
                  console.error('Checkout error:', error);
                  alert('An error occurred. Please try again.');
                }
              }}
              className="bg-white text-blue-600 font-bold text-lg px-12 py-4 rounded-full hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get Full Report - $15 (One-Time Payment)
            </button>
            <p className="mt-4 text-sm text-blue-100">
              ✓ Printable web view  ✓ 30-day money-back guarantee  ✓ Secure payment via Stripe
            </p>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Next Steps (Free Version)
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Schedule a pre-purchase inspection with a certified EV technician</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Request battery health report showing current State of Health (SoH)</span>
            </li>
            {confidence.platform_risk.total_recalls > 0 && (
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 mt-1">✓</span>
                <span className="text-gray-700">Verify all {confidence.platform_risk.total_recalls} recall(s) have been completed by dealer</span>
              </li>
            )}
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Check for remaining manufacturer warranty coverage</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Consider extended warranty if available and vehicle score is Yellow/Red</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          {/* Data Sources Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-3">Data Sources & Methodology</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <div className="font-semibold text-gray-800 mb-1">Battery Degradation</div>
                <div>Geotab, Recurrent Auto, Tesla Impact Report (2023)</div>
              </div>
              <div>
                <div className="font-semibold text-gray-800 mb-1">Recalls & Reliability</div>
                <div>NHTSA database, 10,000+ owner reports, Consumer Reports</div>
              </div>
              <div>
                <div className="font-semibold text-gray-800 mb-1">Infrastructure Data</div>
                <div>US DOE Alternative Fuels Data Center, NOAA climate data</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Last updated: January 2025 • Covers 150+ EV models (2010-2025)
            </p>
          </div>

          <p className="text-sm text-gray-500 mb-2">
            Report generated: {new Date(reportData.timestamp).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            <strong className="text-gray-800">⚡ Tool by EV analysts</strong> - This report is for informational purposes only.
            <br />
            <strong>Always obtain a pre-purchase inspection</strong> from a certified EV technician before purchasing.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
