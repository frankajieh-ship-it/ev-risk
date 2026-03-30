"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useTurnstile } from "@/hooks/useTurnstile";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug Report" },
  { value: "question", label: "Question" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General Feedback" },
  { value: "success_story", label: "Success Story" },
] as const;

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
      }
    >
      <ContactForm />
    </Suspense>
  );
}

function ContactForm() {
  const searchParams = useSearchParams();
  const { trackEvent } = useEventTracking();

  const from = searchParams.get("from");
  const receiptId = searchParams.get("receiptId");
  const verdict = searchParams.get("verdict");
  const isFromReceipt = from === "receipt";

  const { execute: executeTurnstile } = useTurnstile({
    containerId: "turnstile-contact",
    action: "contact-submit",
  });

  const [feedbackType, setFeedbackType] = useState("general");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    trackEvent("contact_page_viewed", {
      from: from || "direct",
      receipt_id: receiptId || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const turnstileToken = await executeTurnstile();

      const body: Record<string, unknown> = {
        feedbackType,
        email,
        comments: message,
        additionalData: name || null,
        turnstileToken: turnstileToken || undefined,
        leave_this_empty: "",
      };

      if (isFromReceipt) {
        body.helpful = JSON.stringify({
          from,
          receiptId,
          verdict,
        });
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to submit feedback");
      }

      trackEvent("contact_form_submitted", {
        feedback_type: feedbackType,
        from: from || "direct",
        receipt_id: receiptId || undefined,
      });

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Thanks for reaching out
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            We&apos;ll get back to you within 24-48 hours.
          </p>
          <Link
            href="/receipt"
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to OFFO
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div id="turnstile-contact" className="hidden" />
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link
            href="/receipt"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            &larr; Back to OFFO
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Contact / Feedback
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Questions, bugs, feedback, or success stories — we read everything.
          </p>

          {isFromReceipt && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-6">
              <p className="text-xs text-indigo-700">
                You&apos;re sending feedback about a receipt result
                {verdict && (
                  <span className="ml-1 font-medium">({verdict})</span>
                )}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type */}
            <div>
              <label
                htmlFor="feedbackType"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Type <span className="text-red-400">*</span>
              </label>
              <select
                id="feedbackType"
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                {FEEDBACK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                placeholder="Tell us what's on your mind..."
              />
            </div>

            {/* Name (optional) */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending..." : "Send Message"}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-5 text-center">
            We usually reply within 24-48 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
