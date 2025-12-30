/**
 * Sprint 2 Task 4: Charging Fit & Routine Friction Section
 *
 * GLOBAL RULES COMPLIANCE:
 * - NO scores, NO recommendations, NO maps, NO charger counts
 * - Surface mental overhead without scoring
 * - Plain English explanations only
 * - Focus on "feels low-friction when..." and "becomes mentally taxing if..."
 *
 * Sprint 2 Requirements:
 * - Simple self-reported inputs (4 questions)
 * - Explanation blocks in plain English
 * - Explicitly surface failure modes (apartment+public, DCFC primary, no backup)
 */

export interface ChargingFitInputs {
  primaryChargingType: "home" | "apartment_shared" | "public_only";
  chargingReliability: "usually_available" | "sometimes_available" | "unpredictable";
  backupPlanWithin15Min: boolean;
  weeklyChargingMoments: "1-2" | "3-4" | "5+";
}

interface ChargingFitRoutineFrictionProps {
  inputs: ChargingFitInputs;
}

export default function ChargingFitRoutineFriction({
  inputs,
}: ChargingFitRoutineFrictionProps) {
  // Generate friction analysis (NO SCORING)
  const analysis = analyzeChargingFriction(inputs);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-200">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Charging Fit & Routine Friction
        </h2>
        <p className="text-gray-700 leading-relaxed">
          Based on your charging setup, here's what typically happens with this pattern.
          This isn't a judgment—just context about mental overhead.
        </p>
      </div>

      {/* Low-Friction Scenarios */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          This setup tends to feel low-friction when:
        </h3>
        <div className="space-y-2">
          {analysis.lowFrictionScenarios.map((scenario, idx) => (
            <div
              key={idx}
              className="flex items-start p-3 bg-blue-50 rounded-lg border-l-4 border-blue-300"
            >
              <span className="text-blue-600 mr-3">✓</span>
              <p className="text-gray-800">{scenario}</p>
            </div>
          ))}
        </div>
      </div>

      {/* High-Friction Scenarios */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          This setup becomes mentally taxing if:
        </h3>
        <div className="space-y-2">
          {analysis.highFrictionScenarios.map((scenario, idx) => (
            <div
              key={idx}
              className="flex items-start p-3 bg-orange-50 rounded-lg border-l-4 border-orange-300"
            >
              <span className="text-orange-600 mr-3">⚠</span>
              <p className="text-gray-800">{scenario}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Failure Mode Warning (if applicable) */}
      {analysis.failureMode && (
        <div className="mb-6 p-5 bg-red-50 border-2 border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900 mb-3">
            Known Friction Pattern
          </h3>
          <p className="text-red-800 mb-3">{analysis.failureMode.description}</p>
          <p className="text-sm text-red-700 italic">
            {analysis.failureMode.context}
          </p>
        </div>
      )}

      {/* Adaptation Pathways (Sprint 2 Task 6) */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Adaptation Pathways
        </h3>

        <div className="space-y-4">
          {/* This works if... */}
          <div>
            <p className="font-semibold text-gray-900 mb-2">This works if you:</p>
            <ul className="space-y-1 ml-4">
              {analysis.adaptationPathways.worksIf.map((item, idx) => (
                <li key={idx} className="text-gray-700 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* This becomes annoying if... */}
          <div>
            <p className="font-semibold text-gray-900 mb-2">
              This becomes annoying if:
            </p>
            <ul className="space-y-1 ml-4">
              {analysis.adaptationPathways.annoying.map((item, idx) => (
                <li key={idx} className="text-gray-700 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Plan B that reduces regret */}
          <div className="pt-3 border-t border-gray-300">
            <p className="font-semibold text-gray-900 mb-2">
              A Plan B that reduces regret:
            </p>
            <p className="text-gray-700 bg-white p-3 rounded border border-gray-200">
              {analysis.adaptationPathways.planB}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom note - NO recommendations */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-600 italic">
          This section describes typical patterns, not recommendations. Your actual
          experience depends on your specific routine, backup options, and tolerance for
          planning overhead.
        </p>
      </div>
    </div>
  );
}

/**
 * Analyze charging friction based on inputs
 * NO SCORING - only plain English explanations
 */
function analyzeChargingFriction(inputs: ChargingFitInputs) {
  const {
    primaryChargingType,
    chargingReliability,
    backupPlanWithin15Min,
    weeklyChargingMoments,
  } = inputs;

  let lowFrictionScenarios: string[] = [];
  let highFrictionScenarios: string[] = [];
  let failureMode: { description: string; context: string } | null = null;
  let adaptationPathways: {
    worksIf: string[];
    annoying: string[];
    planB: string;
  } = {
    worksIf: [],
    annoying: [],
    planB: "",
  };

  // HOME CHARGING PATTERN
  if (primaryChargingType === "home") {
    lowFrictionScenarios = [
      "Your daily routine is predictable and stays within overnight charging capacity",
      "You rarely need to charge away from home during the week",
      "Edge case trips (long drives, unexpected errands) happen infrequently enough that occasional DC fast charging feels like a minor exception",
    ];

    highFrictionScenarios = [
      "Your daily mileage exceeds what overnight charging can provide (typically 40-50 miles for Level 1, 200+ for Level 2)",
      "You frequently take spontaneous long trips without advance planning",
      "Power outages or charging equipment failures leave you without backup options nearby",
    ];

    adaptationPathways = {
      worksIf: [
        "Your daily driving stays within home charging capacity most days",
        "You can plan ahead for longer trips that need public charging",
        "You have a backup plan (nearby charger, second vehicle, or alternative transport) for rare home charging failures",
      ],
      annoying: [
        "Your routine becomes unpredictable with frequent long-distance obligations",
        "Home charging equipment has reliability issues",
        "You find yourself needing public charging more than 1-2 times per month",
      ],
      planB:
        "Identify 2-3 reliable DC fast chargers within 15 minutes of home and your regular routes. Test them before you urgently need them. Know their payment methods and typical availability windows.",
    };

    // Check for edge cases
    if (!backupPlanWithin15Min) {
      highFrictionScenarios.push(
        "No backup charging within 15 minutes means home charging failure creates significant disruption"
      );
    }
  }

  // APARTMENT / SHARED CHARGING PATTERN
  else if (primaryChargingType === "apartment_shared") {
    lowFrictionScenarios = [
      "Your apartment charging spots are reliably available when you need them",
      "Charging is unlimited or generous enough that you don't monitor time windows",
      "The setup is stable—no policy changes, no spot reassignments, no unexpected restrictions",
    ];

    highFrictionScenarios = [
      "Charging spots are first-come, first-served with no guarantee of availability",
      "Time limits force you to move your car during charging sessions",
      "Building policies change unpredictably (new fees, reduced hours, spot reassignments)",
      "You need to coordinate with neighbors or compete for limited spots",
    ];

    adaptationPathways = {
      worksIf: [
        "You have a dedicated assigned charging spot (not shared/first-come)",
        "Backup public charging within 15 minutes covers you when apartment charging is unavailable",
        "Your routine is flexible enough to adapt to occasional spot unavailability",
      ],
      annoying: [
        "Spot availability becomes unpredictable or highly contested",
        "Time windows require you to interrupt sleep or work to move your vehicle",
        "Building management changes policies frequently",
      ],
      planB:
        "Map out 3-4 reliable public charging options within 15 minutes. Know their availability patterns (weekday mornings, weekend evenings, etc.) so you have predictable alternatives when apartment charging fails.",
    };

    // FAILURE MODE: Apartment + Unpredictable reliability
    if (chargingReliability === "unpredictable") {
      failureMode = {
        description:
          "Apartment charging with unpredictable availability creates ongoing mental overhead. You're constantly managing uncertainty about whether you'll have access when needed.",
        context:
          "This pattern shows up frequently in behavioral data: apartment dwellers with unreliable shared charging report high cognitive load from planning around uncertainty.",
      };
    }
  }

  // PUBLIC-ONLY CHARGING PATTERN
  else if (primaryChargingType === "public_only") {
    lowFrictionScenarios = [
      "You have 3-4 highly reliable chargers within 10 minutes that are rarely broken or occupied",
      "Your routine allows 30-45 minute charging sessions 1-2 times per week without disrupting your schedule",
      "You live in an area with redundant charging options so one broken charger doesn't block you",
    ];

    highFrictionScenarios = [
      "Chargers near you are frequently broken, occupied, or blocked by ICE vehicles",
      "You need to charge more than 2-3 times per week, turning charging into a recurring time sink",
      "Charging sessions require going out of your way or waiting in line",
      "You must manage 3+ different charging network apps and payment methods",
      "Cold weather or high-mileage weeks mean more frequent charging sessions with less predictable timing",
    ];

    adaptationPathways = {
      worksIf: [
        "You genuinely only need to charge 1-2 times per week maximum",
        "You have 4+ reliable charging options so redundancy covers broken/occupied chargers",
        "Your schedule is flexible enough to accommodate 30-45 minute sessions",
        "You're comfortable with app fragmentation and have accounts set up in advance",
      ],
      annoying: [
        "Charging frequency creeps up to 3+ times per week",
        "Your go-to chargers become unreliable or consistently occupied",
        "Time pressure makes 30-45 minute sessions feel burdensome",
        "You encounter broken chargers frequently with limited backup options",
      ],
      planB:
        "Identify workplace charging opportunities (even if unofficial), ask friends/family about occasional charging access, or evaluate if installing home charging (even Level 1) would reduce weekly public charging dependence.",
    };

    // FAILURE MODE 1: Public-only + High frequency
    if (
      weeklyChargingMoments === "5+" ||
      weeklyChargingMoments === "3-4"
    ) {
      failureMode = {
        description:
          "Public-only charging with 3+ weekly sessions creates high mental overhead. Every week requires multiple 30-45 minute detours, charger availability monitoring, and backup plans for broken chargers.",
        context:
          "Behavioral data shows this pattern leads to ongoing friction. Most successful public-only users charge 1-2 times per week maximum, not 3+.",
      };
    }

    // FAILURE MODE 2: Public-only + No backup + Unreliable
    if (!backupPlanWithin15Min && chargingReliability !== "usually_available") {
      failureMode = {
        description:
          "Public-only charging with limited backup options and unreliable access is a known high-friction pattern. When your primary chargers fail, you have no fallback within reasonable distance.",
        context:
          "This creates compounding anxiety: every charging session requires backup plans, and backup plans require their own backups. The mental overhead accumulates over time.",
      };
    }

    // FAILURE MODE 3: DC Fast Charging as Primary
    // Note: We infer DCFC primary from public-only + frequent charging
    if (weeklyChargingMoments !== "1-2") {
      if (!failureMode) {
        // Only set if not already set above
        failureMode = {
          description:
            "Using DC fast charging as your primary fueling method (not just occasional long trips) creates different friction than home charging. Sessions take 30-45 minutes, costs are higher, and reliability varies significantly by network and location.",
          context:
            "DCFC works well for occasional long trips. As primary charging, it requires integrating 30-45 minute sessions into your weekly routine multiple times, which most owners find mentally taxing over time.",
        };
      }
    }
  }

  return {
    lowFrictionScenarios,
    highFrictionScenarios,
    failureMode,
    adaptationPathways,
  };
}
