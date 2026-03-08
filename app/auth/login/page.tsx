/**
 * Auth Login Page
 *
 * Magic link login form. Redirects to workspace after authentication.
 * Supports ?redirect= query param for post-login navigation.
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function LoginForm() {
  const { login, isAuthenticated, isReady, role, isDealer } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/workspace";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Store redirect destination so callback page knows where to go
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_redirect", redirect);
    }

    const result = await login(email);
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
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
        <p className="text-sm text-gray-500 mt-2">
          We sent a login link to <strong>{email}</strong>. Click the link to sign in.
        </p>
        <button
          onClick={() => { setSent(false); setEmail(""); }}
          className="mt-6 text-sm text-blue-600 hover:text-blue-700"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Sign in to OFFO</h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter your email to receive a magic link
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Sending..." : "Send Magic Link"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-8 justify-center">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to OFFO
        </Link>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <Suspense fallback={
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          }>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
