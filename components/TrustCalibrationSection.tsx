/**
 * Phase 0.5: TrustCalibrationSection
 *
 * Purpose: The most important psychological component
 * Key Message: "Here's what we don't know — and why that matters"
 * Builds: Credibility, Authority, Safety
 *
 * Engineering Rules:
 * - Never blame the user
 * - Never say "data unavailable"
 * - Always explain: what's missing, why it matters, how to resolve it
 */

interface MissingDataPoint {
  what: string;
  whyItMatters: string;
  howToResolve: string;
}

interface TrustCalibrationSectionProps {
  vehicleData: {
    mileage?: number;
    age?: number;
    model?: string;
    hasBatteryReport?: boolean;
  };
  missingData: MissingDataPoint[];
}

export default function TrustCalibrationSection({
  vehicleData,
  missingData,
}: TrustCalibrationSectionProps) {
  // Generate primary missing data explanation
  const getPrimaryMissing = (): {
    title: string;
    explanation: string;
    fallback: string;
  } => {
    if (!vehicleData.hasBatteryReport) {
      return {
        title: "We couldn't verify this vehicle's battery health report",
        explanation: `Without it, we estimate risk using:
• ${vehicleData.mileage?.toLocaleString() || "Unknown"} miles reported
• ${vehicleData.age || "Unknown"} years since manufacture
• Average degradation patterns for ${vehicleData.model || "this model"}`,
        fallback:
          "If you can obtain a battery report or share how you plan to use the vehicle, we can significantly narrow this estimate.",
      };
    }

    // Default fallback if battery report exists
    return {
      title: "We're working with listing-level data",
      explanation: `Our assessment uses:
• Reported mileage and age
• Model-level battery characteristics
• Industry-standard degradation curves`,
      fallback:
        "Sharing your driving patterns and charging setup would help us personalize this assessment to YOUR situation.",
    };
  };

  const primary = getPrimaryMissing();

  return (
    <div className="bg-white border-2 border-orange-300 rounded-2xl shadow-lg p-8 mb-8">
      {/* Header */}
      <div className="flex items-start mb-6">
        <div className="flex-shrink-0 mr-4">
          <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            ⚠️ What's missing — and why it matters
          </h3>
        </div>
      </div>

      {/* Primary Missing Data */}
      <div className="mb-6">
        <h4 className="text-lg font-bold text-gray-900 mb-3">{primary.title}</h4>

        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded mb-4">
          <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
            {primary.explanation}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Resolution Path:</p>
          <p className="text-sm text-blue-800">{primary.fallback}</p>
        </div>
      </div>

      {/* Additional Missing Data Points (if any) */}
      {missingData.length > 0 && (
        <div className="border-t-2 border-gray-200 pt-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4">
            Other data that would improve accuracy:
          </h4>

          <div className="space-y-4">
            {missingData.map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4"
              >
                <p className="text-sm font-semibold text-gray-900 mb-2">
                  📋 {item.what}
                </p>
                <p className="text-xs text-gray-700 mb-2">
                  <span className="font-semibold">Why it matters:</span>{" "}
                  {item.whyItMatters}
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">How to get it:</span>{" "}
                  {item.howToResolve}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom reassurance */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600 italic">
          💡 <span className="font-semibold">Remember:</span> This report is still
          useful — these gaps just mean we're being conservative with our estimates.
          As you gather more info, you can always update your assessment.
        </p>
      </div>
    </div>
  );
}
