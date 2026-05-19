/**
 * EmailCaptureCard — Email checklist delivery after receipt generation
 *
 * Sends the receipt checklist (verdict, risk flags, must-ask questions,
 * negotiation opener) to the user's email via /api/email/checklist.
 * Falls back to capture-only mode if no receiptId is provided.
 */

"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Loader2, Mail } from "lucide-react";
import { getAttributionForEvent } from "@/lib/attribution";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";

interface EmailCaptureCardProps {
  receiptId?: string;
  onSubmit?: () => void;
  onGarageSave?: () => void;
  /** When true, renders as a full unlock gate instead of a subtle nudge card */
  gateMode?: boolean;
}

export default function EmailCaptureCard({ receiptId, onSubmit, onGarageSave, gateMode = false }: EmailCaptureCardProps) {
  const { trackEvent } = useEventTracking();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track shown on mount
  useEffect(() => {
    trackEvent("email_capture_shown", { receipt_id: receiptId });
  }, [receiptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    setErrorMsg(null);

    try {
      if (receiptId) {
        // Send the actual checklist email
        const res = await fetch("/api/email/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            receipt_id: receiptId,
            anon_id: getOrCreatePersistentSessionId(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
          trackEvent("email_capture_submitted", { receipt_id: receiptId });
          onSubmit?.();
          onGarageSave?.();
        } else {
          setErrorMsg(data.error || "Failed to send. Try again.");
          setStatus("error");
        }
      } else {
        // Fallback: capture email only (no receipt to email)
        const res = await fetch("/api/checklist/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            attribution: getAttributionForEvent(),
            persistent_session_id: getOrCreatePersistentSessionId(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
          trackEvent("email_capture_submitted", { receipt_id: receiptId });
          onSubmit?.();
          onGarageSave?.();
        } else {
          setStatus("error");
        }
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-xl p-4 text-center">
        <CheckCircle className="w-5 h-5 text-[#00d97e] mx-auto mb-2" />
        <p className="text-sm text-[#00d97e] font-medium">
          {receiptId ? "Check your inbox!" : "You are on the list."}
        </p>
      </div>
    );
  }

  // Gate mode — prominent unlock card replacing the paywall
  if (gateMode) {
    return (
      <div className="rounded-2xl border border-[#00d97e]/25 bg-[#0d1117] overflow-hidden">
        <div className="bg-[#00d97e]/[0.07] border-b border-[#00d97e]/15 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Mail className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-wider">
              Full analysis ready
            </span>
          </div>
          <h2 className="text-lg font-bold text-white leading-snug">
            Unlock your full receipt — free
          </h2>
          <p className="text-sm text-white/40 mt-1">
            Drop your email and we&apos;ll send you the complete analysis + recall alerts for this vehicle.
          </p>
        </div>
        <div className="px-5 py-5">
          <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-3 py-2.5 text-sm bg-white/[0.06] border border-white/10 rounded-xl text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#00d97e]/50"
              required
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="px-5 py-2.5 text-sm font-bold text-[#0d1117] bg-[#00d97e] rounded-xl hover:bg-[#00c970] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {status === "submitting" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Unlock free"
              )}
            </button>
          </form>
          {status === "error" && (
            <p className="text-xs text-red-400 mb-2">{errorMsg || "Something went wrong. Try again."}</p>
          )}
          <p className="text-xs text-white/25">No spam. Unsubscribe any time. We&apos;ll also alert you if a recall is issued for this vehicle.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#00d97e]/[0.06] border border-[#00d97e]/20 rounded-xl p-4 border-l-2 border-l-[#00d97e]/50">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-[#00d97e]/70" />
        <p className="text-sm font-medium text-white/80">
          {receiptId ? "Save this analysis + get recall alerts for this vehicle" : "Get your OFFO analysis emailed."}
        </p>
      </div>
      <p className="text-xs text-white/50 mb-2.5">
        {receiptId
          ? "We'll email you the full verdict, negotiation script, and alert you if a recall is issued for this vehicle."
          : "Verdict, risk flags, and negotiation script — direct to your inbox. No sign-up required."}
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 px-3 py-2 text-sm bg-white/[0.06] border border-white/10 rounded-lg text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-[#00d97e]/50"
          required
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-4 py-2 text-sm font-medium text-[#0d1117] bg-[#00d97e] rounded-lg hover:bg-[#00c970] disabled:opacity-50 transition-colors"
        >
          {status === "submitting" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Send"
          )}
        </button>
      </form>
      <p className="text-xs text-white/30 mt-1.5">
        Free. No spam. Unsubscribe any time.
      </p>
      {status === "error" && (
        <p className="text-xs text-red-400 mt-1">
          {errorMsg || "Something went wrong. Try again."}
        </p>
      )}
    </div>
  );
}
