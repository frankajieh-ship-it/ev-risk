"use client";

/**
 * LoginModal Component
 *
 * Magic link login modal for user authentication.
 * Shows email input, sends magic link, and handles success state.
 */

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  redirectPath?: string; // Path to redirect after login
  /** "sync" shows garage sync copy; "default" shows generic sign-in copy */
  context?: "sync" | "default";
}

type ModalState = "input" | "sending" | "sent" | "error";

export default function LoginModal({
  isOpen,
  onClose,
  onSuccess,
  redirectPath,
  context = "default",
}: LoginModalProps) {
  const { login, isConfigured } = useAuth();
  const { trackEmailEntrySubmitted } = useEventTracking();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ModalState>("input");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setState("sending");
    setError(null);

    // Store redirect path for after auth
    if (redirectPath && typeof window !== "undefined") {
      localStorage.setItem("auth_redirect", redirectPath);
    }

    const result = await login(email);

    if (result.success) {
      // Track successful email submission (magic link sent)
      // Hash email for privacy (simple hash, not for security)
      const emailHash = email.split('@')[0].slice(0, 3) + '***';
      trackEmailEntrySubmitted(emailHash);

      setState("sent");
      onSuccess?.();
    } else {
      setState("error");
      setError(result.error || "Failed to send magic link");
    }
  };

  const handleClose = () => {
    setState("input");
    setEmail("");
    setError(null);
    onClose();
  };

  if (!isConfigured) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
          <p className="text-gray-600 text-center">
            Account features are not yet available. Check back soon!
          </p>
          <button
            onClick={handleClose}
            className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-fadeIn">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Input State */}
        {state === "input" && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {context === "sync" ? "Sync your garage across devices" : "Sign in to your account"}
              </h2>
              <p className="text-gray-600">
                {context === "sync"
                  ? "Sign in to access your saved vehicles and analyses on any device."
                  : "We'll send you a magic link to sign in. No password needed!"}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Send Magic Link
              </button>
            </form>

            <p className="mt-4 text-xs text-gray-500 text-center">
              By signing in, you agree to our terms of service and privacy policy.
            </p>
          </>
        )}

        {/* Sending State */}
        {state === "sending" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sending magic link...</h2>
            <p className="text-gray-600">Please wait while we send your login link.</p>
          </div>
        )}

        {/* Sent State */}
        {state === "sent" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email!</h2>
            <p className="text-gray-600 mb-4">
              We sent a magic link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-500">
              Click the link in your email to sign in. The link expires in 1 hour.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => {
                setState("input");
                setError(null);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
