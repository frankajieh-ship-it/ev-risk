"use client";

import { useState, useEffect } from "react";

interface FeedbackWidgetProps {
  contextType: "receipt" | "seo_page";
  contextId?: string;
  className?: string;
}

const OPTIONS = [
  { value: "helpful" as const, emoji: "👍", label: "Helpful" },
  { value: "okay" as const, emoji: "😐", label: "Okay" },
  { value: "not_useful" as const, emoji: "👎", label: "Not useful" },
];

export default function FeedbackWidget({
  contextType,
  contextId,
  className = "",
}: FeedbackWidgetProps) {
  const [selected, setSelected] = useState<"helpful" | "okay" | "not_useful" | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [followUpSent, setFollowUpSent] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const storageKey = contextId
    ? `offo_feedback_${contextId}`
    : `offo_feedback_${contextType}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) setAlreadySubmitted(true);
    } catch { /* ignore */ }
  }, [storageKey]);

  // Track shown
  useEffect(() => {
    if (alreadySubmitted) return;
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "feedback_shown",
        eventData: { context_type: contextType, context_id: contextId },
      }),
    }).catch(() => {});
  }, [alreadySubmitted, contextType, contextId]);

  const handleSelect = async (value: "helpful" | "okay" | "not_useful") => {
    if (selected) return; // already picked
    setSelected(value);
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }

    // Submit immediately on tap
    await Promise.all([
      fetch("/api/report-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: contextId || null,
          rating: value === "helpful" ? 5 : value === "okay" ? 3 : 1,
          feedbackText: null,
          wouldRecommend: value === "helpful" ? true : value === "not_useful" ? false : null,
        }),
      }).catch(() => {}),
      fetch("/api/track-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "feedback_submitted",
          eventData: { context_type: contextType, context_id: contextId, rating: value },
        }),
      }).catch(() => {}),
    ]);
  };

  const handleFollowUp = async () => {
    if (!followUpText.trim() || followUpSent) return;
    setFollowUpSent(true);
    await fetch("/api/report-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId: contextId || null,
        rating: selected === "helpful" ? 5 : selected === "okay" ? 3 : 1,
        feedbackText: followUpText.trim(),
        wouldRecommend: selected === "helpful" ? true : selected === "not_useful" ? false : null,
      }),
    }).catch(() => {});
  };

  if (alreadySubmitted) return null;

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 ${className}`}>
      {!selected ? (
        <>
          <p className="text-sm font-medium text-gray-800 mb-3 text-center">
            How helpful was this analysis?
          </p>
          <div className="flex gap-3">
            {OPTIONS.map(({ value, emoji, label }) => (
              <button
                key={value}
                onClick={() => handleSelect(value)}
                className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 active:scale-95 transition-all"
              >
                <span className="text-xl">{emoji}</span>
                <span className="text-xs font-medium text-gray-700">{label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{OPTIONS.find(o => o.value === selected)?.emoji}</span>
            <p className="text-sm font-medium text-gray-800">
              {selected === "helpful" ? "Glad it helped!" : selected === "okay" ? "Thanks for letting us know." : "Sorry to hear that."}
            </p>
          </div>
          {!followUpSent ? (
            <>
              <textarea
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder={selected === "not_useful" ? "What could be better? (optional)" : "Anything else to share? (optional)"}
                className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                maxLength={500}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleFollowUp}
                  disabled={!followUpText.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
                >
                  Send
                </button>
                <button
                  onClick={() => setFollowUpSent(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400">Thanks — your feedback helps us improve.</p>
          )}
        </div>
      )}
    </div>
  );
}
