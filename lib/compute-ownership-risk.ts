/**
 * computeOwnershipRisk - V2 Secondary Scoring
 *
 * Wraps existing scoring engine to produce OwnershipRiskFlags.
 * Individual modules can be "unknown" if data is missing.
 * If no vehicle data at all, returns all-unknown.
 */

import type { OwnershipRiskFlags, OwnershipRiskModule } from "@/types/v2";
import { calculateBuyConfidence, type ScoringInput } from "./scoring";

export function computeOwnershipRisk(
  vehicleInput?: Partial<ScoringInput>
): OwnershipRiskFlags {
  // If no vehicle data, return all unknown
  if (!vehicleInput || !vehicleInput.model || !vehicleInput.year) {
    return {
      overall_risk_label: "Insufficient Data",
      modules: [
        makeUnknownModule("battery", "Battery Health", "Add vehicle details to assess battery risk"),
        makeUnknownModule("recall", "Recall Status", "Add vehicle details to check recalls"),
        makeUnknownModule("platform", "Platform Reliability", "Add vehicle details to assess platform"),
        makeUnknownModule("warranty", "Warranty Coverage", "Add vehicle details to check warranty"),
      ],
    };
  }

  // Build full ScoringInput with safe defaults for missing fields
  const fullInput: ScoringInput = {
    model: vehicleInput.model!,
    year: vehicleInput.year!,
    currentMileage: vehicleInput.currentMileage ?? 0,
    zipCode: vehicleInput.zipCode ?? "00000",
    dailyMiles: vehicleInput.dailyMiles ?? 40,
    homeCharging: vehicleInput.homeCharging ?? false,
    riskTolerance: vehicleInput.riskTolerance ?? "moderate",
  };

  // Use the existing scoring engine to get sub-scores
  const confidence = calculateBuyConfidence(fullInput);
  const { battery_risk, platform_risk, ownership_fit } = confidence;

  const modules: OwnershipRiskModule[] = [];

  // Battery module
  modules.push({
    module_id: "battery",
    status: battery_risk.score >= 70 ? "green" : battery_risk.score >= 40 ? "yellow" : "red",
    label: "Battery Health",
    summary: `${battery_risk.degradation_percent}% estimated degradation (${battery_risk.chemistry})`,
    detail: battery_risk.details,
    data_available: (vehicleInput.currentMileage ?? 0) > 0,
  });

  // Recall module
  modules.push({
    module_id: "recall",
    status:
      platform_risk.critical_recalls > 0
        ? "red"
        : platform_risk.total_recalls > 0
          ? "yellow"
          : "green",
    label: "Recall Status",
    summary:
      platform_risk.critical_recalls > 0
        ? `${platform_risk.critical_recalls} critical recall(s) found`
        : platform_risk.total_recalls > 0
          ? `${platform_risk.total_recalls} recall(s), none critical`
          : "No recalls found",
    detail: platform_risk.critical_recalls > 0
      ? `${platform_risk.total_recalls} recall(s) found, ${platform_risk.critical_recalls} critical. Verify completion with VIN.`
      : platform_risk.total_recalls > 0
        ? `${platform_risk.total_recalls} recall(s) found, none critical. Confirm completion with VIN.`
        : "No recalls found in available data. Verify with VIN for full coverage.",
    data_available: true,
  });

  // Platform module
  modules.push({
    module_id: "platform",
    status:
      platform_risk.reliability_score >= 7
        ? "green"
        : platform_risk.reliability_score >= 5
          ? "yellow"
          : "red",
    label: "Platform Reliability",
    summary: `Reliability: ${platform_risk.reliability_score.toFixed(1)}/10`,
    detail: `Reliability ${platform_risk.reliability_score.toFixed(1)}/10. ${
      platform_risk.reliability_score >= 7 ? "Above-average platform reliability."
      : platform_risk.reliability_score >= 5 ? "Average platform reliability — monitor for known issues."
      : "Below-average reliability — research common issues before buying."
    }`,
    data_available: true,
  });

  // Warranty module (always unknown for now — requires VIN lookup)
  modules.push(
    makeUnknownModule("warranty", "Warranty Coverage", "Warranty status requires VIN lookup")
  );

  // Overall label
  const redCount = modules.filter((m) => m.status === "red").length;
  const yellowCount = modules.filter((m) => m.status === "yellow").length;
  const unknownCount = modules.filter((m) => m.status === "unknown").length;

  let overall_risk_label: OwnershipRiskFlags["overall_risk_label"];
  if (unknownCount >= 3) overall_risk_label = "Insufficient Data";
  else if (redCount > 0) overall_risk_label = "High Risk";
  else if (yellowCount > 0) overall_risk_label = "Moderate Risk";
  else overall_risk_label = "Low Risk";

  return { overall_risk_label, modules };
}

function makeUnknownModule(
  id: OwnershipRiskModule["module_id"],
  label: string,
  summary: string
): OwnershipRiskModule {
  return {
    module_id: id,
    status: "unknown",
    label,
    summary,
    data_available: false,
  };
}
