/**
 * Auth Signup Page
 *
 * Email + password account creation with display name.
 * Google OAuth as alternative. Redirects to /onboarding on success.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Mail, Lock, User, Loader2, Check, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle, signUpWithEmailPassword } from "@/lib/supabase-auth";
import { useEventTracking } from "@/hooks/useEventTracking";

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

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Contains a number", ok: /\d/.test(password) },
    { label: "Contains a letter", ok: /[a-zA-Z]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const bar = ["bg-red-500", "bg-yellow-500", "bg-yellow-400", "bg-[#00d97e]"][score];

  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? bar : "bg-white/[0.08]"}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {checks.map((c) => (
          <span key={c.label} className={`text-[10px] flex items-center gap-1 ${c.ok ? "text-[#00d97e]" : "text-white/30"}`}>
            <span>{c.ok ? "✓" : "·"}</span> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg: string | undefined }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {msg}
    </p>
  );
}

function SignupForm() {
  const { isAuthenticated, isReady, role, isDealer } = useAuth();
  const { trackEvent } = useEventTracking();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/workspace";

  useEffect(() => { trackEvent("auth_signup_page_viewed", {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Field-level errors (shown after first submit attempt)
  const [touched, setTouched] = useState(false);
  const nameError = touched && !displayName.trim() ? "Name is required" : undefined;
  const emailError = touched && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Enter a valid email address" : undefined;
  const passwordError = touched && password && password.length < 8 ? "Must be at least 8 characters" : undefined;
  const confirmError = touched && confirmPassword && confirmPassword !== password ? "Passwords don't match" : undefined;

  // Redirect already-authenticated users
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
    try {
      const result = await signInWithGoogle(redirect);
      if (!result.success) {
        setError(result.error || "Google sign-in failed. Please try again.");
        setGoogleLoading(false);
      }
      // On success, browser navigates away — no need to reset loading
    } catch {
      setError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError("");

    if (!displayName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const result = await signUpWithEmailPassword(email, password, displayName.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Sign up failed. Please try again.");
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-[#00d97e]" />
        </div>
        <h2 className="text-lg font-semibold text-white">Check your email</h2>
        <p className="text-sm text-white/40 mt-2">
          We sent a confirmation link to <span className="text-white/70">{email}</span>. Click it to activate your account.
        </p>
        <p className="text-xs text-white/30 mt-4">
          Already confirmed?{" "}
          <Link href="/auth/login" className="text-[#00d97e] hover:text-[#00c970] transition-colors">
            Sign in →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white text-center mb-1">Create your account</h2>
      <p className="text-sm text-white/40 text-center mb-6">
        Free forever · No credit card needed
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
        {googleLoading ? "Opening Google…" : "Continue with Google"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-xs text-white/30">or sign up with email</span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      <form onSubmit={handleSignup} noValidate className="space-y-3">
        {/* Display name */}
        <div>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              className={`w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${nameError ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.08] focus:border-[#00d97e]/40"}`}
            />
          </div>
          <FieldError msg={nameError} />
        </div>

        {/* Email */}
        <div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${emailError ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.08] focus:border-[#00d97e]/40"}`}
            />
          </div>
          <FieldError msg={emailError} />
        </div>

        {/* Password */}
        <div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full pl-9 pr-10 py-2.5 bg-white/[0.04] border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${passwordError ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.08] focus:border-[#00d97e]/40"}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
          <FieldError msg={passwordError} />
        </div>

        {/* Confirm password */}
        <div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border rounded-xl text-sm text-white placeholder-white/30 focus:outline-none transition-colors ${confirmError ? "border-red-500/50 focus:border-red-500/70" : "border-white/[0.08] focus:border-[#00d97e]/40"}`}
            />
          </div>
          <FieldError msg={confirmError} />
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#00c970]"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-xs text-white/30 mt-5">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-[#00d97e] hover:text-[#00c970] transition-colors">
          Sign in →
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image src="/offo-logo.png" alt="OFFO" width={120} height={48} className="h-8 w-auto" />
          </Link>
        </div>

        <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
            </div>
          }>
            <SignupForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-white/20 mt-5">
          By signing up you agree to our{" "}
          <Link href="/terms" className="underline hover:text-white/40 transition-colors">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:text-white/40 transition-colors">Privacy Policy</Link>
        </p>

        <div className="flex justify-center mt-4">
          <Link href="/" className="text-xs text-white/30 hover:text-white/50 flex items-center gap-1 transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Back to OFFO
          </Link>
        </div>
      </div>
    </div>
  );
}
