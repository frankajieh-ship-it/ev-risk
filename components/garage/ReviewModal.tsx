"use client";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import StarRating from "./StarRating";

export interface GarageReview {
  id: string;
  garage_vehicle_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const REVIEW_TAGS = [
  { value: "great_range", label: "Great Range" },
  { value: "smooth_ride", label: "Smooth Ride" },
  { value: "reliable", label: "Reliable" },
  { value: "good_value", label: "Good Value" },
  { value: "range_anxiety", label: "Range Anxiety" },
  { value: "charging_issues", label: "Charging Issues" },
];

interface ReviewModalProps {
  vehicleId: string;
  vehicleName: string;
  authToken: string;
  existingReview: GarageReview | null;
  onClose: () => void;
  onSaved: (review: GarageReview) => void;
}

export default function ReviewModal({
  vehicleId,
  vehicleName,
  authToken,
  existingReview,
  onClose,
  onSaved,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number | null>(existingReview?.rating ?? null);
  const [reviewText, setReviewText] = useState(existingReview?.review_text ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(existingReview?.tags ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trap focus / close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a star rating."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace/garage/${vehicleId}/review`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating,
          review_text: reviewText.trim() || undefined,
          tags: selectedTags,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to save review.");
      } else {
        onSaved(data.review);
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {existingReview ? "Edit your review" : "Rate this vehicle"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{vehicleName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors -mt-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stars */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-700 mb-2">Overall rating</p>
          <StarRating value={rating} onChange={setRating} size="lg" />
          {rating && (
            <p className="text-xs text-gray-400 mt-1">
              {["", "Poor", "Below average", "Average", "Good", "Excellent"][rating]}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-700 mb-2">Tags (optional)</p>
          <div className="flex flex-wrap gap-2">
            {REVIEW_TAGS.map((tag) => {
              const active = selectedTags.includes(tag.value);
              return (
                <button
                  key={tag.value}
                  onClick={() => toggleTag(tag.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Review text */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-700 mb-2">Notes (optional)</p>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="How was the range, charging, ride quality, or ownership experience?"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
          <p className="text-xs text-gray-400 text-right mt-0.5">{reviewText.length}/500</p>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !rating}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {existingReview ? "Update review" : "Save review"}
          </button>
        </div>
      </div>
    </div>
  );
}
