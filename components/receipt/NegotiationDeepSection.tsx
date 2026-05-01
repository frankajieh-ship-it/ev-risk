/**
 * NegotiationDeepSection — On-demand extended negotiation scripts (dark theme)
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, Zap, Copy, Check } from "lucide-react";
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
  const [copied, setCopied] = useState<number | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateRef = useRef<(isAutoRetry?: boolean) => Promise<void>>(null as any);

  useEffect(() => {
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); };
  }, []);

  const generate = useCallback(async (isAutoRetry = false) => {
    if (!isAutoRetry) {
      retryCountRef.current = 0;
      trackEvent("section_generate_clicked", { receipt_id: receiptId, section_name: "negotiation_deep" });
    }
    setStatus("running");
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/receipt/${receiptId}/generate/negotiation_deep`, { method: "POST" });
      const json = await res.json();

      if (res.status === 409) {
        // Full upgrade not written to DB yet — retry silently, stay in "running" skeleton
        if (retryCountRef.current < 4) {
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => generateRef.current(true), 8_000);
        } else {
          setStatus("failed");
        }
        return;
      }

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
        trackEvent("section_generate_failed", { receipt_id: receiptId, section_name: "negotiation_deep", reason: json.error ?? "unknown" });
      }
    } catch (err) {
      setStatus("failed");
      trackEvent("section_generate_failed", { receipt_id: receiptId, section_name: "negotiation_deep", reason: err instanceof Error ? err.message : "network_error" });
    }
  }, [receiptId, trackEvent]);
  useEffect(() => { generateRef.current = generate; });

  const copyScript = async (script: NegotiationScript, i: number) => {
    const text = [script.opening, ...(script.body ?? [])].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  if (status === "not_requested") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
        <button
          onClick={() => generate(false)}
          className="w-full flex items-center justify-center gap-2 px-5 py-4 text-sm font-semibold text-[#00d97e] hover:bg-[#00d97e]/[0.06] transition-colors"
        >
          <Zap className="w-4 h-4" />
          View Full Negotiation Scripts
        </button>
      </div>
    );
  }

  if (status === "running") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] px-5 py-4 flex items-center justify-center gap-2 text-sm text-white/50">
        <Loader2 className="w-4 h-4 animate-spin text-[#00d97e]" />
        Generating negotiation scripts...
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] px-5 py-4 space-y-2">
        <p className="text-xs text-white/40 text-center">Couldn&apos;t generate scripts — this is usually temporary.</p>
        <button
          onClick={() => generate(false)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white/60 bg-white/[0.05] hover:bg-white/[0.09] rounded-lg border border-white/[0.10] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    );
  }

  if (status === "ready" && scripts) {
    const showAll = isUnlocked || !paymentsEnabled;
    const visibleScripts = showAll ? scripts : scripts.slice(0, 1);
    const lockedScripts = showAll ? [] : scripts.slice(1);

    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest">Negotiation Scripts</p>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {visibleScripts.map((script, i) => (
            <div key={i}>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-sm font-semibold text-white">{script.scenario}</span>
                {expanded === i
                  ? <ChevronUp className="w-4 h-4 text-white/40 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                }
              </button>
              {expanded === i && (
                <div className="px-5 pb-4 space-y-3">
                  <div className="bg-[#00d97e]/[0.08] border border-[#00d97e]/20 rounded-lg px-4 py-3">
                    <p className="text-sm text-[#00d97e] font-medium leading-relaxed">{script.opening}</p>
                  </div>
                  {Array.isArray(script.body) && script.body.length > 0 && (
                    <ol className="space-y-2">
                      {script.body.map((step, j) => (
                        <li key={j} className="text-sm text-white/70 flex gap-2.5">
                          <span className="text-white/30 shrink-0 font-mono text-xs mt-0.5">{j + 1}.</span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <button
                    onClick={() => copyScript(script, i)}
                    className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    {copied === i
                      ? <><Check className="w-3.5 h-3.5 text-[#00d97e]" /> Copied</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy script</>
                    }
                  </button>
                </div>
              )}
            </div>
          ))}
          {lockedScripts.map((script, i) => (
            <div key={`locked-${i}`} className="px-5 py-3.5 flex items-center justify-between select-none opacity-40">
              <span className="text-sm font-semibold text-white blur-[4px]">{script.scenario}</span>
            </div>
          ))}
        </div>
        {lockedScripts.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.06]">
            <button
              onClick={onPaywallClick}
              className="text-xs font-medium text-[#00d97e]/70 hover:text-[#00d97e] transition-colors"
            >
              Unlock {lockedScripts.length} more script{lockedScripts.length !== 1 ? "s" : ""} →
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
