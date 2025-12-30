/**
 * HARD BLOCKER #1: Decision State Summary (Report Closure)
 *
 * GLOBAL RULES COMPLIANCE:
 * - NO recommendations
 * - NO scores
 * - NO next-step pressure
 * - Acknowledges uncertainty explicitly
 * - Helps users "land" the decision cognitively
 *
 * Purpose:
 * Answers "Where does this leave me?" and "What kind of decision is this right now?"
 */

interface DecisionStateSummaryProps {
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
  chargingInputs?: {
    primaryChargingType?: "home" | "apartment_shared" | "public_only";
    chargingReliability?: "usually_available" | "sometimes_available" | "unpredictable";
    backupPlanWithin15Min?: boolean;
    weeklyChargingMoments?: "1-2" | "3-4" | "5+";
  };
  vehicleAge?: number;
  vehicleModel?: string;
}

export default function DecisionStateSummary({
  confidenceInputs,
  chargingInputs,
  vehicleAge,
  vehicleModel,
}: DecisionStateSummaryProps) {
  // Calculate what information we have
  const hasBasicListing =
    confidenceInputs.listing.hasModel && confidenceInputs.listing.hasAge;
  const hasPersonalization =
    confidenceInputs.personalization.hasDrivingPattern ||
    confidenceInputs.personalization.hasChargingAccess;
  const hasBatteryData = confidenceInputs.batteryHealth.hasSOHReport;
  const hasChargingPattern = chargingInputs?.primaryChargingType !== undefined;

  // Identify primary uncertainty sources
  const uncertaintySources: string[] = [];
  if (!hasBatteryData) uncertaintySources.push("battery health");
  if (!hasPersonalization) uncertaintySources.push("your usage patterns");
  if (!hasChargingPattern) uncertaintySources.push("charging routine fit");

  // Identify sensitivity factors
  const sensitivityFactors: string[] = [];
  if (chargingInputs?.primaryChargingType === "apartment_shared") {
    sensitivityFactors.push("apartment charging availability changes");
  }
  if (chargingInputs?.primaryChargingType === "public_only") {
    sensitivityFactors.push("public charger reliability");
  }
  if (
    chargingInputs?.chargingReliability === "unpredictable" ||
    chargingInputs?.chargingReliability === "sometimes_available"
  ) {
    sensitivityFactors.push("charging access uncertainty");
  }
  if (!confidenceInputs.batteryHealth.hasSOHReport) {
    sensitivityFactors.push("actual battery condition");
  }
  if (vehicleAge && vehicleAge > 5) {
    sensitivityFactors.push("long-term battery degradation patterns");
  }

  // Generate decision state summary
  const getDecisionState = (): {
    title: string;
    description: string;
    uncertaintyContext: string;
  } => {
    // High uncertainty: Missing critical data
    if (uncertaintySources.length >= 2) {
      return {
        title: "Exploratory Decision",
        description:
          "This decision involves significant unknowns that would typically be resolved before committing.",
        uncertaintyContext: `Uncertainty is concentrated in ${uncertaintySources.join(", ")}. These gaps are normal for used EV listings, but they mean this report provides general context rather than vehicle-specific guidance.`,
      };
    }

    // Sensitive to specific factors
    if (sensitivityFactors.length >= 2) {
      return {
        title: "Contextually Viable Decision",
        description:
          "This decision is viable but sensitive to factors that may change or vary.",
        uncertaintyContext: `The ownership experience depends heavily on ${sensitivityFactors.slice(0, 2).join(" and ")}. If these remain stable, friction stays low. If they shift, friction increases.`,
      };
    }

    // High-friction pattern detected
    if (
      chargingInputs?.primaryChargingType === "public_only" &&
      (chargingInputs?.weeklyChargingMoments === "3-4" ||
        chargingInputs?.weeklyChargingMoments === "5+")
    ) {
      return {
        title: "Adaptation-Required Decision",
        description:
          "This decision requires ongoing routine adaptation to work smoothly.",
        uncertaintyContext:
          "The ownership pattern involves frequent public charging sessions, which most owners find mentally taxing over time. This setup works best if you genuinely enjoy the charging routine or have high schedule flexibility.",
      };
    }

    // Battery uncertainty dominates
    if (!hasBatteryData && hasPersonalization) {
      return {
        title: "Usage-Supported, Battery-Uncertain Decision",
        description:
          "Your usage patterns are well-understood, but battery health uncertainty remains.",
        uncertaintyContext:
          "Uncertainty is concentrated in long-term battery performance, not immediate usability. A battery health report would clarify replacement timing expectations.",
      };
    }

    // Well-supported with minor gaps
    if (hasBasicListing && hasPersonalization) {
      return {
        title: "Well-Contextualized Decision",
        description:
          "This decision is supported by both vehicle details and your usage context.",
        uncertaintyContext:
          uncertaintySources.length > 0
            ? `Remaining uncertainty centers on ${uncertaintySources[0]}, which is normal for used EV listings. The core fit question is well-addressed.`
            : "The core fit question is well-addressed with available information. Typical used-car due diligence applies.",
      };
    }

    // Listing-only fallback
    return {
      title: "Listing-Based Decision",
      description:
        "This decision is based on publicly available listing information without personalization.",
      uncertaintyContext:
        "This report provides general context for this vehicle category. Your actual experience would depend on usage patterns, charging access, and specific battery condition.",
    };
  };

  const decisionState = getDecisionState();

  return (
    <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 rounded-2xl shadow-xl p-8 mb-8 border-2 border-purple-200">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-3">
          <svg
            className="w-8 h-8 mr-3 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900">
            Where This Leaves You
          </h2>
        </div>
        <p className="text-sm text-gray-600 italic">
          Confidence reflects how supported this guidance is — not vehicle quality.
        </p>
      </div>

      {/* Decision State */}
      <div className="bg-white rounded-xl p-6 mb-6 border border-purple-200">
        <h3 className="text-xl font-bold text-gray-900 mb-3">
          {decisionState.title}
        </h3>
        <p className="text-gray-800 leading-relaxed mb-4">
          {decisionState.description}
        </p>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <p className="text-sm text-gray-800">{decisionState.uncertaintyContext}</p>
        </div>
      </div>

      {/* What This Means */}
      <div className="bg-white rounded-xl p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          What this means for your decision:
        </h3>
        <div className="space-y-3">
          {/* Always show uncertainty acknowledgment */}
          <div className="flex items-start">
            <span className="text-purple-600 mr-3 mt-1">•</span>
            <p className="text-gray-700">
              <span className="font-semibold">Uncertainty is normal.</span> All used
              vehicle purchases involve unknowns. This report identifies them explicitly
              rather than hiding them.
            </p>
          </div>

          {/* Context-specific guidance */}
          {sensitivityFactors.length > 0 && (
            <div className="flex items-start">
              <span className="text-purple-600 mr-3 mt-1">•</span>
              <p className="text-gray-700">
                <span className="font-semibold">Pay attention to stability.</span> This
                setup depends on {sensitivityFactors[0]}. If this factor remains stable,
                friction stays manageable.
              </p>
            </div>
          )}

          {!hasBatteryData && (
            <div className="flex items-start">
              <span className="text-purple-600 mr-3 mt-1">•</span>
              <p className="text-gray-700">
                <span className="font-semibold">Battery health is knowable.</span> A
                pre-purchase inspection or diagnostic scan can resolve battery uncertainty
                before committing.
              </p>
            </div>
          )}

          {/* Always show this */}
          <div className="flex items-start">
            <span className="text-purple-600 mr-3 mt-1">•</span>
            <p className="text-gray-700">
              <span className="font-semibold">Your decision, your context.</span> This
              report explains patterns and surfaces unknowns. Only you know your tolerance
              for uncertainty and adaptation.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Guardrail - NO RECOMMENDATIONS */}
      <div className="mt-6 pt-6 border-t border-purple-200">
        <p className="text-sm text-gray-600 italic text-center">
          This report does not recommend purchasing or avoiding this vehicle. It explains
          fit, uncertainty, and typical friction patterns to inform your decision.
        </p>
      </div>
    </div>
  );
}
