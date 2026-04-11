type BadgeVariant = "success" | "warning" | "danger" | "primary" | "neutral" | "auction";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-green-50 text-green-700 ring-1 ring-green-200/60",
  warning: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200/60",
  danger:  "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  primary: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60",
  neutral: "bg-gray-50 text-gray-600 ring-1 ring-gray-200/60",
  auction: "auction-badge",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[0.6875rem] font-medium",
  md: "px-2.5 py-0.5 text-xs font-medium",
};

export function Badge({
  variant = "neutral",
  size = "sm",
  className = "",
  children,
}: BadgeProps) {
  if (variant === "auction") {
    return <span className={`auction-badge ${className}`}>{children}</span>;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
