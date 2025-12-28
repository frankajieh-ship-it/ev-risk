/**
 * Phase 0.5: Missing Data Explanation Generator
 *
 * Purpose: Generate context-aware explanations for missing data
 * Rules:
 * - Never blame the user
 * - Never say "data unavailable"
 * - Always explain: what's missing, why it matters, how to resolve it
 */

export interface MissingDataPoint {
  what: string;
  whyItMatters: string;
  howToResolve: string;
}

export interface VehicleContext {
  model?: string;
  age?: number;
  mileage?: number;
  range?: number;
  hasBatteryReport?: boolean;
  hasChargingInfo?: boolean;
}

export interface PersonalizationContext {
  hasDrivingPattern: boolean;
  hasChargingAccess: boolean;
  hasRiskTolerance: boolean;
  hasZipCode: boolean;
}

/**
 * Generate vehicle-specific missing data explanations
 */
export function generateMissingDataExplanations(
  vehicleContext: VehicleContext,
  personalizationContext: PersonalizationContext
): MissingDataPoint[] {
  const missing: MissingDataPoint[] = [];

  // Battery Health Report (high priority)
  if (!vehicleContext.hasBatteryReport) {
    missing.push({
      what: "Battery State of Health (SOH) Report",
      whyItMatters:
        "Shows actual remaining capacity vs. original. Critical for accurate risk assessment.",
      howToResolve:
        "Request from dealer, use OBD-II scanner (LEAF Spy, TorquePro), or get pre-purchase inspection at EV specialist.",
    });
  }

  // Driving Pattern (personalization)
  if (!personalizationContext.hasDrivingPattern) {
    missing.push({
      what: "Your Daily Driving Pattern",
      whyItMatters:
        "Without knowing your typical usage, we can't tell if this vehicle's range comfortably fits your needs.",
      howToResolve:
        "Estimate your average daily miles (commute + errands). If uncertain, check your current odometer change over a typical week.",
    });
  }

  // Charging Access (personalization)
  if (!personalizationContext.hasChargingAccess) {
    missing.push({
      what: "Your Charging Infrastructure",
      whyItMatters:
        "Home charging access changes ownership costs by ~60% and affects which EVs are practical for you.",
      howToResolve:
        "Determine if you have access to: home outlet (110V), Level 2 home charger, or rely solely on public charging.",
    });
  }

  // ZIP Code / Climate (personalization)
  if (!personalizationContext.hasZipCode) {
    missing.push({
      what: "Local Climate Data",
      whyItMatters:
        "Extreme heat or cold accelerates battery degradation and reduces range. Climate zone affects long-term ownership risk.",
      howToResolve: "Provide your ZIP code to assess local climate impact.",
    });
  }

  // DC Fast-Charging History (vehicle-specific)
  if (!vehicleContext.hasChargingInfo) {
    missing.push({
      what: "DC Fast-Charging History",
      whyItMatters:
        "Frequent high-speed charging (above 80%) accelerates battery degradation. Knowing charge patterns improves accuracy.",
      howToResolve:
        "Ask seller if vehicle was primarily fast-charged or home-charged. Some EVs show charge history in settings.",
    });
  }

  // Range-specific warning (if low range vehicle)
  if (vehicleContext.range && vehicleContext.range < 200) {
    if (!personalizationContext.hasDrivingPattern) {
      // Already added above, but increase priority in messaging
      const drivingPattern = missing.find((item) =>
        item.what.includes("Daily Driving")
      );
      if (drivingPattern) {
        drivingPattern.whyItMatters =
          `This vehicle has ~${vehicleContext.range} miles of range. ` +
          drivingPattern.whyItMatters;
      }
    }
  }

  return missing;
}

/**
 * Generate primary missing item (for Trust Calibration Section)
 */
export function getPrimaryMissingExplanation(
  vehicleContext: VehicleContext
): {
  title: string;
  explanation: string;
  fallback: string;
} {
  // Priority 1: Battery Health Report
  if (!vehicleContext.hasBatteryReport) {
    return {
      title: "We couldn't verify this vehicle's battery health report",
      explanation: `Without it, we estimate risk using:
• ${vehicleContext.mileage?.toLocaleString() || "Unknown"} miles reported
• ${vehicleContext.age || "Unknown"} years since manufacture
• Average degradation patterns for ${vehicleContext.model || "this model"}`,
      fallback:
        "If you can obtain a battery report or share how you plan to use the vehicle, we can significantly narrow this estimate.",
    };
  }

  // Priority 2: Charging History
  if (!vehicleContext.hasChargingInfo) {
    return {
      title: "We don't have this vehicle's charging history",
      explanation: `DC fast-charging frequency significantly affects battery health. We're using:
• Model-level typical usage patterns
• Age and mileage as proxies
• Conservative degradation estimates`,
      fallback:
        "Ask the seller about charging habits (mostly home vs. mostly fast-charged). This single detail can improve accuracy by 15-20%.",
    };
  }

  // Default: Working with listing data
  return {
    title: "We're working with listing-level data",
    explanation: `Our assessment uses:
• Reported mileage: ${vehicleContext.mileage?.toLocaleString() || "Unknown"}
• Vehicle age: ${vehicleContext.age || "Unknown"} years
• Model-level battery characteristics`,
    fallback:
      "Sharing your driving patterns and charging setup would help us personalize this assessment to YOUR situation.",
  };
}

/**
 * Generate personalization opportunities (for PersonalizationOpportunityCard)
 */
export function generatePersonalizationOpportunities(
  vehicleContext: VehicleContext,
  personalizationContext: PersonalizationContext
): Array<{ icon: string; text: string; show: boolean }> {
  return [
    {
      icon: "🚗",
      text: "Whether this range comfortably covers YOUR commute",
      show:
        !personalizationContext.hasDrivingPattern &&
        (vehicleContext.range || 0) < 250,
    },
    {
      icon: "⚡",
      text: "How your charging access changes ownership risk and costs",
      show: !personalizationContext.hasChargingAccess,
    },
    {
      icon: "📊",
      text: "How battery degradation affects YOUR specific driving pattern",
      show:
        !personalizationContext.hasDrivingPattern &&
        (vehicleContext.age || 0) > 4,
    },
    {
      icon: "💰",
      text: "Actual ownership costs based on YOUR usage and location",
      show:
        !personalizationContext.hasDrivingPattern ||
        !personalizationContext.hasZipCode,
    },
    {
      icon: "🌡️",
      text: "How YOUR local climate affects battery longevity",
      show: !personalizationContext.hasZipCode,
    },
  ].filter((opp) => opp.show);
}
