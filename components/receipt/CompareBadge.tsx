/**
 * CompareBadge — Interactive compare credit status for Decision Pack
 *
 * Sprint 4: upgraded from passive badge to interactive buttons.
 * - Credit available → "Use Compare Credit" button
 * - Credit bound → "View Comparison" button
 */

"use client";

import { GitCompare, Check, Eye } from "lucide-react";

interface CompareBadgeProps {
  compareRemaining: number;
  compareBoundTo: string | null;
  onInitiateCompare?: () => void;
  onViewCompare?: () => void;
}

export default function CompareBadge({
  compareRemaining,
  compareBoundTo,
  onInitiateCompare,
  onViewCompare,
}: CompareBadgeProps) {
  if (compareRemaining <= 0 && !compareBoundTo) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-blue-500" />
        {compareRemaining > 0 ? (
          <span className="text-sm text-gray-700">
            Compare credit:{" "}
            <span className="font-medium text-blue-600">
              {compareRemaining} available
            </span>
          </span>
        ) : (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-green-500" />
            Compare credit used
          </span>
        )}
      </div>

      {compareRemaining > 0 && onInitiateCompare && (
        <button
          onClick={onInitiateCompare}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-all"
        >
          Use Compare Credit
        </button>
      )}

      {compareBoundTo && onViewCompare && (
        <button
          onClick={onViewCompare}
          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-all"
        >
          <Eye className="w-3.5 h-3.5" />
          View Comparison
        </button>
      )}
    </div>
  );
}
