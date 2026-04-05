/**
 * EmailGateModal — Soft-gate email capture after extraction success
 *
 * Shows after URL/text extraction populates fields but before the user
 * clicks "Generate Receipt". Single email field with submit or skip.
 * Posts to /api/checklist/email for capture-only mode.
 */

"use client";

import { useState } from "react";
import { Mail, X, Loader2, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEventTracking } from "@/hooks/useEventTracking";
import { getAttributionForEvent } from "@/lib/attribution";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";

interface EmailGateModalProps {
  isOpen: boolean;
  onSubmit: (email: string) => void;
  onSkip: () => void;
  vehicleSummary?: string;
}

type ModalState = "idle" | "submitting" | "success" | "error";

export default function EmailGateModal({
  isOpen,
  onSubmit,
  onSkip,
  vehicleSummary,
}: EmailGateModalProps) {
  const { trackEvent } = useEventTracking();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ModalState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMsg("Please enter a valid email address");
      return;
    }

    setState("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/checklist/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          attribution: getAttributionForEvent(),
          persistent_session_id: getOrCreatePersistentSessionId(),
          source: "email_gate",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setState("success");
        trackEvent("email_gate_submitted", { email_hash: trimmed.length });
        localStorage.setItem("offo_email_captured", "1");

        // Brief success state before closing
        setTimeout(() => onSubmit(trimmed), 800);
      } else {
        setState("error");
        setErrorMsg(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setErrorMsg("Connection error. Try again.");
    }
  };

  const handleSkip = () => {
    trackEvent("email_gate_skipped");
    localStorage.setItem("offo_email_gate_skipped", String(Date.now()));
    onSkip();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleSkip();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6"
        >
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {state === "success" ? (
            <div className="text-center py-4">
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">You&apos;re all set!</p>
            </div>
          ) : (
            <>
              {/* Icon + heading */}
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900">
                  Get your checklist by email
                </h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {vehicleSummary
                  ? `We'll send the inspection checklist for your ${vehicleSummary} straight to your inbox.`
                  : "We'll send the inspection checklist straight to your inbox."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="your@email.com"
                  autoFocus
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={state === "submitting"}
                />

                {errorMsg && (
                  <p className="text-xs text-red-500">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={state === "submitting" || !email.trim()}
                  className="w-full py-3 rounded-xl font-medium text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {state === "submitting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send me my checklist"
                  )}
                </button>
              </form>

              <button
                onClick={handleSkip}
                className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Skip for now
              </button>

              <p className="text-xs text-gray-300 text-center mt-2">
                No spam. Unsubscribe anytime.
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
