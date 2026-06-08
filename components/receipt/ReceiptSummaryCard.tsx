/**
 * ReceiptSummaryCard — Human-voice plain-language summary, shown above all other receipt detail.
 *
 * Automatically triggers on-demand generation when the receipt is "full".
 * Uses the multi-LLM hedged generate pipeline via /api/receipt/{id}/generate/receipt_summary.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw, MessageSquare, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import type { ListingAISummary } from "@/lib/receipt-sections";

interface ReceiptSummaryCardProps {
  receiptId: string;
  isUpgrading: boolean;
  generationStatus: string;
  initialSummary?: ListingAISummary | null;
  initialStatus?: string;
  verdict: "GREEN" | "YELLOW" | "RED";
  vin?: string | null;
}

type Tone = "proceed" | "caution" | "stop";

const TONE_STYLES: Record<Tone, {
  border: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  headlineColor: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  proceed: {
    border: "border-[#00d97e]/25",
    bg: "bg-[#00d97e]/[0.05]",
    iconBg: "bg-[#00d97e]/[0.12]",
    iconColor: "text-[#00d97e]",
    headlineColor: "text-[#00d97e]",
    label: "Looking Good",
    Icon: CheckCircle2,
  },
  caution: {
    border: "border-yellow-500/25",
    bg: "bg-yellow-500/[0.05]",
    iconBg: "bg-yellow-500/[0.12]",
    iconColor: "text-yellow-400",
    headlineColor: "text-yellow-300",
    label: "Proceed with Caution",
    Icon: AlertTriangle,
  },
  stop: {
    border: "border-red-500/25",
    bg: "bg-red-500/[0.05]",
    iconBg: "bg-red-500/[0.12]",
    iconColor: "text-red-400",
    headlineColor: "text-red-300",
    label: "High Risk",
    Icon: XCircle,
  },
};

function verdictToTone(verdict: string): Tone {
  if (verdict === "GREEN") return "proceed";
  if (verdict === "RED") return "stop";
  return "caution";
}

const MAX_AUTO_RETRIES = 4;
const RETRY_DELAY_MS = 8_000;

export default function ReceiptSummaryCard({
  receiptId,
  isUpgrading,
  generationStatus,
  initialSummary,
  initialStatus,
  verdict,
  vin,
}: ReceiptSummaryCardProps) {
  const { trackEvent } = useEventTracking();
  const retryCountRef = useRef(0);

  // Fetch VinAudit NMVTIS result to show a reconciliation note when the AI summary
  // was written before VinAudit ran (the common case for stored receipts).
  const [vinAuditClean, setVinAuditClean] = useState<boolean | null>(null);
  useEffect(() => {
    if (!vin) return;
    const token = getOrCreateReceiptToken();
    if (!token) return;
    fetch("/api/vin/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin, receipt_token: token }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.summary) {
          const clean = data.summary.accident_count === 0 && !data.summary.theft_reported;
          setVinAuditClean(clean);
        }
      })
      .catch(() => {});
  }, [vin]);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUpgradingRef = useRef(isUpgrading);
  useEffect(() => { isUpgradingRef.current = isUpgrading; });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const generateRef = useRef<(isAutoRetry?: boolean) => Promise<void>>(null as any);

  const [status, setStatus] = useState<string>(() => {
    if (initialSummary) return "ready";
    if (initialStatus) return initialStatus;
    return "not_requested";
  });
  const [summary, setSummary] = useState<ListingAISummary | null>(initialSummary ?? null);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  // Clear any pending retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const generate = useCallback(async (isAutoRetry = false) => {
    if (!isAutoRetry) {
      retryCountRef.current = 0;
    }
    if (!isAutoRetry) {
      trackEvent("section_generate_clicked", { receipt_id: receiptId, section_name: "receipt_summary" });
    }
    setStatus("running");
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/receipt/${receiptId}/generate/receipt_summary`, { method: "POST" });
      const json = await res.json();

      if (res.status === 409) {
        // Full upgrade not written to DB yet — retry silently, stay in "running" skeleton
        if (retryCountRef.current < MAX_AUTO_RETRIES) {
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => generateRef.current(true), RETRY_DELAY_MS);
        } else {
          setStatus("failed");
        }
        return;
      }

      if (json.success && json.data) {
        setSummary(json.data as ListingAISummary);
        setStatus("ready");
        trackEvent("section_generate_succeeded", {
          receipt_id: receiptId,
          section_name: "receipt_summary",
          latency_ms: Date.now() - t0,
        });
      } else {
        setStatus("failed");
        trackEvent("section_generate_failed", { receipt_id: receiptId, section_name: "receipt_summary", reason: (json.error as string) ?? "unknown" });
      }
    } catch (err) {
      setStatus("failed");
      trackEvent("section_generate_failed", { receipt_id: receiptId, section_name: "receipt_summary", reason: err instanceof Error ? err.message : "network_error" });
    }
  }, [receiptId, trackEvent]);
  useEffect(() => { generateRef.current = generate; });

  // Auto-trigger once the full AI upgrade completes
  useEffect(() => {
    if (generationStatus === "full" && !isUpgradingRef.current && status === "not_requested") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      generate();
    }
  }, [generationStatus, status, generate]);

  // Verdict always wins — never show a more alarming tone than the actual verdict
  const verdictTone = verdictToTone(verdict);
  const aiTone = (summary?.tone && summary.tone in TONE_STYLES) ? summary.tone as Tone : verdictTone;
  const TONE_SEVERITY: Record<Tone, number> = { proceed: 0, caution: 1, stop: 2 };
  const tone: Tone = TONE_SEVERITY[aiTone] > TONE_SEVERITY[verdictTone] ? verdictTone : aiTone;
  const styles = TONE_STYLES[tone];
  const { Icon } = styles;

  // ── Loading / upgrading skeleton ──────────────────────────────────────────
  if (isUpgrading || status === "running") {
    return (
      <div className={`rounded-xl border ${styles.border} ${styles.bg} px-5 py-4`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center shrink-0`}>
            <Loader2 className={`w-4 h-4 ${styles.iconColor} animate-spin`} />
          </div>
          <div className="flex-1">
            <div className="h-3 bg-white/[0.07] rounded w-2/3 mb-2 animate-pulse" />
            <div className="h-2.5 bg-white/[0.04] rounded w-1/2 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2.5 bg-white/[0.04] rounded w-full animate-pulse" />
          <div className="h-2.5 bg-white/[0.04] rounded w-5/6 animate-pulse" />
          <div className="h-2.5 bg-white/[0.04] rounded w-4/6 animate-pulse" />
        </div>
        <p className="text-[11px] text-white/25 mt-3">
          {isUpgrading ? "Full analysis running — summary loading..." : "Generating plain-language summary..."}
        </p>
      </div>
    );
  }

  // ── Failed (after exhausting retries) ─────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] px-5 py-4">
        <p className="text-xs text-white/30 text-center italic">Coming soon</p>
      </div>
    );
  }

  // ── Not yet triggered ─────────────────────────────────────────────────────
  if (status === "not_requested" || !summary) return null;

  // ── Ready ─────────────────────────────────────────────────────────────────
  const bodyArr = Array.isArray(summary.body) ? summary.body : (summary.body ? [summary.body as unknown as string] : []);
  const visibleBody = bodyExpanded ? bodyArr : bodyArr.slice(0, 2);
  const hasMore = bodyArr.length > 2;

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div className={`w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${styles.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-widest ${styles.iconColor} opacity-70`}>
              {styles.label}
            </span>
            <span className="text-[11px] text-white/20">·</span>
            <span className="text-[11px] text-white/30 flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" />
              Summary
            </span>
          </div>
          <p className={`text-sm font-bold leading-snug mt-0.5 ${styles.headlineColor}`}>
            {summary.headline}
          </p>
        </div>
      </div>

      {/* Body sentences */}
      <div className="px-5 pb-3 space-y-2">
        {visibleBody.map((sentence: string, i: number) => (
          <p key={i} className="text-sm text-white/70 leading-relaxed">
            {sentence}
          </p>
        ))}

        {hasMore && (
          <button
            onClick={() => setBodyExpanded(!bodyExpanded)}
            className="flex items-center gap-1 text-xs text-white/35 hover:text-white/60 transition-colors mt-1"
          >
            {bodyExpanded
              ? <><ChevronUp className="w-3 h-3" /> Show less</>
              : <><ChevronDown className="w-3 h-3" /> Read more</>
            }
          </button>
        )}
      </div>

      {/* Bottom line — the concrete action */}
      <div className={`px-5 py-3 border-t ${styles.border} flex items-start gap-2`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${styles.iconColor} opacity-60 shrink-0 mt-0.5`}>
          Next step
        </span>
        <p className="text-sm text-white/80 leading-snug font-medium">
          {summary.bottom_line}
        </p>
      </div>

      {/* Confidence caveat — only when evidence is partial/missing */}
      {summary.confidence_note && (
        <div className="px-5 py-2.5 border-t border-white/[0.05]">
          <p className="text-[11px] text-white/35 leading-relaxed">
            {summary.confidence_note}
          </p>
        </div>
      )}

      {/* NMVTIS reconciliation note — shown when VinAudit confirmed clean after summary was written */}
      {vinAuditClean === true && (
        <div className="px-5 py-2.5 border-t border-white/[0.05] flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3 text-green-400/70 shrink-0" />
          <p className="text-[11px] text-green-400/70 leading-relaxed">
            NMVTIS confirmed: no accident or theft records found for this VIN.
          </p>
        </div>
      )}
    </div>
  );
}
