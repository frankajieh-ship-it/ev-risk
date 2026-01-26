/**
 * Scenario Fingerprinting for IP Defensibility
 *
 * Generates deterministic fingerprints from scenario inputs to:
 * 1. Track unique scenario combinations (IP growth metric)
 * 2. Identify novel scenarios (first-time combinations)
 * 3. Provide audit trail with summary IDs and engine versioning
 */

import crypto from "crypto";
import { nanoid } from "nanoid";

// Engine version - update when scoring logic changes significantly
const ENGINE_VERSION = "2.1.0";

interface FingerprintInput {
  model: string;
  year: number;
  dailyMiles: number;
  zipCode: string;
  homeCharging: boolean;
  riskTolerance: string;
  constraintMultiplier?: number;
}

/**
 * Generate a deterministic fingerprint from scenario inputs
 * Uses SHA-256 hash of canonical JSON representation
 *
 * @param inputs - Scenario input parameters
 * @returns 16-character hex fingerprint
 */
export function generateScenarioFingerprint(inputs: FingerprintInput): string {
  // Normalize inputs to ensure consistent fingerprinting
  const canonical = JSON.stringify({
    model: inputs.model.toLowerCase().trim(),
    year: inputs.year,
    dailyMiles: inputs.dailyMiles,
    zipRegion: inputs.zipCode.substring(0, 3), // Region only for privacy
    homeCharging: inputs.homeCharging,
    riskTolerance: inputs.riskTolerance,
    constraintMultiplier: inputs.constraintMultiplier || 1.0,
  });

  return crypto
    .createHash("sha256")
    .update(canonical)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Generate a unique summary ID for audit trail
 * Format: sum_xxxxxxxxxxxx (16 chars total)
 */
export function generateSummaryId(): string {
  return `sum_${nanoid(12)}`;
}

/**
 * Get the current engine version
 */
export function getEngineVersion(): string {
  return ENGINE_VERSION;
}
