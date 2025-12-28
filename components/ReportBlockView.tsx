/**
 * Report Rendering Stability - Block View Component
 *
 * Purpose: Render blocks with stable heights to prevent layout jumps
 * Key: min-height per block kind prevents reflow during updates
 */

import type { ReportBlock } from "@/types/reportBlocks";
import { getTierColorClasses, type ConfidenceTier } from "@/lib/confidence-hysteresis";

interface ReportBlockViewProps {
  block: ReportBlock;
  confidenceTier?: ConfidenceTier;
}

/**
 * Get minimum height class by block kind
 * Prevents layout shift during content updates
 */
function getMinHeightClass(kind: ReportBlock["kind"]): string {
  switch (kind) {
    case "summary":
      return "min-h-[120px]";
    case "risk":
      return "min-h-[140px]";
    case "confidence":
      return "min-h-[150px]";
    case "why":
      return "min-h-[100px]";
    case "battery_context":
      return "min-h-[160px]";
    case "ownership_fit":
      return "min-h-[130px]";
    case "trust_calibration":
      return "min-h-[180px]";
    case "next_steps":
      return "min-h-[90px]";
    case "cta":
      return "min-h-[80px]";
    case "personalization":
      return "min-h-[100px]";
    default:
      return "min-h-[90px]";
  }
}

/**
 * Get block-specific styling
 */
function getBlockStyling(
  kind: ReportBlock["kind"],
  confidenceTier?: ConfidenceTier
): {
  borderColor: string;
  bgColor: string;
  iconBg?: string;
} {
  switch (kind) {
    case "summary":
      return {
        borderColor: "border-blue-200",
        bgColor: "bg-white",
        iconBg: "bg-blue-100",
      };
    case "risk":
      return {
        borderColor: "border-gray-200",
        bgColor: "bg-white",
      };
    case "confidence":
      if (confidenceTier !== undefined) {
        const colors = getTierColorClasses(confidenceTier);
        return {
          borderColor: colors.border,
          bgColor: colors.bg,
        };
      }
      return {
        borderColor: "border-yellow-200",
        bgColor: "bg-yellow-50",
      };
    case "why":
      return {
        borderColor: "border-green-200",
        bgColor: "bg-gradient-to-r from-blue-50 to-green-50",
      };
    case "battery_context":
      return {
        borderColor: "border-orange-200",
        bgColor: "bg-white",
      };
    case "ownership_fit":
      return {
        borderColor: "border-green-200",
        bgColor: "bg-green-50",
      };
    case "trust_calibration":
      return {
        borderColor: "border-orange-300",
        bgColor: "bg-white",
      };
    case "next_steps":
      return {
        borderColor: "border-blue-200",
        bgColor: "bg-blue-50",
      };
    case "cta":
      return {
        borderColor: "border-purple-200",
        bgColor: "bg-gradient-to-r from-purple-50 to-blue-50",
      };
    default:
      return {
        borderColor: "border-gray-200",
        bgColor: "bg-white",
      };
  }
}

/**
 * ReportBlockView Component
 *
 * Renders a single report block with:
 * - Stable minimum height (prevents jumps)
 * - Block-specific styling
 * - Smooth animations (optional)
 */
export default function ReportBlockView({
  block,
  confidenceTier,
}: ReportBlockViewProps) {
  const minHeightClass = getMinHeightClass(block.kind);
  const styling = getBlockStyling(block.kind, confidenceTier);

  return (
    <section
      // CRITICAL: Use block.id as key (stable across re-renders)
      key={block.id}
      className={`
        ${minHeightClass}
        ${styling.bgColor}
        ${styling.borderColor}
        rounded-xl border-2 p-6 shadow-sm
        transition-all duration-200 ease-in-out
        ${block.className || ""}
      `.trim()}
      data-block-id={block.id}
      data-block-kind={block.kind}
    >
      {/* Block Content */}
      <div className="text-sm leading-6 whitespace-pre-wrap text-gray-800">
        {typeof block.content === "string" ? (
          <>{block.content}</>
        ) : (
          block.content
        )}
      </div>

      {/* Metadata (optional, for debugging) */}
      {process.env.NODE_ENV === "development" && block.metadata && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
          <details>
            <summary className="cursor-pointer">Metadata</summary>
            <pre className="mt-2 text-xs">
              {JSON.stringify(block.metadata, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </section>
  );
}

/**
 * ReportBlockList Component
 *
 * Renders list of blocks with stable keys
 */
export function ReportBlockList({
  blocks,
  confidenceTier,
}: {
  blocks: ReportBlock[];
  confidenceTier?: ConfidenceTier;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <ReportBlockView
          key={block.id} // CRITICAL: Stable key prevents swapping
          block={block}
          confidenceTier={confidenceTier}
        />
      ))}
    </div>
  );
}
