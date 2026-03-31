"use client";

import { useState } from "react";

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-7 h-7",
};

function Star({ filled, hovered, onClick, onMouseEnter, onMouseLeave, size, readonly }: {
  filled: boolean;
  hovered: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  size: string;
  readonly: boolean;
}) {
  const active = filled || hovered;
  return (
    <svg
      className={`${size} transition-colors ${readonly ? "" : "cursor-pointer"} ${
        active ? "text-amber-400" : "text-gray-300"
      }`}
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.5}
      viewBox="0 0 24 24"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

export default function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const sizeClass = SIZE_MAP[size];

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverIndex(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          filled={value !== null && star <= value}
          hovered={!readonly && hoverIndex !== null && star <= hoverIndex}
          size={sizeClass}
          readonly={readonly}
          onClick={readonly ? undefined : () => onChange?.(star)}
          onMouseEnter={readonly ? undefined : () => setHoverIndex(star)}
          onMouseLeave={readonly ? undefined : () => setHoverIndex(null)}
        />
      ))}
    </div>
  );
}
