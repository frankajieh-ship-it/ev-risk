/**
 * Share Snapshot — Extract public-safe fields from a receipt or routine run
 *
 * Used when creating a QR share link. Only includes fields
 * safe for public display — no email, no internal scoring fields.
 */

import type { ShareSnapshot, PriceSanityLabel } from "@/types/receipt";
import { humanizeFlag } from "@/lib/receipt-rules";

// ============================================================
// Routine share snapshot
// ============================================================

export interface RoutineShareSnapshot {
  fit_label: string;
  score_0_100: number;
  mental_load: string;
  stress_flags: Array<{ id: string; label: string; severity: string }>;
  top_breakpoint: { id: string; title: string; impact: string; plan_b: string } | null;
  vehicle: { year: number; make: string; model: string } | null;
  routine_summary: {
    charging_access: string;
    climate: string;
    longest_day_pattern: string;
    weekly_miles?: number;
  };
  timestamp: string;
}

export function createRoutineSnapshot(run: {
  outputs_json?: Record<string, unknown> | null;
  inputs_json?: Record<string, unknown> | null;
  fit_label?: string | null;
  friction_score?: number | null;
}): RoutineShareSnapshot {
  const outputs = (run.outputs_json || {}) as Record<string, unknown>;
  const inputs = (run.inputs_json || {}) as Record<string, unknown>;
  const routine = (inputs.routine || {}) as Record<string, unknown>;
  const vehicle = inputs.vehicle as Record<string, unknown> | undefined;

  const stressFlags = Array.isArray(outputs.stress_flags)
    ? (outputs.stress_flags as Array<Record<string, unknown>>).slice(0, 3).map((f) => ({
        id: String(f.id || ""),
        label: String(f.label || ""),
        severity: String(f.severity || "medium"),
      }))
    : [];

  const breakpoints = Array.isArray(outputs.breakpoints_ranked)
    ? (outputs.breakpoints_ranked as Array<Record<string, unknown>>)
    : [];
  const topBp = breakpoints[0] as Record<string, unknown> | undefined;
  const topBreakpoint = topBp
    ? {
        id: String(topBp.id || ""),
        title: String(topBp.title || ""),
        impact: String(topBp.impact || ""),
        plan_b: (() => {
          const fb = topBp.fallback_plan_b as Record<string, unknown> | undefined;
          return fb ? String(fb.anchor || "") : "";
        })(),
      }
    : null;

  return {
    fit_label: String(run.fit_label || outputs.label || "Mixed Fit"),
    score_0_100: typeof outputs.score_0_100 === "number" ? outputs.score_0_100 : (run.friction_score ?? 50),
    mental_load: String(outputs.mental_load || "medium"),
    stress_flags: stressFlags,
    top_breakpoint: topBreakpoint,
    vehicle: vehicle
      ? {
          year: Number(vehicle.year || 0),
          make: String(vehicle.make || ""),
          model: String(vehicle.model || ""),
        }
      : null,
    routine_summary: {
      charging_access: String(routine.charging_access || ""),
      climate: String(routine.climate || ""),
      longest_day_pattern: String(routine.longest_day_pattern || ""),
      weekly_miles: typeof routine.weekly_miles === "number" ? routine.weekly_miles : undefined,
    },
    timestamp: new Date().toISOString(),
  };
}

export function createShareSnapshot(receipt: Record<string, unknown>): ShareSnapshot {
  const ls = (receipt.listing_summary || {}) as Record<string, unknown>;
  const ps = (receipt.price_sanity || {}) as Record<string, unknown>;

  return {
    verdict: (receipt.verdict as ShareSnapshot["verdict"]) || "YELLOW",
    verdict_reason: (receipt.verdict_reason as string) || "",
    risk_flags: Array.isArray(receipt.risk_flags)
      ? (receipt.risk_flags as string[]).slice(0, 3).map(humanizeFlag)
      : [],
    must_answer_questions: Array.isArray(receipt.must_answer_questions)
      ? (receipt.must_answer_questions as string[]).slice(0, 3)
      : [],
    price_sanity_label: (ps.label as PriceSanityLabel) || "UNKNOWN",
    listing_summary: {
      year: (ls.year as number) ?? null,
      make: (ls.make as string) ?? null,
      model: (ls.model as string) ?? null,
      price: (ls.price as number) ?? null,
      mileage: (ls.mileage as number) ?? null,
      seller_type: (ls.seller_type as string) ?? null,
    },
    timestamp: new Date().toISOString(),
  };
}
