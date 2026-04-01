/**
 * Scenario Generator
 *
 * Generates typed example inputs/outputs for receipt, routine, and copart pipelines.
 * Used in blog posts and technical documentation.
 *
 * Calls real functions — not mocks. Safe at module level (pure, synchronous).
 */

import { classifyVehicle } from "@/lib/vehicle-classifier";
import { extractSignalsFromText } from "@/lib/receipt-signal-extractor";
import { scoreReceipt } from "@/lib/receipt-scoring";
import { computeRoutineFit } from "@/lib/compute-routine-fit";
import type { ReceiptScoringResult } from "@/lib/receipt-scoring";
import type { VehicleClassification } from "@/lib/vehicle-classifier";
import type { RoutineFitScore, MinimumViableRoutine } from "@/types/v2";
import type { VehicleBasics } from "@/lib/compute-routine-fit";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScenarioResult<TInput, TOutput> {
  title: string;
  description: string;
  input: TInput;
  output: TOutput;
}

export type ScenarioDifficulty = "simple" | "edge_case";

// ── Receipt examples ──────────────────────────────────────────────────────────

interface ReceiptExampleInput {
  make: string;
  model: string;
  trim?: string;
  listing_text: string;
  structured: {
    title_status?: string;
    service_history?: string;
    accidents_reported?: string;
    owners?: number;
  };
}

interface ReceiptExampleOutput {
  classification: VehicleClassification;
  signal_count: number;
  signals: string[];
  scoring: ReceiptScoringResult;
}

export function generateReceiptExample(
  difficulty: ScenarioDifficulty
): ScenarioResult<ReceiptExampleInput, ReceiptExampleOutput> {
  if (difficulty === "simple") {
    const input: ReceiptExampleInput = {
      make: "Tesla",
      model: "Model 3",
      trim: "Long Range",
      listing_text:
        "2022 Tesla Model 3 Long Range AWD, 28,000 miles. Clean title, one owner. Full service history available. No accidents, Carfax available on request. Home L2 charging included.",
      structured: {
        title_status: "clean",
        service_history: "full",
        accidents_reported: "none",
        owners: 1,
      },
    };

    const classification = classifyVehicle(input.make, input.model, input.trim, input.listing_text);
    const signals = extractSignalsFromText(input.listing_text, input.structured, classification);
    const scoring = scoreReceipt(signals);

    return {
      title: "Clean Tesla Model 3 — Straightforward Green",
      description:
        "A well-documented single-owner Tesla with verifiable service history. The rule engine collects strong evidence signals and returns a GREEN verdict without any AI call.",
      input,
      output: { classification, signal_count: signals.length, signals, scoring },
    };
  }

  // edge_case
  const input: ReceiptExampleInput = {
    make: "Chevrolet",
    model: "Bolt EV",
    trim: "Premier",
    listing_text:
      "2020 Chevy Bolt EV Premier. 61,000 miles. Rebuilt title — was in a minor flood event, fully repaired, passed inspection. Two previous owners. No frame damage, no structural issues. New 12V battery, software updated.",
    structured: {
      title_status: "rebuilt",
      service_history: "partial",
      accidents_reported: "reported",
      owners: 2,
    },
  };

  const classification = classifyVehicle(input.make, input.model, input.trim, input.listing_text);
  const signals = extractSignalsFromText(input.listing_text, input.structured, classification);
  const scoring = scoreReceipt(signals);

  return {
    title: "Rebuilt-Title Bolt EV — Hard Blocker Activation",
    description:
      "A rebuilt-title flood vehicle with partial service history. The rule engine immediately triggers the title_salvage hard blocker and collapses fit score, even though the listing text uses softening language like 'fully repaired'.",
    input,
    output: { classification, signal_count: signals.length, signals, scoring },
  };
}

// ── Routine fit examples ──────────────────────────────────────────────────────

interface RoutineExampleInput {
  routine: MinimumViableRoutine;
  vehicle: VehicleBasics;
}

interface RoutineExampleOutput {
  fit: RoutineFitScore;
}

export function generateRoutineExample(
  difficulty: ScenarioDifficulty
): ScenarioResult<RoutineExampleInput, RoutineExampleOutput> {
  if (difficulty === "simple") {
    const input: RoutineExampleInput = {
      routine: {
        charging_access: "home",
        weekly_miles: 180,
        commute_miles_roundtrip: 36,
        climate: "mild",
        longest_day_pattern: "monthly_trip",
        home_charging_type: "L2",
        parking_exposure: "garage",
        budget_max: 45000,
      },
      vehicle: {
        model: "Model 3",
        real_world_range_mi: 310,
        msrp_usd: 42990,
        has_heat_pump: true,
        dc_fast_kw: 250,
      },
    };

    const fit = computeRoutineFit(input.routine, input.vehicle);

    return {
      title: "Mild Climate + Home L2 — Textbook Great Fit",
      description:
        "A suburban commuter with garage L2 charging in a mild climate. Usage runs ~12% of range per day. The sigmoid range buffer gives a near-perfect score and the budget dimension clears comfortably.",
      input,
      output: { fit },
    };
  }

  // edge_case
  const input: RoutineExampleInput = {
    routine: {
      charging_access: "public",
      weekly_miles: 420,
      commute_miles_roundtrip: 84,
      climate: "winter",
      longest_day_pattern: "once_a_week",
      public_charging_dependency: "OFTEN",
      parking_exposure: "street",
      shared_charger: true,
      budget_max: 32000,
    },
    vehicle: {
      model: "Nissan Leaf",
      real_world_range_mi: 149,
      msrp_usd: 35000,
      has_heat_pump: false,
      dc_fast_kw: 50,
      home_charging_type: "UNKNOWN",
    },
  };

  const fit = computeRoutineFit(input.routine, input.vehicle);

  return {
    title: "High-Mileage Street Parker, Winter, Public-Only — Catastrophic Zone",
    description:
      "A high-mileage user in a cold climate relying entirely on public charging with no home option. Usage exceeds 90% of range on heavy days, triggering the 0.85 catastrophic collapse multiplier. Score craters despite acceptable individual dimensions.",
    input,
    output: { fit },
  };
}

// ── Copart / auction example ──────────────────────────────────────────────────

interface CopartExampleInput {
  url: string;
  auction_source: string;
  vin?: string;
  description: string;
}

interface CopartExampleOutput {
  estimated_arv: number | null;
  damage_classification: string;
  skip_repair_cost_step: boolean;
  expected_model_calls: number;
  recommended_action: string;
}

export function generateCopartExample(
  difficulty: ScenarioDifficulty
): ScenarioResult<CopartExampleInput, CopartExampleOutput> {
  if (difficulty === "simple") {
    return {
      title: "Minor Hail — GPT-4o Skipped",
      description:
        "A 2023 Model Y with confirmed minor hail damage and a known ARV from Auto.dev listings. The canSkipRepairCost() guard returns true: damage_severity_baseline = minor, arv !== null, source_confidence = high. GPT-4o is skipped entirely — only 2 model calls run.",
      input: {
        url: "https://www.copart.com/lot/example-hail-model-y",
        auction_source: "copart",
        vin: "5YJYGDEE3MF123456",
        description: "2023 Tesla Model Y LR. Hail damage to hood and roof. Runs and drives. Clean title.",
      },
      output: {
        estimated_arv: 38500,
        damage_classification: "minor",
        skip_repair_cost_step: true,
        expected_model_calls: 2,
        recommended_action: "bid",
      },
    };
  }

  // edge_case
  return {
    title: "Flood-Recovery Ioniq 6 — All 3 Models Run",
    description:
      "A flood-recovery Ioniq 6 with an unknown ARV (no comparable Auto.dev listings for salvage-title EVs). canSkipRepairCost() returns false: damage_severity_baseline = severe, arv = null. All three model steps run — Grok classify, GPT-4o + Gemini in parallel, Grok polish.",
    input: {
      url: "https://www.copart.com/lot/example-flood-ioniq6",
      auction_source: "copart",
      vin: "KMHM34AA9PA000001",
      description:
        "2023 Hyundai Ioniq 6 SE. Flood/water damage. Does not start. Airbags deployed. Salvage title.",
    },
    output: {
      estimated_arv: null,
      damage_classification: "severe",
      skip_repair_cost_step: false,
      expected_model_calls: 3,
      recommended_action: "avoid",
    },
  };
}
