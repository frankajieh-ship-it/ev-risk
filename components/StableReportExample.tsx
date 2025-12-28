/**
 * Report Rendering Stability - Integration Example
 *
 * This component demonstrates how to integrate the stable rendering system
 * into the report page. Use this as a reference for implementation.
 */

"use client";

import { useState, useEffect } from "react";
import { useStableTier } from "@/lib/confidence-hysteresis";
import { composeReportBlocks } from "@/lib/compose-report-blocks";
import { ReportBlockList } from "@/components/ReportBlockView";
import type { ReportContext } from "@/types/reportBlocks";

interface StableReportExampleProps {
  // Initial data from API
  initialData: {
    confidence: number;
    scores: {
      overall: number;
      battery: number;
      platform: number;
      ownership: number;
    };
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
    personalizationCount: number;
  };
}

/**
 * Example: Stable Report Rendering
 *
 * Key features:
 * 1. Uses useStableTier hook to prevent tier flickering
 * 2. Composes blocks with stable IDs
 * 3. Blocks maintain identity across re-renders
 * 4. Layout heights are stable (no jumps)
 */
export default function StableReportExample({
  initialData,
}: StableReportExampleProps) {
  // Use stable tier hook (with hysteresis)
  const confidenceTier = useStableTier(initialData.confidence);

  // Determine if Phase 0.5 should activate
  const hasZeroPersonalization = initialData.personalizationCount === 0;

  // Build report context
  const reportContext: ReportContext = {
    confidence: initialData.confidence,
    confidenceTier,
    inputs: initialData.inputs,
    scores: initialData.scores,
    personalizationCount: initialData.personalizationCount,
    hasZeroPersonalization,
  };

  // Compose blocks (stable IDs, filtered, sorted)
  const blocks = composeReportBlocks(reportContext);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          EV Risk Assessment Report
        </h1>
        <p className="text-gray-600">
          {initialData.inputs.year} {initialData.inputs.model}
        </p>
      </div>

      {/* Stable Block Rendering */}
      <ReportBlockList blocks={blocks} confidenceTier={confidenceTier} />

      {/* Development Info (remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg border border-gray-300">
          <h3 className="font-bold text-sm text-gray-700 mb-2">
            Rendering Stability Info
          </h3>
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              <strong>Confidence:</strong> {(initialData.confidence * 100).toFixed(1)}%
            </p>
            <p>
              <strong>Tier:</strong> {confidenceTier} (with hysteresis)
            </p>
            <p>
              <strong>Blocks Rendered:</strong> {blocks.length}
            </p>
            <p>
              <strong>Personalization Count:</strong>{" "}
              {initialData.personalizationCount}
            </p>
            <p>
              <strong>Stable IDs:</strong>{" "}
              {blocks.map((b) => b.id).join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example: Usage in report page
 *
 * ```tsx
 * // app/report/page.tsx
 * import StableReportExample from "@/components/StableReportExample";
 *
 * export default function ReportPage() {
 *   const [reportData, setReportData] = useState(null);
 *
 *   // ... fetch report data ...
 *
 *   if (!reportData) return <Loading />;
 *
 *   return (
 *     <StableReportExample
 *       initialData={{
 *         confidence: reportData.confidence.overall_score / 100,
 *         scores: {
 *           overall: reportData.confidence.overall_score,
 *           battery: reportData.confidence.battery_risk.score,
 *           platform: reportData.confidence.platform_risk.score,
 *           ownership: reportData.confidence.ownership_fit.score,
 *         },
 *         inputs: reportData.input,
 *         personalizationCount: calculatePersonalizationCount(reportData.input),
 *       }}
 *     />
 *   );
 * }
 * ```
 */
