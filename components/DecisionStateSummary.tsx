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
      {/* Decision State - Minimal Display */}
      <div className="bg-white rounded-xl p-6 border border-purple-200">
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
