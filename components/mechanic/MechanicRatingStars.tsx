import { Star } from "lucide-react";

interface MechanicRatingStarsProps {
  rating: number;         // 0–5, supports decimals
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
}

const SIZES = {
  sm: { star: "w-3 h-3",   text: "text-xs" },
  md: { star: "w-4 h-4",   text: "text-sm" },
  lg: { star: "w-5 h-5",   text: "text-base" },
};

export default function MechanicRatingStars({
  rating,
  reviewCount,
  size = "md",
  showCount = true,
}: MechanicRatingStarsProps) {
  const { star, text } = SIZES[size];
  const clamped = Math.min(5, Math.max(0, rating));

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = clamped >= n;
          const half   = !filled && clamped >= n - 0.5;
          return (
            <div key={n} className="relative">
              {/* Base (empty) star */}
              <Star className={`${star} text-gray-200`} fill="currentColor" />
              {/* Filled overlay — full or partial */}
              {(filled || half) && (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: filled ? "100%" : "50%" }}
                >
                  <Star className={`${star} text-amber-400`} fill="currentColor" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {clamped > 0 && (
        <span className={`${text} font-semibold text-gray-800`}>
          {clamped.toFixed(1)}
        </span>
      )}

      {showCount && reviewCount !== undefined && (
        <span className={`${text} text-gray-400`}>
          ({reviewCount.toLocaleString()})
        </span>
      )}

      {(!rating || rating === 0) && (
        <span className={`${text} text-gray-400`}>No reviews yet</span>
      )}
    </div>
  );
}
