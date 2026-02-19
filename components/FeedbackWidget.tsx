"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";

interface FeedbackWidgetProps {
  contextType: "receipt" | "seo_page";
  contextId?: string;
  className?: string;
}

export default function FeedbackWidget({
  contextType,
  contextId,
  className = "",
}: FeedbackWidgetProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const storageKey = contextId
    ? `offo_feedback_${contextId}`
    : `offo_feedback_${contextType}`;

  // Check if already submitted
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) {
        setAlreadySubmitted(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, [storageKey]);

  // Track feedback_shown
  useEffect(() => {
    if (alreadySubmitted) return;
    try {
      fetch("/api/track-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "feedback_shown",
          eventData: { context_type: contextType, context_id: contextId },
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // non-critical
    }
  }, [alreadySubmitted, contextType, contextId]);

  const handleSubmit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/report-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: contextId || null,
          rating,
          feedbackText: feedbackText.trim() || null,
          wouldRecommend,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        try {
          localStorage.setItem(storageKey, "1");
        } catch {
          // localStorage unavailable
        }

        // Track submission
        fetch("/api/track-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName: "feedback_submitted",
            eventData: {
              context_type: contextType,
              context_id: contextId,
              rating,
            },
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  if (alreadySubmitted) return null;

  if (submitted) {
    return (
      <div
        className={`bg-white border border-gray-200 rounded-xl p-5 text-center ${className}`}
      >
        <p className="text-sm font-medium text-gray-900">
          Thank you for your feedback!
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Your input helps us improve OFFO.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-5 ${className}`}
    >
      {/* Star rating */}
      <p className="text-sm font-medium text-gray-900 mb-3">
        How helpful was this?
      </p>
      <div className="flex items-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-0.5 transition-colors"
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={`w-6 h-6 transition-colors ${
                star <= (hoveredStar || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-xs text-gray-500 ml-2">
            {rating === 1
              ? "Poor"
              : rating === 2
              ? "Fair"
              : rating === 3
              ? "Good"
              : rating === 4
              ? "Very good"
              : "Excellent"}
          </span>
        )}
      </div>

      {/* Expanded section after star selection */}
      {rating > 0 && (
        <div className="mt-4 space-y-3">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Tell us more (optional)..."
            className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            maxLength={2000}
          />

          {/* Would recommend */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">
              Would you recommend OFFO?
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setWouldRecommend(wouldRecommend === true ? null : true)
                }
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  wouldRecommend === true
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() =>
                  setWouldRecommend(wouldRecommend === false ? null : false)
                }
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  wouldRecommend === false
                    ? "bg-red-50 border-red-300 text-red-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg py-2 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      )}
    </div>
  );
}
