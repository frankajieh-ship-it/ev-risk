"use client";

/**
 * YourSituationBlock - P1 Share-First Component
 *
 * Reddit-native moat: Always visible immediately after Quick Routine Check
 * One paragraph, copy-to-clipboard CTA
 *
 * Hard rules:
 * - No scores
 * - No jargon
 * - Must read naturally when pasted into Reddit
 *
 * Variables allowed:
 * - charging control
 * - predictability
 * - backup availability
 * - seasonal context
 *
 * Telemetry: Tracks copy-to-clipboard usage
 */

import { useState } from "react";
import { Copy, CheckCircle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface YourSituationBlockProps {
  summary: string;
}

export function YourSituationBlock({ summary }: YourSituationBlockProps) {
  const [copied, setCopied] = useState(false);
  const { trackEvent } = useEventTracking();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // P1: Track copy-to-clipboard usage
      trackEvent("copy_to_clipboard", {
        content_type: "your_situation_summary",
        content_length: summary.length,
        page: "result_page_lite",
      });
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (!summary) return null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Your Situation
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 p-2 rounded-lg border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-all"
          title="Copy to clipboard"
        >
          {copied ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>
    </div>
  );
}
