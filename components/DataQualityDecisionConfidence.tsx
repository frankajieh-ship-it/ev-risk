/**
 * Phase 0.5 Module 1A: Data Quality & Decision Confidence
 *
 * GLOBAL RULES COMPLIANCE:
 * - Renders for ALL users (no conditional display)
 * - Explains confidence based on what's known and what's missing
 * - NO "good/bad" language or color coding implying judgment
 * - NO final verdicts or recommendations to buy/not buy
 * - Reduces mental overhead by explaining, not judging
 *
 * Sprint 1 Requirements:
 * - Show Decision Confidence value with plain-English explanation
 * - Reference what's known and what's missing (without anxiety)
 * - Treat missing data as NORMAL (not a problem to fix urgently)
 */

interface ConfidenceInputs {
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
}

interface DataQualityDecisionConfidenceProps {
  confidenceInputs: ConfidenceInputs;
  vehicleYear?: number;
  vehicleModel?: string;
}

export default function DataQualityDecisionConfidence({
  confidenceInputs,
  vehicleYear,
  vehicleModel,
}: DataQualityDecisionConfidenceProps) {
  // Calculate what's known
  const knownCount =
    Object.values(confidenceInputs.listing).filter(Boolean).length +
    Object.values(confidenceInputs.personalization).filter(Boolean).length +
    Object.values(confidenceInputs.batteryHealth).filter(Boolean).length;

  const totalPossible = 11; // Total data points we could have

  // Generate plain-English confidence explanation (NO percentage, NO color coding)
  const getConfidenceExplanation = (): {
    level: string;
    description: string;
  } => {
    const hasBasicListing =
      confidenceInputs.listing.hasModel && confidenceInputs.listing.hasAge;
    const hasPersonalization =
      confidenceInputs.personalization.hasDrivingPattern ||
      confidenceInputs.personalization.hasChargingAccess;
    const hasBatteryData = confidenceInputs.batteryHealth.hasSOHReport;

    if (hasBatteryData && hasPersonalization) {
      return {
        level: "Well-supported",
        description:
          "This assessment is based on vehicle-specific battery data and your personal usage patterns. We have most of the information needed to provide context-specific guidance.",
      };
    }

    if (hasPersonalization && hasBasicListing) {
      return {
        level: "Moderately supported",
        description:
          "This assessment combines listing data with your usage patterns. It provides personalized context, though vehicle-specific battery health data would add precision.",
      };
    }

    if (hasBasicListing) {
      return {
        level: "Listing-based",
        description:
          "This assessment uses publicly available listing information. It provides general context based on this vehicle's year, model, and mileage patterns for similar vehicles.",
      };
    }

    return {
      level: "Limited information",
      description:
        "This assessment is based on minimal vehicle details. We're using general patterns for EVs in this category.",
    };
  };

  const confidence = getConfidenceExplanation();

  // What we know
  const knownItems: string[] = [];
  if (confidenceInputs.listing.hasModel)
    knownItems.push(`${vehicleYear || ""} ${vehicleModel || "Vehicle model"}`);
  if (confidenceInputs.listing.hasMileage) knownItems.push("Reported mileage");
  if (confidenceInputs.listing.hasAge) knownItems.push("Vehicle age");
  if (confidenceInputs.listing.hasTrim) knownItems.push("Trim level");
  if (confidenceInputs.listing.hasVIN) knownItems.push("VIN");
  if (confidenceInputs.personalization.hasDrivingPattern)
    knownItems.push("Your daily driving distance");
  if (confidenceInputs.personalization.hasChargingAccess)
    knownItems.push("Your charging setup");
  if (confidenceInputs.personalization.hasZipCode)
    knownItems.push("Your location (for climate context)");
  if (confidenceInputs.batteryHealth.hasSOHReport)
    knownItems.push("Battery State of Health report");
  if (confidenceInputs.batteryHealth.hasChargingHistory)
    knownItems.push("Fast-charging history");

  // What's missing (neutral tone, no urgency)
  const missingItems: string[] = [];
  if (!confidenceInputs.listing.hasMileage)
    missingItems.push("Current mileage");
  if (!confidenceInputs.listing.hasTrim) missingItems.push("Specific trim level");
  if (!confidenceInputs.listing.hasVIN) missingItems.push("Vehicle VIN");
  if (!confidenceInputs.personalization.hasDrivingPattern)
    missingItems.push("Your typical daily driving distance");
  if (!confidenceInputs.personalization.hasChargingAccess)
    missingItems.push("Your home/work charging access");
  if (!confidenceInputs.personalization.hasZipCode)
    missingItems.push("Your location");
  if (!confidenceInputs.batteryHealth.hasSOHReport)
    missingItems.push("Battery State of Health report");
  if (!confidenceInputs.batteryHealth.hasChargingHistory)
    missingItems.push("Past fast-charging frequency");

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
      {/* Header - NO color coding, NO judgment */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Decision Confidence: {confidence.level}
        </h2>
        <p className="text-gray-700 leading-relaxed">{confidence.description}</p>
        <p className="text-xs text-gray-600 italic border-l-2 border-blue-400 pl-3 mt-3">
          Confidence reflects how supported this guidance is — not vehicle quality.
        </p>
      </div>

      {/* What we're working with */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          What we're working with:
        </h3>
        {knownItems.length > 0 ? (
          <ul className="space-y-2">
            {knownItems.map((item, idx) => (
              <li key={idx} className="flex items-start text-gray-700">
                <span className="mr-2 text-gray-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 italic">
            We have minimal listing information for this vehicle.
          </p>
        )}
      </div>

      {/* What's missing - NO anxiety, NO urgency */}
      {missingItems.length > 0 && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            What we don't have yet:
          </h3>
          <ul className="space-y-2">
            {missingItems.map((item, idx) => (
              <li key={idx} className="flex items-start text-gray-600">
                <span className="mr-2 text-gray-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-600 mt-3 italic">
            Missing data is completely normal for used EV listings. This just means
            we're using general patterns instead of vehicle-specific details.
          </p>
        </div>
      )}

      {/* Data count (informational only, NO scoring) */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">Data points available:</span> {knownCount} of{" "}
          {totalPossible} possible inputs
        </p>
        <p className="text-xs text-gray-600 mt-2">
          This report is useful regardless of how many data points we have. More data
          means more precision, not more validity.
        </p>
      </div>
    </div>
  );
}
