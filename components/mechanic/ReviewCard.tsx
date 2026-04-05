import { CheckCircle } from "lucide-react";
import MechanicRatingStars from "./MechanicRatingStars";
import type { MechanicReview } from "@/types/mechanic";

interface ReviewCardProps {
  review: MechanicReview;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      {/* Top row: rating + date + verified */}
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <MechanicRatingStars rating={review.rating} showCount={false} size="sm" />
          {review.reviewer_name && (
            <span className="text-sm font-medium text-gray-800">{review.reviewer_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {review.is_verified && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle className="w-3.5 h-3.5" />
              Verified service
            </span>
          )}
          <span className="text-xs text-gray-400">{timeAgo(review.created_at)}</span>
        </div>
      </div>

      {/* Review title */}
      {review.title && (
        <p className="text-sm font-semibold text-gray-900 mb-1">{review.title}</p>
      )}

      {/* Review body */}
      {review.body && (
        <p className="text-sm text-gray-600 leading-relaxed">{review.body}</p>
      )}
    </div>
  );
}
