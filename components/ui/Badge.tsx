type BadgeVariant = "success" | "warning" | "danger" | "primary" | "neutral" | "auction";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger:  "bg-red-100 text-red-800",
  primary: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-700",
  auction: "auction-badge",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
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
