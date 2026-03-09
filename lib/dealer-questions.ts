/**
 * Dealer Questions Builder
 *
 * Generates contextual dealer questions based on routine and ownership risk.
 * Shared by /api/score and /api/recommendations.
 */

import type { MinimumViableRoutine } from "@/types/v2";
import type { OwnershipRiskFlags } from "@/types/v2";

export function buildDealerQuestionsV2(
  routine: MinimumViableRoutine,
  ownershipRisk: OwnershipRiskFlags
): { top_3: string[]; full_list: string[]; walk_away_triggers: string[] } {
  const top_3: string[] = [];

  // Dynamic top 3 based on what's unknown or risky
  const unknownModules = ownershipRisk.modules.filter(m => m.status === "unknown");
  const redModules = ownershipRisk.modules.filter(m => m.status === "red");

  if (redModules.some(m => m.module_id === "battery") || unknownModules.some(m => m.module_id === "battery")) {
    top_3.push("Can you provide the current battery State of Health (SoH) percentage?");
  }
  if (redModules.some(m => m.module_id === "recall") || unknownModules.some(m => m.module_id === "recall")) {
    top_3.push("Are all manufacturer recalls completed?");
  }
  if (routine.charging_access !== "home") {
    top_3.push("What charging options are available at or near this location?");
  }

  // Fill to 3 if needed
  const defaults = [
    "Has the battery been replaced or serviced under warranty?",
    "What is the remaining manufacturer warranty coverage?",
    "Can I get a pre-purchase inspection by a certified EV technician?",
  ];
  while (top_3.length < 3) {
    const next = defaults.find(d => !top_3.includes(d));
    if (next) top_3.push(next);
    else break;
  }

  const full_list = [
    "Has the battery been replaced or serviced under warranty?",
    "Can you provide the current State of Health (SoH) percentage?",
    "Are all manufacturer recalls completed? Which ones remain?",
    "What is the remaining manufacturer warranty coverage?",
    "Has this vehicle been in any accidents or had flood damage?",
    "Can I get a pre-purchase inspection by a certified EV technician?",
    "What is the complete service history for this vehicle?",
  ];

  const walk_away_triggers = [
    "Battery State of Health (SoH) below 80%",
    "Any uncompleted safety recalls",
    "No documented service history available",
    "Seller refuses independent pre-purchase inspection",
    "Price significantly above market value",
    "Evidence of previous accident or flood damage",
    "Unusual battery degradation for vehicle age/mileage",
  ];

  return { top_3, full_list, walk_away_triggers };
}
