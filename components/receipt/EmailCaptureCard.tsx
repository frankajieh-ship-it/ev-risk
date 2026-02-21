/**
 * EmailCaptureCard — Email checklist delivery after receipt generation
 *
 * Sends the receipt checklist (verdict, risk flags, must-ask questions,
 * negotiation opener) to the user's email via /api/email/checklist.
 * Falls back to capture-only mode if no receiptId is provided.
 */

"use client";

import { useState, useEffect } from "react";
import { CheckCircle, Loader2, Mail } from "lucide-react";
import { getAttributionForEvent } from "@/lib/attribution";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";
import { useEventTracking } from "@/hooks/useEventTracking";

interface EmailCaptureCardProps {
  receiptId?: string;
  onSubmit?: () => void;
}

export default function EmailCaptureCard({ receiptId, onSubmit }: EmailCaptureCardProps) {
  const { trackEvent } = useEventTracking();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track shown on mount
  useEffect(() => {
    trackEvent("email_capture_shown", { receipt_id: receiptId });
  }, [receiptId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    setErrorMsg(null);

    try {
      if (receiptId) {
        // Send the actual checklist email
        const res = await fetch("/api/email/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            receipt_id: receiptId,
            anon_id: getOrCreatePersistentSessionId(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
          trackEvent("email_capture_submitted", { receipt_id: receiptId });
          onSubmit?.();
        } else {
          setErrorMsg(data.error || "Failed to send. Try again.");
          setStatus("error");
        }
      } else {
        // Fallback: capture email only (no receipt to email)
        const res = await fetch("/api/checklist/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            attribution: getAttributionForEvent(),
            persistent_session_id: getOrCreatePersistentSessionId(),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
          trackEvent("email_capture_submitted", { receipt_id: receiptId });
          onSubmit?.();
        } else {
          setStatus("error");
        }
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-2" />
        <p className="text-sm text-green-700 font-medium">
          {receiptId ? "Check your inbox!" : "You are on the list."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="w-4 h-4 text-blue-600" />
        <p className="text-sm font-medium text-gray-700">
          {receiptId ? "Email me this checklist" : "Get the next version of this checklist free."}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {status === "submitting" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Send"
          )}
        </button>
      </form>
      <p className="text-xs text-gray-400 mt-1.5">
        {receiptId ? "Verdict, risk flags, and checklist — straight to your inbox." : "One email. No spam."}
      </p>
      {status === "error" && (
        <p className="text-xs text-red-500 mt-1">
          {errorMsg || "Something went wrong. Try again."}
        </p>
      )}
    </div>
  );
}
