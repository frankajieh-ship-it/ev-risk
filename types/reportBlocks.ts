/**
 * Report Rendering Stability - Block Identity System
 *
 * Purpose: Prevent visual/logical jumps by giving blocks stable IDs
 * Key Problem: Using index as React key causes blocks to "swap" when list changes
 * Solution: Semantic IDs derived from block meaning, not position
 */

export type BlockKind =
  | "summary"
  | "risk"
  | "why"
  | "next_steps"
  | "cta"
  | "confidence"
  | "personalization"
  | "battery_context"
  | "ownership_fit"
  | "trust_calibration";

export interface ReportBlock {
  id: string; // Stable key (never changes for same semantic block)
  kind: BlockKind; // Type of block for styling/layout
  priority: number; // Stable ordering (10, 20, 30...)
  content: string | React.ReactNode; // Block content
  confidenceMin?: number; // Minimum confidence to show (0-1)
  confidenceMax?: number; // Maximum confidence to show (0-1)
  personalizationRequired?: boolean; // Only show if personalization provided
  className?: string; // Additional CSS classes
  metadata?: Record<string, any>; // Additional data for rendering
}

/**
 * Block composition context
 */
export interface ReportContext {
  confidence: number; // Overall confidence (0-1)
  confidenceTier: number; // Stable tier (0-3)
  inputs: {
    model?: string;
    year?: number;
    currentMileage?: number;
    dailyMiles?: number;
    homeCharging?: boolean;
    riskTolerance?: string;
    zipCode?: string;
    trim?: string;
    vin?: string;
  };
  scores: {
    overall: number;
    battery: number;
    platform: number;
    ownership: number;
  };
  personalizationCount: number; // How many personal inputs provided
  hasZeroPersonalization: boolean; // Phase 0.5 activation flag
}

/**
 * Block rendering props
 */
export interface ReportBlockViewProps {
  block: ReportBlock;
  isVisible?: boolean;
  onAnimationComplete?: () => void;
}
