/**
 * EmailCaptureCard — Lightweight email capture after receipt generation
 *
 * Shows a small card with email input, submit button, and success state.
 * Stores email in Supabase with attribution context.
 */

"use client";

import { useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { getAttributionForEvent } from "@/lib/attribution";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";

interface EmailCaptureCardProps {
  onSubmit?: () => void;
}

export default function EmailCaptureCard({ onSubmit }: EmailCaptureCardProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    try {
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
        onSubmit?.();
      } else {
        setStatus("error");
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
          You are on the list.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-medium text-gray-700 mb-2">
        Get the next version of this checklist free.
      </p>
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
      <p className="text-xs text-gray-400 mt-1.5">One email. No spam.</p>
      {status === "error" && (
        <p className="text-xs text-red-500 mt-1">
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
