"use client";

/**
 * WhyCheckpointCard - Optional intent signal capture
 *
 * Displays a low-friction single-select question on the Report View
 * to segment early users by their reason for using the tool.
 *
 * Features:
 * - Shows once per visitor (localStorage gated)
 * - Skip suppresses for 7 days
 * - Fire-and-forget event tracking (no blocking)
 * - "Other" option with text input
 */

import { useState, useEffect, useCallback } from "react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface WhyCheckpointCardProps {
  reportId?: string;
}

export default function WhyCheckpointCard({ reportId }: WhyCheckpointCardProps) {
  const [visible, setVisible] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { trackWhyCheckpoint } = useEventTracking();

  const choices = [
    { value: "buying_soon", label: "Buying soon" },
    { value: "moved", label: "Recently moved" },
    { value: "charging_issues", label: "Charging issues" },
    { value: "curious", label: "Just curious" },
    { value: "other", label: "Other" },
  ];

  // Memoize the check function to avoid dependency issues
  const checkShouldShow = useCallback(() => {
    if (typeof window === "undefined") return false;

    const answered = localStorage.getItem("offo_why_answered");
    if (answered === "true") return false;

    const skippedAt = localStorage.getItem("offo_why_skipped_at");
    if (skippedAt) {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (parseInt(skippedAt) > sevenDaysAgo) return false;
    }

    return true;
  }, []);

  // Check if we already tracked "shown" for this specific report
  const hasTrackedShownForReport = useCallback((rid: string | undefined) => {
    if (!rid || typeof window === "undefined") return false;
    return localStorage.getItem(`offo_why_shown_${rid}`) === "true";
  }, []);

  useEffect(() => {
    if (checkShouldShow()) {
      setVisible(true);
      // Only track "shown" once per report_id to prevent duplicates
      if (!hasTrackedShownForReport(reportId)) {
        trackWhyCheckpoint("shown", { report_id: reportId });
        if (reportId) {
          localStorage.setItem(`offo_why_shown_${reportId}`, "true");
        }
      }
    }
  }, [reportId, checkShouldShow, trackWhyCheckpoint, hasTrackedShownForReport]);

  const handleSubmit = async () => {
    if (!selectedChoice) return;

    // Optimistic UI - show thanks immediately
    setSubmitted(true);
    localStorage.setItem("offo_why_answered", "true");

    // Fire-and-forget - don't block on response
    try {
      trackWhyCheckpoint("submitted", {
        why_choice: selectedChoice,
        why_other_text: selectedChoice === "other" ? otherText : undefined,
        report_id: reportId,
      });
    } catch {
      // Silent fail - don't disrupt user experience
      trackWhyCheckpoint("error", {
        error_code: "submit_failed",
        report_id: reportId,
      });
    }
  };

  const handleSkip = () => {
    localStorage.setItem("offo_why_skipped_at", Date.now().toString());
    setVisible(false);
    trackWhyCheckpoint("skipped", { report_id: reportId });
  };

  // Don't render if not visible
  if (!visible) return null;

  // Show thanks message after submit
  if (submitted) {
    return (
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
        <p className="text-green-800 font-medium">Thanks — this helps us improve.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-5 bg-gray-50 border border-gray-200 rounded-xl">
      <h4 className="text-sm font-semibold text-gray-700 mb-1">Quick question (optional)</h4>
      <p className="text-sm text-gray-600 mb-4">What made you try this today?</p>

      {/* Choice chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {choices.map((choice) => (
          <button
            key={choice.value}
            onClick={() => setSelectedChoice(choice.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedChoice === choice.value
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {/* Other text input - only shown when "other" is selected */}
      {selectedChoice === "other" && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="Tell us more..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 text-gray-900"
          maxLength={200}
        />
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!selectedChoice}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Submit
        </button>
        <button
          onClick={handleSkip}
          className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-900 transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Privacy note */}
      <p className="mt-3 text-xs text-gray-500">
        Optional — helps us understand why EV decisions feel stressful. No personal info.
      </p>
    </div>
  );
}
