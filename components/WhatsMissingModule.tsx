/**
 * Phase 0.5 Module 1B: What's Missing (Honest Uncertainty)
 *
 * GLOBAL RULES COMPLIANCE:
 * - For each missing critical input: show what, why (1 sentence), how (1 sentence)
 * - Missing data = NORMAL (not a problem, not urgent)
 * - NO anxiety language, NO warning emojis, NO urgency
 * - Reduces mental overhead by normalizing uncertainty
 *
 * Sprint 1 Requirements:
 * - List each missing data point separately
 * - Explain why it matters (1 sentence max)
 * - Explain how to get it (1 sentence max)
 * - Treat as informational, not prescriptive
 */

interface MissingDataItem {
  field: string;
  whyItMatters: string; // 1 sentence
  howToGetIt: string; // 1 sentence
  category: "vehicle" | "usage" | "battery";
}

interface WhatsMissingModuleProps {
  confidenceInputs: {
    listing: {
      hasMileage: boolean;
      hasAge: boolean;
      hasModel: boolean;
      hasTrim: boolean;
      hasVIN: boolean;
    };
    personalization: {
      hasDrivingPattern: boolean;
      hasChargingAccess: boolean;
      hasRiskTolerance: boolean;
      hasZipCode: boolean;
    };
    batteryHealth: {
      hasSOHReport: boolean;
      hasChargingHistory: boolean;
    };
  };
}

export default function WhatsMissingModule({
  confidenceInputs,
}: WhatsMissingModuleProps) {
  // Generate missing data list (only critical items)
  const missingData: MissingDataItem[] = [];

  if (!confidenceInputs.listing.hasMileage) {
    missingData.push({
      field: "Current mileage",
      whyItMatters:
        "Helps estimate how much the battery has been cycled relative to its age.",
      howToGetIt: "Listed on Carfax, vehicle history report, or odometer photo.",
      category: "vehicle",
    });
  }

  if (!confidenceInputs.listing.hasVIN) {
    missingData.push({
      field: "Vehicle Identification Number (VIN)",
      whyItMatters:
        "Allows checking for completed recalls, specific battery pack version, and warranty status.",
      howToGetIt: "Ask the seller or dealer for the VIN before scheduling a test drive.",
      category: "vehicle",
    });
  }

  if (!confidenceInputs.personalization.hasDrivingPattern) {
    missingData.push({
      field: "Your typical daily driving distance",
      whyItMatters:
        "Determines whether this vehicle's range comfortably covers your routine without range anxiety.",
      howToGetIt:
        "Check your current odometer or use Google Maps to estimate your daily commute + errands.",
      category: "usage",
    });
  }

  if (!confidenceInputs.personalization.hasChargingAccess) {
    missingData.push({
      field: "Your charging access (home, work, public)",
      whyItMatters:
        "Home charging completely changes the ownership experience compared to public-only charging.",
      howToGetIt:
        "Check if your parking spot has a 120V outlet (Level 1) or if you can install a 240V charger (Level 2).",
      category: "usage",
    });
  }

  if (!confidenceInputs.batteryHealth.hasSOHReport) {
    missingData.push({
      field: "Battery State of Health (SOH) report",
      whyItMatters:
        "Shows the actual current capacity compared to when the battery was new.",
      howToGetIt:
        "Request from dealer, obtain during pre-purchase inspection, or access via the vehicle's onboard diagnostics.",
      category: "battery",
    });
  }

  if (!confidenceInputs.batteryHealth.hasChargingHistory) {
    missingData.push({
      field: "Fast-charging usage history",
      whyItMatters:
        "Frequent DC fast charging can accelerate battery degradation over time.",
      howToGetIt:
        "Ask the seller about their charging habits, or check if charging logs are available in the vehicle's app.",
      category: "battery",
    });
  }

  if (!confidenceInputs.personalization.hasZipCode) {
    missingData.push({
      field: "Your location (zip code)",
      whyItMatters:
        "Extreme heat or cold affects battery performance and charging infrastructure availability varies by region.",
      howToGetIt: "Simply provide your zip code or general metro area.",
      category: "usage",
    });
  }

  // If nothing is missing, don't render this module
  if (missingData.length === 0) {
    return null;
  }

  // Group by category for better organization
  const vehicleData = missingData.filter((item) => item.category === "vehicle");
  const usageData = missingData.filter((item) => item.category === "usage");
  const batteryData = missingData.filter((item) => item.category === "battery");

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
      {/* Header - NO warning emoji, NO anxiety */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          What's missing (and what it would add)
        </h2>
        <p className="text-gray-700 leading-relaxed">
          These data points would add precision to this assessment. Missing them is
          completely normal for used EV listings—this is just context about what they
          would provide.
        </p>
      </div>

      {/* Vehicle-specific data */}
      {vehicleData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Vehicle-specific details:
          </h3>
          <div className="space-y-4">
            {vehicleData.map((item, idx) => (
              <div
                key={idx}
                className="border-l-4 border-blue-300 bg-blue-50 p-4 rounded-r-lg"
              >
                <p className="font-semibold text-gray-900 mb-2">{item.field}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">Why it matters:</span>{" "}
                    {item.whyItMatters}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">How to get it:</span> {item.howToGetIt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage-specific data */}
      {usageData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Your usage patterns:
          </h3>
          <div className="space-y-4">
            {usageData.map((item, idx) => (
              <div
                key={idx}
                className="border-l-4 border-purple-300 bg-purple-50 p-4 rounded-r-lg"
              >
                <p className="font-semibold text-gray-900 mb-2">{item.field}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">Why it matters:</span>{" "}
                    {item.whyItMatters}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">How to get it:</span> {item.howToGetIt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Battery health data */}
      {batteryData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Battery health details:
          </h3>
          <div className="space-y-4">
            {batteryData.map((item, idx) => (
              <div
                key={idx}
                className="border-l-4 border-green-300 bg-green-50 p-4 rounded-r-lg"
              >
                <p className="font-semibold text-gray-900 mb-2">{item.field}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">Why it matters:</span>{" "}
                    {item.whyItMatters}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">How to get it:</span> {item.howToGetIt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom reassurance - normalize missing data */}
      <div className="bg-gray-50 rounded-lg p-4 mt-6">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Note:</span> This assessment is useful even
          without these details. They would add precision and personalization, but their
          absence doesn't invalidate the general patterns we've identified.
        </p>
      </div>
    </div>
  );
}
