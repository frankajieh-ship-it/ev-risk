"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Mail, Loader2, Check, AlertCircle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useTurnstile } from "@/hooks/useTurnstile";

const FEEDBACK_TYPES = [
  { value: "general", label: "General Question" },
  { value: "bug", label: "Bug Report" },
  { value: "question", label: "Question about a Vehicle" },
  { value: "feature", label: "Feature Request" },
  { value: "success_story", label: "Success Story" },
] as const;

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/">
            <Image src="/offo-logo.png" alt="OFFO" width={120} height={48} className="h-7 w-auto" />
          </Link>
          <Link href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            ← Back to OFFO
          </Link>
        </div>
      </nav>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
          </div>
        }
      >
        <ContactForm />
      </Suspense>
    </div>
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
        body.helpful = JSON.stringify({ from, receiptId, verdict });
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
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-[#00d97e]" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Thanks for reaching out</h1>
          <p className="text-sm text-white/40 mb-6">
            We&apos;ll get back to you within 24–48 hours at <span className="text-white/60">{email}</span>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-xl hover:bg-[#00c970] transition-colors"
          >
            Back to OFFO
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div id="turnstile-contact" className="hidden" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Left — info */}
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold text-white mb-2">Contact Us</h1>
          <p className="text-sm text-white/40 mb-8 leading-relaxed">
            Questions, bugs, feedback, or success stories — we read everything and reply within 24 hours.
          </p>

          <div className="space-y-6">
            {/* Create profile nudge */}
            <div className="bg-[#161b22] border border-white/[0.08] rounded-xl p-4">
              <p className="text-sm font-medium text-white/80 mb-1">Get faster support</p>
              <p className="text-xs text-white/40 mb-3 leading-relaxed">
                Create a free profile so we can link your message directly to your receipts and history — no back-and-forth needed.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00d97e] hover:text-[#00c970] transition-colors"
              >
                Create a free profile →
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { icon: "💬", label: "General questions & advice" },
                { icon: "🐛", label: "Bug or unexpected result" },
                { icon: "💡", label: "Feature requests & ideas" },
                { icon: "⭐", label: "Share a success story" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 text-sm text-white/40">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-2.5 text-sm text-white/40">
                <span>🔒</span>
                <span>Privacy inquiries — use type &ldquo;General Question&rdquo; above</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="lg:col-span-3">
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
            {isFromReceipt && (
              <div className="bg-[#00d97e]/5 border border-[#00d97e]/15 rounded-lg px-3 py-2 mb-5">
                <p className="text-xs text-[#00d97e]/70">
                  Sending feedback about a receipt result
                  {verdict && <span className="ml-1 font-medium">({verdict})</span>}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type */}
              <div>
                <label htmlFor="feedbackType" className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                  Type
                </label>
                <select
                  id="feedbackType"
                  value={feedbackType}
                  onChange={(e) => setFeedbackType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-[#00d97e]/40 transition-colors"
                >
                  {FEEDBACK_TYPES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-[#161b22]">
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Name + Email row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                    Name <span className="text-white/20 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  placeholder="Tell us what's on your mind..."
                  className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00d97e]/40 transition-colors resize-y"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-xl hover:bg-[#00c970] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>

              <p className="text-xs text-white/20 text-center">We usually reply within 24 hours.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
