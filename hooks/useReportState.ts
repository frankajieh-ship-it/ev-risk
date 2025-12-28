/**
 * Confidence State Visibility - Report State Hook
 *
 * Purpose: Track confidence changes and compose report blocks
 * Logs changes in debug mode for internal visibility
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { debugLog, logConfidenceChange, debugMeasure } from "@/lib/debug";
import { generateConfidenceData, type ConfidenceInputs } from "@/lib/confidence-calculator";
import { useStableTier, type ConfidenceTier } from "@/lib/confidence-hysteresis";
import { composeReportBlocks } from "@/lib/compose-report-blocks";
import type { ReportBlock, ReportContext } from "@/types/reportBlocks";

/**
 * Report state interface
 */
export interface ReportState {
  confidence: number; // 0-1
  confidenceTier: ConfidenceTier; // 0-3
  blocks: ReportBlock[]; // Composed blocks
  phase05Active: boolean; // Phase 0.5 flag
}

/**
 * Hook to manage report state with confidence tracking
 *
 * Automatically logs confidence changes in debug mode
 */
export function useReportState(
  inputs: Record<string, any>,
  scores: {
    overall: number;
    battery: number;
    platform: number;
    ownership: number;
  }
): ReportState {
  const prevConfidenceRef = useRef<number | null>(null);
  const [renderCount, setRenderCount] = useState(0);

  // Calculate confidence from inputs
  const confidenceInputs: ConfidenceInputs = useMemo(() => ({
    listing: {
      hasMileage: !!inputs.currentMileage,
      hasAge: !!inputs.year,
      hasModel: !!inputs.model,
      hasTrim: !!inputs.trim,
      hasVIN: !!inputs.vin,
    },
    personalization: {
      hasDrivingPattern: !!inputs.dailyMiles,
      hasChargingAccess: inputs.homeCharging !== undefined,
      hasRiskTolerance: !!inputs.riskTolerance,
      hasZipCode: !!inputs.zipCode,
    },
    batteryHealth: {
      hasSOHReport: false,
      hasChargingHistory: false,
    },
  }), [inputs]);

  // Generate confidence data
  const confidenceData = useMemo(() => {
    const endMeasure = debugMeasure("generateConfidenceData");
    const data = generateConfidenceData(confidenceInputs);
    endMeasure();
    return data;
  }, [confidenceInputs]);

  const confidence = confidenceData.current / 100; // Convert to 0-1

  // Use stable tier (with hysteresis)
  const confidenceTier = useStableTier(confidence);

  // Determine Phase 0.5 activation
  const phase05Active = confidenceData.shouldShowPhase05;
  const personalizationCount = confidenceData.personalizationCount || 0;

  // Build report context
  const reportContext: ReportContext = useMemo(() => ({
    confidence,
    confidenceTier,
    inputs,
    scores,
    personalizationCount,
    hasZeroPersonalization: phase05Active,
  }), [confidence, confidenceTier, inputs, scores, personalizationCount, phase05Active]);

  // Compose blocks
  const blocks = useMemo(() => {
    const endMeasure = debugMeasure("composeReportBlocks");
    const composedBlocks = composeReportBlocks(reportContext);
    endMeasure();
    return composedBlocks;
  }, [reportContext]);

  // Track confidence changes (debug mode only)
  useEffect(() => {
    const prev = prevConfidenceRef.current;

    logConfidenceChange({
      from: prev,
      to: confidence,
      delta: prev !== null ? confidence - prev : undefined,
      inputs,
      timestamp: Date.now(),
    });

    prevConfidenceRef.current = confidence;
  }, [confidence, inputs]);

  // Track re-renders (debug mode only)
  useEffect(() => {
    setRenderCount(c => c + 1);
    debugLog("📊 useReportState rendered", {
      renderCount: renderCount + 1,
      confidence: (confidence * 100).toFixed(1) + "%",
      tier: confidenceTier,
      blocksCount: blocks.length,
      phase05Active,
    });
  }, [confidence, confidenceTier, blocks.length, phase05Active]);

  return {
    confidence,
    confidenceTier,
    blocks,
    phase05Active,
  };
}

/**
 * Simplified hook for confidence-only tracking
 */
export function useConfidenceTracking(inputs: Record<string, any>): {
  confidence: number;
  confidenceTier: ConfidenceTier;
} {
  const prevConfidenceRef = useRef<number | null>(null);

  const confidenceInputs: ConfidenceInputs = useMemo(() => ({
    listing: {
      hasMileage: !!inputs.currentMileage,
      hasAge: !!inputs.year,
      hasModel: !!inputs.model,
      hasTrim: !!inputs.trim,
      hasVIN: !!inputs.vin,
    },
    personalization: {
      hasDrivingPattern: !!inputs.dailyMiles,
      hasChargingAccess: inputs.homeCharging !== undefined,
      hasRiskTolerance: !!inputs.riskTolerance,
      hasZipCode: !!inputs.zipCode,
    },
    batteryHealth: {
      hasSOHReport: false,
      hasChargingHistory: false,
    },
  }), [inputs]);

  const confidenceData = useMemo(
    () => generateConfidenceData(confidenceInputs),
    [confidenceInputs]
  );

  const confidence = confidenceData.current / 100;
  const confidenceTier = useStableTier(confidence);

  useEffect(() => {
    const prev = prevConfidenceRef.current;

    logConfidenceChange({
      from: prev,
      to: confidence,
      inputs,
      timestamp: Date.now(),
    });

    prevConfidenceRef.current = confidence;
  }, [confidence, inputs]);

  return { confidence, confidenceTier };
}
