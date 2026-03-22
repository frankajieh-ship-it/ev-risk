/**
 * NegotiationDeepSection — On-demand extended negotiation scripts
 *
 * Shows a "View Full Scripts" button below the opener. On click,
 * calls POST /api/receipt/:id/generate/negotiation_deep and renders
 * 3 scenario cards. Idempotent: shows cached scripts on repeat views.
 */

"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Zap, Lock } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { NegotiationScript } from "@/lib/receipt-sections";

interface NegotiationDeepSectionProps {
  receiptId: string;
  initialScripts?: NegotiationScript[] | null;
  initialStatus?: string;
  isUnlocked?: boolean;
  paymentsEnabled?: boolean;
  onPaywallClick?: () => void;
}

export default function NegotiationDeepSection({
  receiptId,
  initialScripts,
  initialStatus,
  isUnlocked = false,
  paymentsEnabled = false,
  onPaywallClick,
}: NegotiationDeepSectionProps) {
  const { trackEvent } = useEventTracking();
  const [status, setStatus] = useState<string>(
    initialScripts?.length ? "ready" : (initialStatus ?? "not_requested")
  );
  const [scripts, setScripts] = useState<NegotiationScript[] | null>(initialScripts ?? null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const generate = useCallback(async () => {
    trackEvent("section_generate_clicked", { receipt_id: receiptId, section_name: "negotiation_deep" });
    setStatus("running");
    const t0 = Date.now();

    try {
      const res = await fetch(`/api/receipt/${receiptId}/generate/negotiation_deep`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setScripts(json.data as NegotiationScript[]);
        setStatus("ready");
        setExpanded(0);
        trackEvent("section_generate_succeeded", {
          receipt_id: receiptId,
          section_name: "negotiation_deep",
          latency_ms: Date.now() - t0,
        });
      } else {
        setStatus("failed");
        trackEvent("section_generate_failed", {
          receipt_id: receiptId,
          section_name: "negotiation_deep",
          reason: json.error ?? "unknown",
        });
      }
    } catch (err) {
      setStatus("failed");
      trackEvent("section_generate_failed", {
        receipt_id: receiptId,
        section_name: "negotiation_deep",
        reason: err instanceof Error ? err.message : "network_error",
      });
    }
  }, [receiptId, trackEvent]);

  if (status === "not_requested") {
    return (
      <button
        onClick={generate}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
      >
        <Zap className="w-3.5 h-3.5" />
        View Full Negotiation Scripts
      </button>
    );
  }

  if (status === "running") {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 py-3 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <Loader2 className="w-4 h-4 animate-spin" />
        Generating scripts...
      </div>
    );
  }

  if (status === "failed") {
    return (
      <button
        onClick={generate}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry — generation failed
      </button>
    );
  }

  if (status === "ready" && scripts) {
    const showAll = isUnlocked || !paymentsEnabled;
    const visibleScripts = showAll ? scripts : scripts.slice(0, 1);
    const lockedScripts = showAll ? [] : scripts.slice(1);

    return (
      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Negotiation Scripts</p>
        {visibleScripts.map((script, i) => (
          <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-800">{script.scenario}</span>
              {expanded === i ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            {expanded === i && (
              <div className="px-4 py-3 space-y-2 bg-white">
                <p className="text-sm font-medium text-emerald-800 bg-emerald-50 px-3 py-2 rounded">
                  {script.opening}
                </p>
                {Array.isArray(script.body) && script.body.length > 0 && (
                  <ul className="space-y-1.5">
                    {script.body.map((step, j) => (
                      <li key={j} className="text-sm text-gray-700 flex gap-2">
                        <span className="text-gray-400 shrink-0">{j + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
        {lockedScripts.map((script, i) => (
          <div key={`locked-${i}`} className="rounded-lg border border-gray-200 overflow-hidden select-none">
            <div className="w-full flex items-center justify-between px-4 py-3 bg-gray-50">
              <span className="text-sm font-semibold text-gray-300 blur-[4px]">{script.scenario}</span>
              <Lock className="w-4 h-4 text-gray-300" />
            </div>
          </div>
        ))}
        {lockedScripts.length > 0 && (
          <button
            onClick={onPaywallClick}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors mt-1"
          >
            <Lock className="w-3.5 h-3.5" />
            Unlock {lockedScripts.length} more negotiation script{lockedScripts.length !== 1 ? "s" : ""}
          </button>
        )}
      </div>
    );
  }

  return null;
}
