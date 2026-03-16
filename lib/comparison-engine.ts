/**
 * Routine Delta Comparison Engine
 *
 * Evaluates two EV options against a shared routine and computes
 * the delta (what changes) between them.
 *
 * Key principles:
 * - No specs (kWh, range, 0-60)
 * - No recommendations or winners
 * - Routine-focused language only
 */

import type {
  BaseRoutineInput,
  OptionInput,
  FitResult,
  FitSignal,
  FadeLabel,
  ComparisonInput,
  ComparisonResult,
} from "./comparison-types";

/**
 * Maps fit signal to fade label
 */
function getFadeLabel(signal: FitSignal): FadeLabel {
  switch (signal) {
    case 'GOOD':
      return 'LIKELY_BACKGROUND';
    case 'CONDITIONAL':
      return 'MAY_RESURFACE';
    case 'HIGH_FRICTION':
      return 'ACTIVE_ATTENTION';
  }
}

/**
 * Evaluate a single option against the base routine
 */
export function evaluateOption(
  base: BaseRoutineInput,
  option: OptionInput
): FitResult {
  const friction_bullets: string[] = [];
  const why_not_100: string[] = [];
  const risk_tags: string[] = [];
  const strengths: string[] = [];

  // Start with baseline assessment from routine
  let frictionScore = 0;

  // === Charging Access Assessment ===
  if (!base.has_home_charging) {
    frictionScore += 2;
    risk_tags.push('NO_HOME_CHARGING');

    if (base.public_charging_dependency === 'OFTEN') {
      friction_bullets.push(
        "Without home charging, you'll need to build public charging into your routine."
      );
      frictionScore += 1;
    } else if (base.can_charge_at_work) {
      friction_bullets.push(
        "Work charging can cover daily needs, but you'll need a backup plan for off-days."
      );
    } else {
      friction_bullets.push(
        "You'll be relying on public charging, which adds planning overhead."
      );
    }
  } else {
    if (base.home_charging_type === 'L1') {
      why_not_100.push("L1 charging may feel slow if you have high-mileage days.");
      risk_tags.push('L1_ONLY');
    }
  }

  // === Schedule Pattern Assessment ===
  if (base.routine_pattern === 'MOTORWAY_HEAVY') {
    risk_tags.push('MOTORWAY_HEAVY');

    if (option.efficiency_bucket === 'LESS_EFFICIENT') {
      friction_bullets.push(
        base.region === 'UK'
          ? "Motorway driving at higher speeds will use more energy—plan for more charging stops."
          : "Highway driving at higher speeds will use more energy—plan for more charging stops."
      );
      frictionScore += 1;
    }

    if (option.charging_curve_bucket === 'SLOW') {
      friction_bullets.push(
        "Slower DC charging may make road trip stops feel longer than expected."
      );
      frictionScore += 1;
    }
  }

  // === Long Day Frequency Assessment ===
  if (base.long_day_frequency === 'WEEKLY') {
    risk_tags.push('FREQUENT_LONG_DAYS');

    if (option.battery_bucket === 'SMALL') {
      friction_bullets.push(
        "With frequent long days, a smaller battery may require mid-day charging more often."
      );
      frictionScore += 1;
    }

    if (!base.has_home_charging) {
      why_not_100.push("Frequent long days + no home charging = more planning required.");
      frictionScore += 1;
    }
  } else if (base.long_day_frequency === 'MONTHLY') {
    if (option.battery_bucket === 'SMALL' && option.efficiency_bucket !== 'MORE_EFFICIENT') {
      why_not_100.push("Monthly long days may occasionally require a charging stop.");
    }
  }

  // === Planning Tolerance Assessment ===
  if (base.planning_tolerance === 'LOW') {
    risk_tags.push('LOW_PLANNING_TOLERANCE');

    if (base.public_charging_dependency !== 'RARE') {
      friction_bullets.push(
        "With low tolerance for planning, public charging dependency may feel like friction."
      );
      frictionScore += 1;
    }

    if (option.charging_curve_bucket === 'SLOW' || option.charging_curve_bucket === 'UNKNOWN') {
      why_not_100.push("Charging speed uncertainty may cause anxiety on longer trips.");
    }
  }

  // === Shared Infrastructure Assessment ===
  if (base.shared_infrastructure === 'HIGH') {
    risk_tags.push('SHARED_INFRASTRUCTURE');

    friction_bullets.push(
      "Shared charging means coordinating with others—could add friction on busy days."
    );
    frictionScore += 1;

    if (option.battery_bucket === 'SMALL' && option.efficiency_bucket === 'LESS_EFFICIENT') {
      friction_bullets.push(
        "With shared chargers, you may need the charger more often than others."
      );
      frictionScore += 1;
    }
  } else if (base.shared_infrastructure === 'SOME') {
    why_not_100.push("Occasional charger availability uncertainty with shared access.");
  }

  // === Body Type Assessment ===
  if (option.body_type_bucket === 'SUV_CUV' || option.body_type_bucket === 'VAN_PICKUP') {
    if (base.routine_pattern === 'MOTORWAY_HEAVY') {
      why_not_100.push(
        "Larger vehicles typically use more energy at higher speeds."
      );
    }
  }

  // === Determine Fit Signal ===
  let fit_signal: FitSignal;
  if (frictionScore === 0) {
    fit_signal = 'GOOD';
  } else if (frictionScore <= 2) {
    fit_signal = 'CONDITIONAL';
  } else {
    fit_signal = 'HIGH_FRICTION';
  }

  // Ensure at least one "why not 100%" for non-perfect scores
  if (fit_signal !== 'HIGH_FRICTION' && why_not_100.length === 0) {
    if (option.battery_bucket === 'UNKNOWN' || option.efficiency_bucket === 'UNKNOWN') {
      why_not_100.push("Some vehicle characteristics are uncertain—real-world experience may vary.");
    } else {
      why_not_100.push("Every EV requires some adaptation to your routine.");
    }
  }

  // === Strengths (positive attributes specific to this option + routine) ===
  if (base.has_home_charging) {
    strengths.push("You start every day with a full charge — the lowest-friction setup.");
  }
  if (option.battery_bucket === 'LARGE' && base.long_day_frequency !== 'RARE') {
    strengths.push("Large battery means fewer mid-day charging decisions on longer days.");
  }
  if (option.charging_curve_bucket === 'FAST_CONSISTENT' && base.planning_tolerance === 'LOW') {
    strengths.push("Fast, consistent DC charging keeps road-trip stops short and predictable.");
  }
  if (option.efficiency_bucket === 'MORE_EFFICIENT' && base.routine_pattern === 'MOTORWAY_HEAVY') {
    const rt = base.region === 'UK' ? 'motorway' : 'highway';
    strengths.push(`Higher efficiency makes a meaningful difference on ${rt}-heavy routes.`);
  }
  if (option.battery_bucket !== 'SMALL' && option.battery_bucket !== 'UNKNOWN' && base.shared_infrastructure === 'HIGH') {
    strengths.push("Mid-to-large battery means you need charger access less often — reduces shared-charger friction.");
  }
  if (option.charging_curve_bucket === 'FAST_CONSISTENT' && base.long_day_frequency === 'WEEKLY') {
    strengths.push("Frequent long days are easier when charging stops are consistently fast.");
  }
  if (option.efficiency_bucket === 'MORE_EFFICIENT' && base.public_charging_dependency !== 'RARE') {
    strengths.push("Better efficiency means you get more miles per public charging session.");
  }

  // Limit bullets
  const limitedFriction = friction_bullets.slice(0, 5);
  const limitedWhy = why_not_100.slice(0, 3);
  const limitedStrengths = strengths.slice(0, 3);

  return {
    fit_signal,
    fade_label: getFadeLabel(fit_signal),
    strengths: limitedStrengths,
    friction_bullets: limitedFriction,
    why_not_100: limitedWhy,
    risk_tags,
  };
}

/**
 * Compute the delta (what changes) between two options
 */
export function computeDelta(
  base: BaseRoutineInput,
  optionA: OptionInput,
  optionB: OptionInput,
  resultA: FitResult,
  resultB: FitResult
): string[] {
  const deltas: string[] = [];
  const labelA = optionA.label || "Option A";
  const labelB = optionB.label || "Option B";

  // Check if everything is UNKNOWN - neutral fallback
  const allUnknownA =
    optionA.body_type_bucket === 'UNKNOWN' &&
    optionA.battery_bucket === 'UNKNOWN' &&
    optionA.efficiency_bucket === 'UNKNOWN' &&
    optionA.charging_curve_bucket === 'UNKNOWN';

  const allUnknownB =
    optionB.body_type_bucket === 'UNKNOWN' &&
    optionB.battery_bucket === 'UNKNOWN' &&
    optionB.efficiency_bucket === 'UNKNOWN' &&
    optionB.charging_curve_bucket === 'UNKNOWN';

  if (allUnknownA && allUnknownB) {
    return [
      "These two look similar from a routine-fit perspective.",
      "The difference will come down to charging reliability and how often your 'edge days' happen.",
    ];
  }

  // === Body Type Delta ===
  if (optionA.body_type_bucket !== optionB.body_type_bucket) {
    const aIsSUV = optionA.body_type_bucket === 'SUV_CUV' || optionA.body_type_bucket === 'VAN_PICKUP';
    const bIsSUV = optionB.body_type_bucket === 'SUV_CUV' || optionB.body_type_bucket === 'VAN_PICKUP';

    if (aIsSUV && !bIsSUV && optionB.body_type_bucket !== 'UNKNOWN') {
      deltas.push(
        `On longer days, ${labelA} (larger body) may require charging slightly earlier than ${labelB}.`
      );
    } else if (bIsSUV && !aIsSUV && optionA.body_type_bucket !== 'UNKNOWN') {
      deltas.push(
        `On longer days, ${labelB} (larger body) may require charging slightly earlier than ${labelA}.`
      );
    }
  }

  // === Battery Size Delta ===
  if (optionA.battery_bucket !== optionB.battery_bucket) {
    const batteryOrder = { SMALL: 1, MID: 2, LARGE: 3, UNKNOWN: 0 };
    const aSize = batteryOrder[optionA.battery_bucket];
    const bSize = batteryOrder[optionB.battery_bucket];

    if (aSize > 0 && bSize > 0 && aSize !== bSize) {
      const larger = aSize > bSize ? labelA : labelB;
      const smaller = aSize > bSize ? labelB : labelA;

      if (base.long_day_frequency !== 'RARE') {
        deltas.push(
          `${larger} may reduce how often you need to think about rapid charging on long days compared to ${smaller}.`
        );
      }

      if (base.shared_infrastructure !== 'NONE') {
        deltas.push(
          `With shared charging, ${smaller} may need charger access more frequently.`
        );
      }
    }
  }

  // === Charging Curve Delta ===
  if (optionA.charging_curve_bucket !== optionB.charging_curve_bucket) {
    const curveOrder = { SLOW: 1, AVERAGE: 2, FAST_CONSISTENT: 3, UNKNOWN: 0 };
    const aCurve = curveOrder[optionA.charging_curve_bucket];
    const bCurve = curveOrder[optionB.charging_curve_bucket];

    if (aCurve > 0 && bCurve > 0 && aCurve !== bCurve) {
      const faster = aCurve > bCurve ? labelA : labelB;
      const slower = aCurve > bCurve ? labelB : labelA;

      deltas.push(
        `${faster} is more likely to make charging stops feel shorter and less disruptive than ${slower}.`
      );
    }
  }

  // === Efficiency Delta ===
  if (optionA.efficiency_bucket !== optionB.efficiency_bucket) {
    const effOrder = { LESS_EFFICIENT: 1, NEUTRAL: 2, MORE_EFFICIENT: 3, UNKNOWN: 0 };
    const aEff = effOrder[optionA.efficiency_bucket];
    const bEff = effOrder[optionB.efficiency_bucket];

    if (aEff > 0 && bEff > 0 && aEff !== bEff) {
      const moreEff = aEff > bEff ? labelA : labelB;
      const lessEff = aEff > bEff ? labelB : labelA;

      if (base.routine_pattern === 'MOTORWAY_HEAVY') {
        const roadType = base.region === 'UK' ? 'motorway' : 'highway';
        deltas.push(
          `On ${roadType}-heavy routes, ${moreEff} will stretch further between charges than ${lessEff}.`
        );
      }
    }
  }

  // === Planning Tolerance Interaction ===
  if (base.planning_tolerance === 'LOW') {
    // Check if one option is clearly "easier" for low planning tolerance
    const aEasier =
      optionA.battery_bucket === 'LARGE' ||
      optionA.charging_curve_bucket === 'FAST_CONSISTENT';
    const bEasier =
      optionB.battery_bucket === 'LARGE' ||
      optionB.charging_curve_bucket === 'FAST_CONSISTENT';

    if (aEasier && !bEasier) {
      deltas.push(
        `Given low planning tolerance, ${labelB} is more likely to keep resurfacing as a concern.`
      );
    } else if (bEasier && !aEasier) {
      deltas.push(
        `Given low planning tolerance, ${labelA} is more likely to keep resurfacing as a concern.`
      );
    }
  }

  // === Shared Infrastructure Interaction ===
  if (base.shared_infrastructure === 'HIGH') {
    const aHighDemand =
      optionA.battery_bucket === 'SMALL' &&
      optionA.efficiency_bucket === 'LESS_EFFICIENT';
    const bHighDemand =
      optionB.battery_bucket === 'SMALL' &&
      optionB.efficiency_bucket === 'LESS_EFFICIENT';

    if (aHighDemand && !bHighDemand) {
      deltas.push(
        `In shared charging setups, ${labelA} may increase competition pressure (you'll need slots more often).`
      );
    } else if (bHighDemand && !aHighDemand) {
      deltas.push(
        `In shared charging setups, ${labelB} may increase competition pressure (you'll need slots more often).`
      );
    }
  }

  // === Same-signal differentiation: surface relative strengths even when both are GOOD ===
  if (resultA.fit_signal === resultB.fit_signal && deltas.length === 0) {
    // Battery difference
    const batteryOrder = { SMALL: 1, MID: 2, LARGE: 3, UNKNOWN: 0 };
    const aSize = batteryOrder[optionA.battery_bucket];
    const bSize = batteryOrder[optionB.battery_bucket];
    if (aSize > 0 && bSize > 0 && aSize !== bSize) {
      const moreHeadroom = aSize > bSize ? labelA : labelB;
      const lessHeadroom = aSize > bSize ? labelB : labelA;
      deltas.push(`${moreHeadroom} gives you more range headroom — ${lessHeadroom} may occasionally require more attention on longer days.`);
    }
    // Charging speed difference
    const curveOrder = { SLOW: 1, AVERAGE: 2, FAST_CONSISTENT: 3, UNKNOWN: 0 };
    const aCurve = curveOrder[optionA.charging_curve_bucket];
    const bCurve = curveOrder[optionB.charging_curve_bucket];
    if (aCurve > 0 && bCurve > 0 && aCurve !== bCurve) {
      const fasterLabel = aCurve > bCurve ? labelA : labelB;
      const slowerLabel = aCurve > bCurve ? labelB : labelA;
      deltas.push(`${fasterLabel}'s faster charging makes the occasional top-up feel less like an interruption than ${slowerLabel}.`);
    }
    // Efficiency difference with public charging context
    const effOrder = { LESS_EFFICIENT: 1, NEUTRAL: 2, MORE_EFFICIENT: 3, UNKNOWN: 0 };
    const aEff = effOrder[optionA.efficiency_bucket];
    const bEff = effOrder[optionB.efficiency_bucket];
    if (aEff > 0 && bEff > 0 && aEff !== bEff) {
      const moreEff = aEff > bEff ? labelA : labelB;
      const lessEff = aEff > bEff ? labelB : labelA;
      deltas.push(`${moreEff} stretches further on the same charge — ${lessEff} will visit charging spots more frequently.`);
    }
  }

  // === Fit Signal Difference ===
  if (resultA.fit_signal !== resultB.fit_signal) {
    const signalOrder = { GOOD: 3, CONDITIONAL: 2, HIGH_FRICTION: 1 };
    const aBetter = signalOrder[resultA.fit_signal] > signalOrder[resultB.fit_signal];

    if (aBetter) {
      deltas.push(
        `Overall, ${labelA} appears to fit your routine more smoothly than ${labelB}.`
      );
    } else {
      deltas.push(
        `Overall, ${labelB} appears to fit your routine more smoothly than ${labelA}.`
      );
    }
  }

  // Ensure at least one delta
  if (deltas.length === 0) {
    deltas.push(
      "These two look similar from a routine-fit perspective. The difference will come down to real-world experience."
    );
  }

  // Limit to 6 bullets max
  return deltas.slice(0, 6);
}

/**
 * Main comparison function
 */
export function compareOptions(input: ComparisonInput): ComparisonResult {
  const { optionA, optionB, ...baseRoutine } = input;

  // Evaluate each option
  const resultA = evaluateOption(baseRoutine, optionA);
  const resultB = evaluateOption(baseRoutine, optionB);

  // Compute delta
  const routine_delta_bullets = computeDelta(
    baseRoutine,
    optionA,
    optionB,
    resultA,
    resultB
  );

  // Neutral closer - never picks a winner
  const neutral_closer =
    "Both can work. The difference is how often charging stays invisible vs resurfaces in your week.";

  return {
    optionA: { ...resultA, label: optionA.label },
    optionB: { ...resultB, label: optionB.label },
    routine_delta_bullets,
    neutral_closer,
  };
}
