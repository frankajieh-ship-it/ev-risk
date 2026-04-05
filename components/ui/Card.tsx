type CardElevation = "flat" | "base" | "raised";
type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
  interactive?: boolean;
  padding?: CardPadding;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-5",
  lg:   "p-6",
};

export function Card({
  elevation = "base",
  interactive = false,
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={`card-${elevation} ${interactive ? "card-interactive" : ""} ${PADDING_CLASSES[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
