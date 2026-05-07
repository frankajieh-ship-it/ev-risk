/**
 * ExitFeedbackModal — subtle timed feedback prompt
 *
 * Appears as a bottom-right toast 45s after a receipt is ready.
 * One-click 3-option response. Cooldown: 14 days.
 * Does NOT trigger on every tab-switch — passive and non-intrusive.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface ExitFeedbackModalProps {
  hasReceipt: boolean;
  receiptId?: string;
}

const STORAGE_KEY = "offo_feedback_last_shown";
// Show at most once every 14 days
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
// Wait 45s after receipt appears before showing
const DELAY_MS = 45_000;

export default function ExitFeedbackModal({ hasReceipt, receiptId }: ExitFeedbackModalProps) {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasReceipt) return;

    // Check cooldown
    try {
      const lastShown = localStorage.getItem(STORAGE_KEY);
      if (lastShown && Date.now() - Number(lastShown) < COOLDOWN_MS) return;
    } catch { /* ignore */ }

    // Schedule the prompt — passive delay, no exit-intent aggression
    timerRef.current = setTimeout(() => {
      setVisible(true);
      try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch { /* ignore */ }
      fetch("/api/track-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "feedback_shown",
          eventData: { source: "timed_prompt", receipt_id: receiptId },
        }),
      }).catch(() => {});
    }, DELAY_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [hasReceipt, receiptId]);

  const handleSelect = async (rating: "helpful" | "okay" | "not_useful") => {
    setSubmitted(true);
    try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch { /* ignore */ }
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "feedback_submitted",
        eventData: { source: "timed_prompt", rating, receipt_id: receiptId },
      }),
    }).catch(() => {});
    setTimeout(() => setVisible(false), 2000);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-4 z-50 w-72 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-[#161b22] border border-white/[0.10] rounded-2xl shadow-2xl p-4 relative">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {submitted ? (
          <div className="py-1">
            <p className="text-sm font-semibold text-white/90">Thanks for the feedback!</p>
            <p className="text-xs text-white/40 mt-0.5">Helps us keep improving.</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-white/90 pr-5 mb-0.5">
              Was this analysis helpful?
            </p>
            <p className="text-xs text-white/40 mb-3">Takes one tap, no sign-up needed.</p>
            <div className="flex gap-2">
              {([
                { value: "helpful" as const, emoji: "👍", label: "Helpful" },
                { value: "okay" as const, emoji: "😐", label: "Okay" },
                { value: "not_useful" as const, emoji: "👎", label: "Not useful" },
              ]).map(({ value, emoji, label }) => (
                <button
                  key={value}
                  onClick={() => handleSelect(value)}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border border-white/[0.08] hover:border-[#00d97e]/40 hover:bg-[#00d97e]/[0.06] transition-all text-center"
                >
                  <span className="text-lg">{emoji}</span>
                  <span className="text-[11px] font-medium text-white/60">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
