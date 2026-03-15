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
      return "Plugging in at home most nights is the real unlock here — this car fits around your life, not the other way around. Just keep an eye on that longest driving day when the weather turns cold.";
    }
    if (mvr.charging_access === "work") {
      return "Workplace charging carries the weight of your week. As long as that stays reliable, this fits your routine well. Have a weekend backup in mind and you're in good shape.";
    }
    return "This works, but your charging routine is the variable. Anchor on 1–2 spots you actually trust and stick to them — predictability is what makes public-only ownership feel effortless.";
  }

  if (label === "Mixed Fit") {
    const friction = topBreakpoint?.title || "charging predictability";
    return `This can work for you, but ${friction.toLowerCase()} will need real attention on a regular basis — not a dealbreaker, just something you'd be actively managing rather than ignoring.`;
  }

  // High Friction
  const friction = topBreakpoint?.title || "a few friction points";
  return `${friction} is going to create real friction with how you actually live. That's not a judgment call — it just means this specific setup would need frequent adjustments to fit your routine.`;
}
