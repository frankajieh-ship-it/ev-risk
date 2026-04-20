"use client";

/**
 * LoginModal — compatibility shim.
 * Delegates to components/auth/LoginModal (dark theme, Google + email/password).
 * Keeps old `isOpen` prop so existing callers don't need changes.
 */
import AuthLoginModal from "@/components/auth/LoginModal";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  redirectPath?: string;
  context?: "sync" | "default";
}

export default function LoginModal({ isOpen, onClose, redirectPath, context }: LoginModalProps) {
  return (
    <AuthLoginModal
      open={isOpen}
      onClose={onClose}
      redirectAfter={redirectPath ?? "/workspace"}
      headline={context === "sync" ? "Sync your garage" : "Sign in to OFFO"}
      subtext={
        context === "sync"
          ? "Sign in to access your saved vehicles across devices."
          : "Create a free account to sync your garage across devices."
      }
    />
  );
}
