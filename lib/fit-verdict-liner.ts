/**
 * Generates a 1-2 line routine-specific summary for the fit verdict.
 * V2 equivalent of V1's one_sentence_verdict.
 */

import type { RoutineFitScore, MinimumViableRoutine } from "@/types/v2";

export function generateFitOneLiner(
  routineFit: RoutineFitScore,
  mvr: MinimumViableRoutine
): string {
  const label = routineFit.label;
  const topBreakpoint = routineFit.breakpoints_ranked[0];

  if (label === "Great Fit" || label === "Good Fit") {
    if (mvr.charging_access === "home") {
      return "Your routine and home charging align well. Main thing to watch: your longest driving day during extreme weather.";
    }
    if (mvr.charging_access === "work") {
      return "Fits your routine if work charging stays available. Have a weekend backup plan.";
    }
    return "Manageable if you anchor on 1-2 reliable public stations. Predictability is key.";
  }

  if (label === "Mixed Fit") {
    const friction = topBreakpoint?.title || "charging predictability";
    return `Can work, but ${friction.toLowerCase()} will need ongoing attention. Plan B matters here.`;
  }

  // High Friction
  const friction = topBreakpoint?.title || "multiple friction points";
  return `${friction} creates consistent friction with your routine. This setup demands frequent planning.`;
}
