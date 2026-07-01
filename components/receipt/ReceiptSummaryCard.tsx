/**
 * ReceiptSummaryCard — Human-voice plain-language summary, shown above all other receipt detail.
 *
 * Automatically triggers on-demand generation when the receipt is "full".
 * Uses the multi-LLM hedged generate pipeline via /api/receipt/{id}/generate/receipt_summary.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, RefreshCw, MessageSquare, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, CheckCircle, Lock, Zap, Mail } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { getOrCreateReceiptToken, getOrCreatePersistentSessionId } from "@/lib/session-utils";
import { getAttributionForEvent } from "@/lib/attribution";
import type { ListingAISummary } from "@/lib/receipt-sections";

interface ReceiptSummaryCardProps {
  receiptId: string;
  isUpgrading: boolean;
  generationStatus: string;
  initialSummary?: ListingAISummary | null;
  initialStatus?: string;
  verdict: "GREEN" | "YELLOW" | "RED";
  vin?: string | null;
  isUnlocked?: boolean;
  emailUnlocked?: boolean;
  paymentsEnabled?: boolean;
  onPaywallClick?: () => void;
  onEmailCapture?: () => void;
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
  isUnlocked = false,
  emailUnlocked = false,
  paymentsEnabled = false,
  onPaywallClick,
  onEmailCapture,
}: ReceiptSummaryCardProps) {
  const { trackEvent } = useEventTracking();
  const retryCountRef = useRef(0);

  const [vinAuditClean, setVinAuditClean] = useState<boolean | null>(null);
  useEffect(() => {
    if (!vin || !isUnlocked) return;
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
  }, [vin, isUnlocked]);

  // Inline email gate state
  const [emailInput, setEmailInput] = useState("");
  const [emailGateState, setEmailGateState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [emailGateError, setEmailGateError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailGateError("Enter a valid email address");
      return;
    }
    setEmailGateState("submitting");
    setEmailGateError(null);
    try {
      const res = await fetch("/api/checklist/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          attribution: getAttributionForEvent(),
          persistent_session_id: getOrCreatePersistentSessionId(),
          source: "summary_email_gate",
        }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("offo_email_captured", "1");
        setEmailGateState("success");
        setTimeout(() => onEmailCapture?.(), 600);
      } else {
        setEmailGateState("error");
        setEmailGateError(data.error || "Something went wrong.");
      }
    } catch {
      setEmailGateState("error");
      setEmailGateError("Connection error. Try again.");
    }
  };

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

  useEffect(() => {
    if (generationStatus === "full" && !isUpgradingRef.current && status === "not_requested") {
      setTimeout(() => generateRef.current(), 0);
    }
  }, [generationStatus, status]);

  const verdictTone = verdictToTone(verdict);
  const aiTone = (summary?.tone && summary.tone in TONE_STYLES) ? summary.tone as Tone : verdictTone;
  const TONE_SEVERITY: Record<Tone, number> = { proceed: 0, caution: 1, stop: 2 };
  const tone: Tone = TONE_SEVERITY[aiTone] > TONE_SEVERITY[verdictTone] ? verdictTone : aiTone;
  const styles = TONE_STYLES[tone];
  const { Icon } = styles;

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

  if (status === "failed") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#161b22] px-5 py-4 space-y-2">
        <p className="text-xs text-white/40 text-center">Summary unavailable — full analysis below.</p>
        <button
          onClick={() => generate(false)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-white/50 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/[0.08] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (status === "not_requested" || !summary) return null;

  const bodyArr = Array.isArray(summary.body) ? summary.body : [];
  if (bodyArr.length === 0) return null;

  // Gate logic: email captures summary, payment captures everything else
  const showSummary = isUnlocked || emailUnlocked;

  if (paymentsEnabled && !showSummary) {
    // Email gate — first step, free
    return (
      <div className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden relative`}>
        {/* Blurred preview */}
        <div className="blur-sm pointer-events-none select-none opacity-50">
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <div className={`w-8 h-8 rounded-full ${styles.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${styles.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${styles.iconColor} opacity-70`}>
                {styles.label}
              </span>
              <p className={`text-sm font-bold leading-snug mt-0.5 ${styles.headlineColor}`}>
                {summary.headline}
              </p>
            </div>
          </div>
          <div className="px-5 pb-3 space-y-2">
            {bodyArr.slice(0, 2).map((sentence: string, i: number) => (
              <p key={i} className="text-sm text-white/70 leading-relaxed">{sentence}</p>
            ))}
          </div>
        </div>
        {/* Email gate overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d1117]/70 backdrop-blur-[2px] rounded-xl px-6">
          {emailGateState === "success" ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-7 h-7 text-[#00d97e]" />
              <p className="text-sm font-medium text-white">Unlocking summary…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
                <Mail className="w-4 h-4 text-[#00d97e]" />
                Your analysis is ready
              </div>
              <p className="text-xs text-white/40 text-center max-w-[220px]">
                Enter your email to read the full AI summary — free, no card needed.
              </p>
              <form onSubmit={handleEmailSubmit} className="w-full max-w-[260px] space-y-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setEmailGateError(null); }}
                  placeholder="your@email.com"
                  autoFocus
                  disabled={emailGateState === "submitting"}
                  className="w-full px-3 py-2.5 text-sm bg-white/[0.08] border border-white/[0.15] rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00d97e]/50 focus:border-[#00d97e]/50"
                />
                {emailGateError && <p className="text-xs text-red-400">{emailGateError}</p>}
                <button
                  type="submit"
                  disabled={emailGateState === "submitting" || !emailInput.trim()}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm text-[#0d1117] bg-[#00d97e] hover:bg-[#00c970] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {emailGateState === "submitting" ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Unlocking…</>
                  ) : "Read free summary →"}
                </button>
              </form>
              <p className="text-[10px] text-white/25">No spam · Unsubscribe anytime</p>
              {onPaywallClick && (
                <button
                  onClick={onPaywallClick}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors mt-1"
                >
                  <Zap className="w-3 h-3" />
                  Skip to full unlock — $9.99
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  const visibleBody = bodyExpanded ? bodyArr : bodyArr.slice(0, 2);
  const hasMore = bodyArr.length > 2;

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden`}>
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

      <div className={`px-5 py-3 border-t ${styles.border} flex items-start gap-2`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${styles.iconColor} opacity-60 shrink-0 mt-0.5`}>
          Next step
        </span>
        <p className="text-sm text-white/80 leading-snug font-medium">
          {summary.bottom_line}
        </p>
      </div>

      {summary.confidence_note && (
        <div className="px-5 py-2.5 border-t border-white/[0.05]">
          <p className="text-[11px] text-white/35 leading-relaxed">
            {summary.confidence_note}
          </p>
        </div>
      )}

      {vinAuditClean === true && (
        <div className="px-5 py-2.5 border-t border-white/[0.05] flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3 text-green-400/70 shrink-0" />
          <p className="text-[11px] text-green-400/70 leading-relaxed">
            NMVTIS confirmed: no accident or theft records found for this VIN.
          </p>
        </div>
      )}

      {/* Soft upsell — shown when email captured but not yet paid */}
      {paymentsEnabled && !isUnlocked && showSummary && onPaywallClick && (
        <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            VIN history · negotiation scripts · photo analysis
          </p>
          <button
            onClick={onPaywallClick}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00d97e]/10 hover:bg-[#00d97e]/20 text-[#00d97e] text-xs font-semibold transition-colors"
          >
            <Zap className="w-3 h-3" />
            Unlock all · $9.99
          </button>
        </div>
      )}
    </div>
  );
}
