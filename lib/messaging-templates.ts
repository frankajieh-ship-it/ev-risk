/**
 * Reusable Messaging Templates
 *
 * Purpose: Decision-supporting voice across all sections
 * Pattern: [Metric] + [Practical meaning] + [Confidence] + [Action with value]
 */

import {
  percentageToRange,
  degradationToRange,
  calibrateConfidenceLabel,
  addWhyThisMatters,
  type PersonalizationValue,
  type ConfidenceExplanation,
} from "./voice-patterns";

/**
 * Template: Battery Health & Longevity
 */
export function batteryHealthTemplate(
  degradationPercent: number,
  vehicleAge: number,
  originalRange: number = 263
) {
  return {
    title: "Battery Health & Longevity",

    estimate: `Based on this model's age (${vehicleAge} years) and average use, we estimate ${percentageToRange(
      degradationPercent
    )} battery capacity loss compared to new.`,

    practicalMeaning: `This leaves ${degradationToRange(degradationPercent, originalRange)}.`,

    confidence: {
      label: "Medium",
      explanation: calibrateConfidenceLabel(
        "medium",
        "similar vehicles, not this specific car's history",
        "Adding your actual annual mileage would adjust the projection by up to ±2 years for replacement timing."
      ),
    },

    action: {
      prompt: "To improve this estimate:",
      value: "Share your annual mileage → We'll distinguish between highway (gentler) and city (more taxing) wear patterns → which adjusts replacement timing by ±2 years",
    },

    decisionImpact: "This affects whether you should budget for battery replacement in the next 3–5 years.",
  };
}

/**
 * Template: Recalls & Safety Issues
 */
export function recallsTemplate(
  recallCount: number,
  safetyRelatedCount: number,
  primaryDescription: string,
  typicalTimeline: string = "3–7 days"
) {
  return {
    title: "Open Recalls",

    summary: `${recallCount} recall${recallCount > 1 ? "s" : ""} require${
      recallCount === 1 ? "s" : ""
    } attention before purchase${
      safetyRelatedCount > 0
        ? `, including ${safetyRelatedCount} affecting safety systems`
        : ""
    }.`,

    context: `The primary recall addresses ${primaryDescription}. This is a safety-related fix that dealers are prioritizing.`,

    nextStep: `Confirm with the seller that repairs have been completed. If not, factor in that this typically requires one dealer visit and may take ${typicalTimeline} to schedule.`,

    whyItMatters: "Unresolved recalls can delay registration and affect financing approval.",

    urgency: safetyRelatedCount > 0 ? "before-purchase" : "low-priority",
  };
}

/**
 * Template: Charging Infrastructure
 */
export function chargingInfraTemplate(
  hasHomeCharging: boolean,
  zipCode?: string,
  nearbyStations?: number
) {
  if (hasHomeCharging) {
    return {
      title: "Charging Infrastructure",

      summary: "Home charging access significantly reduces your dependency on public infrastructure and lowers per-mile costs by ~60%.",

      practicalMeaning: "With home charging, you'll wake up to a full battery daily, eliminating most range anxiety and charging stops.",

      confidence: {
        label: "High",
        explanation: "This is based on your confirmed home charging access.",
      },

      tip: zipCode
        ? `Your area has ${nearbyStations || "several"} public charging stations as backup for longer trips.`
        : "Consider identifying nearby public chargers for occasional long trips.",
    };
  } else {
    return {
      title: "Charging Infrastructure",

      summary: "Without home charging, you'll rely primarily on public infrastructure, which increases per-mile costs and requires more planning.",

      practicalMeaning: "Plan to charge 2–3 times per week at public stations, adding ~$800–$1,200 annually vs. home charging.",

      recommendation: "Strongly consider installing a Level 2 home charger (typical cost: $500–$1,500) to reduce costs by ~60% and improve convenience.",

      confidence: {
        label: "Medium",
        explanation: "This assumes typical public charging rates in your area.",
      },
    };
  }
}

/**
 * Template: Ownership Fit (Personalized)
 */
export function ownershipFitTemplate(
  dailyMiles: number,
  estimatedRange: number,
  homeCharging: boolean
) {
  const dailyUsagePercent = Math.round((dailyMiles / estimatedRange) * 100);

  let fitLevel: "excellent" | "good" | "viable" | "challenging";
  if (dailyUsagePercent < 40) fitLevel = "excellent";
  else if (dailyUsagePercent < 60) fitLevel = "good";
  else if (dailyUsagePercent < 80) fitLevel = "viable";
  else fitLevel = "challenging";

  const fitMessages = {
    excellent: "well within this vehicle's capabilities with ample buffer",
    good: "suitable for this vehicle with comfortable margin",
    viable: "manageable but requires planning for longer trips",
    challenging: "at the upper limit of practical range; consider shorter commute or higher-range EV",
  };

  return {
    title: "Ownership Fit - Personalized for You",

    dailyUsage: `Your ${dailyMiles} miles/day uses approximately ${dailyUsagePercent}% of current usable range (~${estimatedRange} miles).`,

    assessment: `This usage pattern is ${fitMessages[fitLevel]}.`,

    chargingImpact: homeCharging
      ? "Home charging access significantly reduces your dependency on public infrastructure and lowers per-mile costs by ~60%."
      : "Consider installing home charging to reduce costs by ~60% vs. public charging and improve daily convenience.",

    confidence: {
      label: "High",
      explanation: "This assessment is based on your specific usage patterns.",
    },
  };
}

/**
 * Template: Price & Value Assessment
 */
export function priceValueTemplate(
  askingPrice: number,
  estimatedFairValue: number,
  batteryReplacementRisk: "low" | "medium" | "high"
) {
  const priceDelta = askingPrice - estimatedFairValue;
  const percentDelta = Math.round((priceDelta / estimatedFairValue) * 100);

  let priceAssessment: string;
  if (percentDelta < -5) {
    priceAssessment = "below market value — this may indicate seller motivation or undisclosed issues";
  } else if (percentDelta < 5) {
    priceAssessment = "aligned with market value";
  } else if (percentDelta < 10) {
    priceAssessment = "slightly above market value — negotiation recommended";
  } else {
    priceAssessment = "significantly above market value — strong negotiation or walk away";
  }

  const batteryAdjustment = {
    low: "$0–$500",
    medium: "$1,000–$2,000",
    high: "$3,000–$5,000",
  };

  return {
    title: "Price & Value Assessment",

    asking: `Asking price: $${askingPrice.toLocaleString()}`,

    fairValue: `Estimated fair value: $${estimatedFairValue.toLocaleString()} (${
      percentDelta > 0 ? "+" : ""
    }${percentDelta}%)`,

    assessment: priceAssessment,

    batteryAdjustment: `Factor in ${
      batteryAdjustment[batteryReplacementRisk]
    } adjustment for battery replacement risk (${batteryReplacementRisk} risk).`,

    negotiationTip:
      batteryReplacementRisk === "high"
        ? "Use battery health concerns as negotiation leverage — request recent battery diagnostic or price reduction."
        : "Standard negotiation applies — reference comparable listings in your area.",
  };
}

/**
 * Template: Confidence Improvement Prompts
 */
export function confidencePromptTemplate(
  missingData: string[],
  currentConfidence: number
) {
  const prompts: Record<string, PersonalizationValue> = {
    dailyMiles: {
      dataPoint: "your daily mileage",
      analysis: "calculate precise range buffer and charging frequency",
      outcome: "ownership fit score",
      quantifiedRange: "10–15% more accurate",
    },
    homeCharging: {
      dataPoint: "your charging setup",
      analysis: "estimate actual ownership costs",
      outcome: "total cost of ownership",
      quantifiedRange: "±$400/year",
    },
    zipCode: {
      dataPoint: "your ZIP code",
      analysis: "assess local climate impact and charging infrastructure",
      outcome: "battery longevity estimate",
      quantifiedRange: "±1–2 years",
    },
    annualMiles: {
      dataPoint: "your annual mileage",
      analysis: "distinguish highway vs. city wear patterns",
      outcome: "replacement timing",
      quantifiedRange: "±2 years",
    },
  };

  const potentialConfidence = currentConfidence + missingData.length * 10;

  return {
    currentConfidence: `${currentConfidence}%`,
    potentialConfidence: `~${Math.min(potentialConfidence, 95)}%`,

    message: `Adding ${missingData.length} data point${
      missingData.length > 1 ? "s" : ""
    } would increase confidence from ${currentConfidence}% to ~${Math.min(
      potentialConfidence,
      95
    )}%`,

    prompts: missingData.map((key) => prompts[key]).filter(Boolean),
  };
}

/**
 * Template: Next Steps Recommendations
 */
export function nextStepsTemplate(
  batteryRisk: "low" | "medium" | "high",
  hasOpenRecalls: boolean,
  priceOverMarket: boolean
) {
  const steps: string[] = [];

  // Battery-related steps
  if (batteryRisk === "high") {
    steps.push(
      "🔋 **Critical**: Obtain battery health report (SOH%) before purchase — this is non-negotiable for high-risk vehicles"
    );
    steps.push(
      "⚡ Request recent charging history if available — helps validate battery condition"
    );
  } else if (batteryRisk === "medium") {
    steps.push(
      "🔋 **Recommended**: Request battery health report (SOH%) or factor $1,000–$2,000 into offer"
    );
  } else {
    steps.push(
      "🔋 Standard pre-purchase inspection including battery check (cost: $100–$200)"
    );
  }

  // Recall-related steps
  if (hasOpenRecalls) {
    steps.push(
      "⚠️ **Before purchase**: Confirm all recalls completed or get completion timeline from dealer"
    );
  }

  // Price-related steps
  if (priceOverMarket) {
    steps.push(
      "💰 Negotiate price down or request battery warranty extension to offset risk"
    );
  }

  // Standard steps
  steps.push("🚗 Test drive focusing on range display and charging behavior");
  steps.push(
    "📋 Review CARFAX/AutoCheck for accident history and service records"
  );

  return {
    title: "Recommended Next Steps",
    steps,
    timeline: "Complete these within 2–3 days of serious interest to maintain momentum.",
  };
}
