"use client";

import { Loader2 } from "lucide-react";

type ButtonSize = "sm" | "md" | "lg";
type ButtonVariant = "primary" | "success" | "auction" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export function Button({
  size = "md",
  variant = "primary",
  loading = false,
  icon,
  trailingIcon,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`btn-${size} btn-${variant} ${className}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}
