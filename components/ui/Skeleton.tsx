type SkeletonRounded = "sm" | "md" | "lg" | "full";

interface SkeletonProps {
  className?: string;
  rounded?: SkeletonRounded;
}

const ROUNDED: Record<SkeletonRounded, string> = {
  sm:   "rounded",
  md:   "rounded-lg",
  lg:   "rounded-xl",
  full: "rounded-full",
};

export function Skeleton({ className = "", rounded = "md" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-100 ${ROUNDED[rounded]} ${className}`}
      aria-hidden="true"
    />
  );
}
