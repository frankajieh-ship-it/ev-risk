/**
 * Shared types and constants for photo due diligence.
 * No server-only imports — safe to use in client components.
 */

export interface AngleDefinition {
  id: string;
  label: string;
  required: boolean;
}

export const REQUIRED_ANGLES: AngleDefinition[] = [
  { id: "front",         label: "Front exterior",   required: true  },
  { id: "rear",          label: "Rear exterior",    required: true  },
  { id: "driver_side",   label: "Driver side",      required: true  },
  { id: "pass_side",     label: "Passenger side",   required: true  },
  { id: "interior",      label: "Interior / dash",  required: true  },
  { id: "odometer",      label: "Odometer reading", required: true  },
  { id: "engine",        label: "Engine bay",       required: false },
  { id: "tires",         label: "Tires / wheels",   required: false },
  { id: "undercarriage", label: "Undercarriage",    required: false },
];

export interface DamageFinding {
  type: "dent" | "scratch" | "rust" | "crack" | "paint_fade" | "missing_part" | "other";
  severity: "minor" | "moderate" | "severe";
  location: string;
  affects_value: boolean;
  description: string;
}

export interface PhotoAnalysisResult {
  analyzed_at: string;
  coverage: {
    present: string[];
    missing: string[];
    coverage_score: number;
  };
  photos: Array<{
    url: string;
    angle_id: string;
    findings: DamageFinding[];
  }>;
  total_findings: number;
  severe_findings: number;
  summary: string;
}
