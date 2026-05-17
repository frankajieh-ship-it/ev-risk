/**
 * Password Reset Page
 *
 * Sends a password reset email via Supabase.
 * Linked from the login page "Forgot password?" link.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Loader2, Check } from "lucide-react";
import { sendPasswordReset } from "@/lib/supabase-auth";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function ResetPasswordPage() {
  const { trackEvent } = useEventTracking();
  useEffect(() => { trackEvent("auth_reset_password_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await sendPasswordReset(email);
    setLoading(false);

    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || "Failed to send reset email. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Link
          href="/auth/login"
          className="text-sm text-white/40 hover:text-white/70 flex items-center gap-1 mb-8 justify-center transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to sign in
        </Link>

        <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-[#00d97e]" />
              </div>
              <h2 className="text-lg font-semibold text-white">Check your email</h2>
              <p className="text-sm text-white/40 mt-2">
                We sent a reset link to <span className="text-white/70">{email}</span>. Click the link to set a new password.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="mt-6 text-sm text-[#00d97e]/70 hover:text-[#00d97e] transition-colors"
              >
                Try a different email
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-white text-center mb-1">Reset your password</h2>
              <p className="text-sm text-white/40 text-center mb-6">
                Enter your email and we&apos;ll send a reset link
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
                  />
                </div>

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#00c970]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
