/**
 * ExitFeedbackModal — exit-intent quick feedback
 *
 * Triggers when a user generated a receipt and navigates away / switches tabs
 * without having submitted feedback. One-click 3-option response.
 */

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ExitFeedbackModalProps {
  hasReceipt: boolean;
  receiptId?: string;
}

const STORAGE_KEY = "offo_exit_feedback_done";

export default function ExitFeedbackModal({ hasReceipt, receiptId }: ExitFeedbackModalProps) {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!hasReceipt) return;
    // Don't show if already submitted this session or ever
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { /* ignore */ }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setVisible(true);
        // Track shown so it counts in analytics alongside FeedbackWidget
        fetch("/api/track-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: "feedback_shown",
            eventData: { source: "exit_intent", receipt_id: receiptId },
          }),
        }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hasReceipt, receiptId]);

  const handleSelect = async (rating: "helpful" | "okay" | "not_useful") => {
    setSubmitted(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch { /* ignore */ }

    // Track event (fire-and-forget)
    try {
      await fetch("/api/track-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "feedback_submitted",
          eventData: {
            source: "exit_intent",
            rating,
            receipt_id: receiptId,
          },
        }),
      });
    } catch { /* non-critical */ }

    setTimeout(() => setVisible(false), 1800);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 relative">
        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {submitted ? (
          <div className="text-center py-2">
            <p className="text-base font-semibold text-gray-900">Thanks for the feedback!</p>
            <p className="text-sm text-gray-500 mt-1">It helps us improve.</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Before you go — how was your analysis?
            </p>
            <p className="text-xs text-gray-500 mb-4">Takes 1 second, no account needed.</p>
            <div className="flex gap-3">
              {([
                { value: "helpful" as const, emoji: "👍", label: "Helpful" },
                { value: "okay" as const, emoji: "😐", label: "Okay" },
                { value: "not_useful" as const, emoji: "👎", label: "Not useful" },
              ]).map(({ value, emoji, label }) => (
                <button
                  key={value}
                  onClick={() => handleSelect(value)}
                  className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-center"
                >
                  <span className="text-xl">{emoji}</span>
                  <span className="text-xs font-medium text-gray-700">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
