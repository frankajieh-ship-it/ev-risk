/**
 * Constraint Context Detection
 *
 * Detects and resolves vehicle constraints from:
 * 1. URL parameters (?constraint=volvo_ex30_70pct_cap)
 * 2. Model name detection
 *
 * Design Principle: Add context, not new modes.
 * Override assumptions, not outcomes.
 */

import type { ConstraintContext } from "@/types";

// Known constraint definitions
const KNOWN_CONSTRAINTS: Record<string, Omit<ConstraintContext, "constraintSource">> = {
  volvo_ex30_70pct_cap: {
    constraintType: "CAPACITY_CAP",
    constraintId: "volvo_ex30_70pct_cap",
    usableCapacityMultiplier: 0.70,
    constraintLabel: "70% charge cap",
    expiryStatus: "active",
  },
};

// Model patterns that trigger constraint detection
// Maps model name patterns to constraint IDs
const MODEL_CONSTRAINT_MAP: Record<string, string> = {
  "ex30": "volvo_ex30_70pct_cap",
  "volvo ex30": "volvo_ex30_70pct_cap",
};

/**
 * Detect constraint context from model name and/or URL parameter
 *
 * Priority:
 * 1. Explicit URL parameter (user/operator override)
 * 2. Model name pattern matching (automatic detection)
 */
export function detectConstraintContext(
  model: string,
  urlConstraintParam?: string
): ConstraintContext | undefined {
  // Priority 1: Explicit URL parameter
  if (urlConstraintParam && KNOWN_CONSTRAINTS[urlConstraintParam]) {
    return {
      ...KNOWN_CONSTRAINTS[urlConstraintParam],
      constraintSource: "url",
    };
  }

  // Priority 2: Model name detection
  const normalizedModel = model.toLowerCase().trim();
  for (const [pattern, constraintId] of Object.entries(MODEL_CONSTRAINT_MAP)) {
    if (normalizedModel.includes(pattern)) {
      const constraint = KNOWN_CONSTRAINTS[constraintId];
      if (constraint) {
        return {
          ...constraint,
          constraintSource: "model_detection",
        };
      }
    }
  }

  return undefined;
}

/**
 * Get the usable capacity multiplier for a constraint
 * Returns 1.0 if no constraint or constraint doesn't affect capacity
 */
export function getCapacityMultiplier(context: ConstraintContext | undefined): number {
  if (!context || context.constraintType !== "CAPACITY_CAP") {
    return 1.0;
  }
  return context.usableCapacityMultiplier ?? 1.0;
}

/**
 * Check if a constraint is currently active
 */
export function isConstraintActive(context: ConstraintContext | undefined): boolean {
  if (!context) return false;
  return context.expiryStatus === "active" || context.expiryStatus === "unknown";
}
