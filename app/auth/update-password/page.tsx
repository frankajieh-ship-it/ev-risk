/**
 * Update Password Page
 *
 * Handles the password reset link callback from Supabase.
 * Supabase fires PASSWORD_RECOVERY event after token exchange.
 * User sets a new password here, then redirects to /workspace.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Loader2, Check, Eye, EyeOff } from "lucide-react";
import { getSupabaseAuthClient, updatePassword } from "@/lib/supabase-auth";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [canUpdate, setCanUpdate] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Supabase exchanges the recovery token automatically (detectSessionInUrl: true)
  // and fires PASSWORD_RECOVERY when ready
  useEffect(() => {
    const supabase = getSupabaseAuthClient();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setCanUpdate(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || "Failed to update password. Please request a new reset link.");
      return;
    }

    setDone(true);
    setTimeout(() => router.replace("/workspace"), 2000);
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#00d97e]/10 border border-[#00d97e]/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-[#00d97e]" />
            </div>
            <h2 className="text-lg font-semibold text-white">Password updated</h2>
            <p className="text-sm text-white/40 mt-2">Redirecting you to your workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canUpdate) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#00d97e] mx-auto mb-4" />
            <p className="text-sm text-white/40">Verifying reset link…</p>
            <p className="text-xs text-white/20 mt-4">
              Link expired?{" "}
              <Link href="/auth/reset-password" className="text-[#00d97e] hover:text-[#00c970] transition-colors">
                Request a new one →
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] p-6">
          <h2 className="text-lg font-semibold text-white text-center mb-1">Set new password</h2>
          <p className="text-sm text-white/40 text-center mb-6">Choose a strong password for your account</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full py-2.5 bg-[#00d97e] text-[#0d1117] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#00c970]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
