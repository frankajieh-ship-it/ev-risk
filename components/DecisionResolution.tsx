"use client";

/**
 * DecisionResolution - Post-results decision tracking
 *
 * Displays a low-friction 1-click module to capture how the
 * routine check helped (or didn't help) the user's decision.
 *
 * Features:
 * - One-click submission (no modal)
 * - Optional follow-up: surfaced new tradeoff toggle
 * - Optional follow-up: confidence-after slider
 * - Fire-and-forget API call
 * - Shows once per session
 */

import { useState, useEffect } from "react";

interface DecisionResolutionProps {
  sessionId: string | null;
  onResolutionSubmitted?: (outcome: string) => void;
}

type DecisionOutcome =
  | "MORE_CONFIDENT_BUYING"
  | "MORE_CONFIDENT_NOT_BUYING"
  | "NEED_MORE_TIME"
  | "CONFIRMED_CONCERNS"
  | "OTHER";

const OUTCOMES: { value: DecisionOutcome; label: string; emoji: string }[] = [
  { value: "MORE_CONFIDENT_BUYING", label: "More confident buying", emoji: "✅" },
  { value: "MORE_CONFIDENT_NOT_BUYING", label: "More confident not buying", emoji: "🚫" },
  { value: "NEED_MORE_TIME", label: "Need more time", emoji: "⏳" },
  { value: "CONFIRMED_CONCERNS", label: "Confirmed my concerns", emoji: "⚠️" },
];

export default function DecisionResolution({
  sessionId,
  onResolutionSubmitted,
}: DecisionResolutionProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<DecisionOutcome | null>(null);
  const [surfacedNewTradeoff, setSurfacedNewTradeoff] = useState<boolean | null>(null);
  const [confidenceAfter, setConfidenceAfter] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showConfidenceSlider, setShowConfidenceSlider] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);

  // Check if already answered (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const answered = localStorage.getItem(`offo_decision_${sessionId}`);
    if (answered === "true") {
      setAlreadyAnswered(true);
    }
  }, [sessionId]);

  const handleOutcomeClick = async (outcome: DecisionOutcome) => {
    setSelectedOutcome(outcome);
    setShowFollowUp(true);

    // Submit immediately on click (optimistic)
    await submitResolution(outcome, null);
  };

  const submitResolution = async (
    outcome: DecisionOutcome,
    tradeoff: boolean | null
  ) => {
    if (!sessionId) return;

    // Optimistic UI
    setSubmitted(true);
    localStorage.setItem(`offo_decision_${sessionId}`, "true");

    // Fire-and-forget API call
    try {
      await fetch("/api/session/resolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          decision_outcome: outcome,
          surfaced_new_tradeoff: tradeoff,
        }),
      });
    } catch {
      // Silent fail - don't disrupt user experience
      console.error("Failed to submit resolution");
    }

    onResolutionSubmitted?.(outcome);
  };

  const handleTradeoffAnswer = async (answer: boolean) => {
    setSurfacedNewTradeoff(answer);
    setShowConfidenceSlider(true);

    // Update with follow-up answer
    if (selectedOutcome) {
      try {
        await fetch("/api/session/resolution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            decision_outcome: selectedOutcome,
            surfaced_new_tradeoff: answer,
          }),
        });
      } catch {
        // Silent fail
      }
    }
  };

  const handleConfidenceSelect = async (value: number) => {
    setConfidenceAfter(value);

    // Update with confidence after
    if (selectedOutcome) {
      try {
        await fetch("/api/session/resolution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            decision_outcome: selectedOutcome,
            surfaced_new_tradeoff: surfacedNewTradeoff,
            confidence_after: value,
          }),
        });
      } catch {
        // Silent fail
      }
    }
  };

  // Don't render if no session or already answered
  if (!sessionId || alreadyAnswered) return null;

  // Show thanks message after submit
  if (submitted && !showFollowUp) {
    return (
      <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
        <p className="text-green-800 font-medium">Thanks — this helps us improve wording.</p>
      </div>
    );
  }

  // Show follow-up question if outcome selected
  if (showFollowUp && selectedOutcome) {
    return (
      <div className="mt-8 p-5 bg-gray-50 border border-gray-200 rounded-xl">
        {/* P0/P1: Show confidence slider after tradeoff question */}
        {showConfidenceSlider ? (
          <div className="text-center">
            <p className="text-green-700 font-medium text-sm mb-3">
              Almost done! Last question:
            </p>
            <p className="text-gray-700 text-sm mb-4">
              How confident are you in your decision now?
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => handleConfidenceSelect(value)}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${
                    confidenceAfter === value
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500 px-4 mb-3">
              <span>Not confident</span>
              <span>Very confident</span>
            </div>
            {confidenceAfter !== null && (
              <p className="text-center text-green-700 text-sm font-medium mt-4">
                Thanks — this helps us improve wording.
              </p>
            )}
            <button
              onClick={() => setShowFollowUp(false)}
              className="block mx-auto mt-3 text-xs text-gray-500 hover:text-gray-700"
            >
              Skip
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-green-700 font-medium text-sm mb-3">
                Thanks! One quick follow-up:
              </p>
              <p className="text-gray-700 text-sm">
                Did this surface something you weren&apos;t considering?
              </p>
            </div>

            <div className="flex justify-center gap-3 mb-3">
              <button
                onClick={() => handleTradeoffAnswer(true)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                  surfacedNewTradeoff === true
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400"
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => handleTradeoffAnswer(false)}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                  surfacedNewTradeoff === false
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400"
                }`}
              >
                No
              </button>
            </div>

            <button
              onClick={() => setShowFollowUp(false)}
              className="block mx-auto mt-3 text-xs text-gray-500 hover:text-gray-700"
            >
              Skip
            </button>
          </>
        )}
      </div>
    );
  }

  // Main view - decision outcome buttons
  return (
    <div className="mt-8 p-5 bg-gray-50 border border-gray-200 rounded-xl">
      <h4 className="text-sm font-semibold text-gray-700 mb-1 text-center">
        Did this help you decide?
      </h4>
      <p className="text-xs text-gray-500 mb-4 text-center">
        Optional — helps us improve the wording
      </p>

      {/* Outcome buttons - 2x2 grid on mobile, row on desktop */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-2">
        {OUTCOMES.map((outcome) => (
          <button
            key={outcome.value}
            onClick={() => handleOutcomeClick(outcome.value)}
            className={`px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
              selectedOutcome === outcome.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            <span className="mr-1">{outcome.emoji}</span>
            {outcome.label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-400 text-center">
        No personal info collected
      </p>
    </div>
  );
}
