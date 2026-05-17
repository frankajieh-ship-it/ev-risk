/**
 * Auth Login Page
 *
 * Dark-themed login with Google OAuth as primary CTA,
 * email+password as default email option, magic link as fallback.
 * Supports ?redirect= query param for post-login navigation.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, Loader2, Check, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle, sendMagicLink, signInWithEmailPassword } from "@/lib/supabase-auth";
import { useEventTracking } from "@/hooks/useEventTracking";

// Inline Google "G" logo
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

function LoginForm() {
  const { isAuthenticated, isReady, role, isDealer } = useAuth();
  const { trackEvent } = useEventTracking();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/workspace";

  useEffect(() => { trackEvent("auth_login_page_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailMode, setEmailMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Role-aware redirect for already-authenticated users
  useEffect(() => {
    if (isAuthenticated && isReady) {
      if (!role) router.replace("/onboarding");
      else if (isDealer) router.replace("/dealer");
      else router.replace(redirect);
    }
  }, [isAuthenticated, isReady, role, isDealer, router, redirect]);

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    const result = await signInWithGoogle(redirect);
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
    // On success Supabase fires onAuthStateChange → useAuth redirect via useEffect above
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (typeof window !== "undefined") {
      localStorage.setItem("auth_redirect", redirect);
    }

    const result = await sendMagicLink(email);
    setLoading(false);

    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || "Failed to send login link");
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-[#00d97e]" />
        </div>
        <h2 className="text-lg font-semibold text-white">Check your email</h2>
        <p className="text-sm text-white/40 mt-2">
          We sent a login link to <span className="text-white/70">{email}</span>. Click the link to sign in.
        </p>
        <button
          onClick={() => { setSent(false); setEmail(""); }}
          className="mt-6 text-sm text-[#00d97e]/70 hover:text-[#00d97e] transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white text-center mb-1">Sign in to OFFO</h2>
      <p className="text-sm text-white/40 text-center mb-6">
        Analyze EVs, track deals, and build your garage
      </p>

      {/* Google — primary CTA */}
      <button
        onClick={handleGoogle}
        disabled={googleLoading || loading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-[#0d1117] rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors disabled:opacity-60"
      >
        {googleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#0d1117]" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-xs text-white/30">or continue with email</span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      {/* Email input — shared */}
      <div className="relative mb-3">
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
        <form onSubmit={handleEmailPassword} className="space-y-3">
          {/* Password input */}
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || googleLoading || !email || !password}
            className="w-full py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#00c970]"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          {/* Forgot password + magic link toggle */}
          <div className="flex items-center justify-between pt-1">
            <Link
              href="/auth/reset-password"
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Forgot password?
            </Link>
            <button
              type="button"
              onClick={() => { setEmailMode("magic"); setError(""); }}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Use magic link instead
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-3">
          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || googleLoading || !email}
            className="w-full py-2.5 bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] text-white/80 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Sending…" : "Send Magic Link"}
          </button>

          <button
            type="button"
            onClick={() => { setEmailMode("password"); setError(""); }}
            className="w-full text-xs text-white/40 hover:text-white/70 transition-colors text-center pt-1"
          >
            Use password instead
          </button>
        </form>
      )}

      {/* Sign up link */}
      <p className="text-center text-xs text-white/30 mt-5">
        Don&apos;t have an account?{" "}
        <Link href={`/auth/signup${redirect !== "/workspace" ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} className="text-[#00d97e] hover:text-[#00c970] transition-colors">
          Sign up free →
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Link href="/" className="text-sm text-white/40 hover:text-white/70 flex items-center gap-1 mb-8 justify-center transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to OFFO
        </Link>

        <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-white/20 mt-5">
          By signing in you agree to our{" "}
          <Link href="/terms" className="underline hover:text-white/40 transition-colors">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:text-white/40 transition-colors">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
