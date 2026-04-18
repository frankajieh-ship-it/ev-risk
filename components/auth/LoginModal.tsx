"use client";

import { useState, useEffect } from "react";
import { Loader2, Mail, Lock, Check, X, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { signInWithGoogle, sendMagicLink, signInWithEmailPassword } from "@/lib/supabase-auth";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  redirectAfter?: string;
  headline?: string;
  subtext?: string;
}

export default function LoginModal({
  open,
  onClose,
  redirectAfter = "/workspace",
  headline = "Sign in to OFFO",
  subtext = "Create a free account to sync your garage across devices.",
}: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailMode, setEmailMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    const result = await signInWithGoogle(redirectAfter);
    if (!result.success) {
      setError(result.error || "Google sign-in failed");
      setGoogleLoading(false);
    }
  };

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signInWithEmailPassword(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || "Sign in failed. Check your email and password.");
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await sendMagicLink(email);
    setLoading(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || "Failed to send link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#161b22] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {sent ? (
          <div className="text-center py-2">
            <div className="w-10 h-10 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center mx-auto mb-3">
              <Check className="w-5 h-5 text-[#00d97e]" />
            </div>
            <p className="font-semibold text-white">Check your inbox</p>
            <p className="text-sm text-white/40 mt-1">
              We sent a link to <span className="text-white/60">{email}</span>
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-4 text-xs text-[#00d97e]/60 hover:text-[#00d97e] transition-colors"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-base font-semibold text-white mb-1">{headline}</h2>
            <p className="text-sm text-white/40 mb-5">{subtext}</p>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white text-[#0d1117] rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#0d1117]" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {/* Email — shared input */}
            <div className="relative mb-2.5">
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

            {emailMode === "password" ? (
              <form onSubmit={handleEmailPassword} className="space-y-2.5">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || googleLoading || !email || !password}
                  className="w-full py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#00c970]"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <div className="flex items-center justify-between pt-0.5">
                  <Link
                    href="/auth/reset-password"
                    onClick={onClose}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Forgot password?
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setEmailMode("magic"); setError(""); }}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Use magic link
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-2.5">
                {error && <p className="text-xs text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || googleLoading || !email}
                  className="w-full py-2.5 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] text-white/70 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {loading ? "Sending…" : "Send Magic Link"}
                </button>

                <button
                  type="button"
                  onClick={() => { setEmailMode("password"); setError(""); }}
                  className="w-full text-xs text-white/30 hover:text-white/60 transition-colors text-center"
                >
                  Use password instead
                </button>
              </form>
            )}

            {/* Sign up link */}
            <p className="text-center text-xs text-white/25 mt-4">
              No account?{" "}
              <Link
                href="/auth/signup"
                onClick={onClose}
                className="text-[#00d97e] hover:text-[#00c970] transition-colors"
              >
                Sign up free →
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
