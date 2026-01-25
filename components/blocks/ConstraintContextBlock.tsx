"use client";

/**
 * ConstraintContextBlock - Vehicle Constraint Context Display
 *
 * Shows when a vehicle has a known constraint (e.g., Volvo EX30 70% charge cap).
 * Displays:
 * - One-line banner explaining the constraint
 * - Up to 3 targeted signals showing impact on user's specific situation
 *
 * Design Principle: Add context, not verdict changes.
 */

import { AlertTriangle, Info } from "lucide-react";
import type { ConstraintContext, ConstraintSignal } from "@/types";

interface ConstraintContextBlockProps {
  context: ConstraintContext;
  signals: ConstraintSignal[];
  banner?: string;
}

export function ConstraintContextBlock({
  context,
  signals,
  banner,
}: ConstraintContextBlockProps) {
  if (!context || context.constraintType === "NONE") return null;

  const getSeverityIcon = (severity: ConstraintSignal["severity"]) => {
    switch (severity) {
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />;
      case "caution":
        return <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      {/* Banner */}
      {banner && (
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-medium">{banner}</p>
        </div>
      )}

      {/* Signals (MAX 3) */}
      {signals.length > 0 && (
        <div className="space-y-3">
          {signals.map((signal, idx) => (
            <div key={idx} className="flex items-start gap-2">
              {getSeverityIcon(signal.severity)}
              <div>
                <p className="text-sm font-medium text-amber-900">{signal.headline}</p>
                <p className="text-xs text-amber-700 mt-0.5">{signal.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expiry status indicator */}
      {context.expiryStatus === "active" && (
        <p className="text-xs text-amber-600 mt-3 pt-2 border-t border-amber-200">
          This constraint is currently active. Check manufacturer updates for changes.
        </p>
      )}
    </div>
  );
}
