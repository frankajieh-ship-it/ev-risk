"use client";

/**
 * Auth Callback Page
 *
 * Handles magic link authentication callback from Supabase.
 * Redirects user after successful authentication.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useEventTracking } from "@/hooks/useEventTracking";
import { getAnonGarage, clearAnonGarage } from "@/lib/anon-garage";
import type { Session } from "@supabase/supabase-js";

/** Determine where to send user after auth based on role metadata. */
function getPostAuthRedirect(session: Session | null): string {
  const stored = localStorage.getItem("auth_redirect");
  if (stored) {
    localStorage.removeItem("auth_redirect");
    return stored;
  }
  const role = session?.user?.user_metadata?.role;
  if (!role) return "/onboarding";
  if (role === "dealer_admin" || role === "dealer_user") return "/dealer";
  return "/workspace";
}

/** Fire-and-forget: push anonymous garage items to server after login. */
async function syncAnonGarageToServer(token: string) {
  try {
    const items = getAnonGarage();
    if (items.length === 0) return;
    await fetch("/api/workspace/garage/sync-anon", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items }),
    });
    clearAnonGarage();
  } catch {
    // Non-critical — items remain in localStorage for next login
  }
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trackEmailConfirmed, trackEvent } = useEventTracking();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [hasTracked, setHasTracked] = useState(false);

  // Track email confirmed event (only once)
  const trackAuthSuccess = useCallback((userId?: string) => {
    if (!hasTracked) {
      trackEmailConfirmed(userId);
      setHasTracked(true);
    }
  }, [hasTracked, trackEmailConfirmed]);

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = getSupabaseAuthClient();

      if (!supabase) {
        setStatus("error");
        setError("Authentication not configured");
        return;
      }

      // Check for hash fragment (magic link auth uses this)
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        // Supabase client automatically detects and processes hash fragments
        // when detectSessionInUrl is true (which it is)
        // Wait for the auth state to update
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          setStatus("error");
          setError(sessionError.message);
          return;
        }

        if (session) {
          console.log("[Auth Callback] Session found from hash:", session.user?.email);

          // Persist user_id for event tracking attribution
          if (session.user?.id) {
            try {
              localStorage.setItem("offo_user_id", session.user.id);
              trackEvent("attach_anon", {
                user_id: session.user.id,
                persistent_session_id: localStorage.getItem("offo_persistent_session") || undefined,
              });
            } catch {}
            // Sync anonymous garage items to server (fire-and-forget)
            syncAnonGarageToServer(session.access_token);
          }

          trackAuthSuccess(session.user?.id);
          setStatus("success");

          const redirectTo = getPostAuthRedirect(session);
          setTimeout(() => {
            router.push(redirectTo);
          }, 1500);
          return;
        }
      }

      // Get the code from URL (Supabase PKCE flow)
      const code = searchParams.get("code");

      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }

          // Get session to track user ID
          const { data: { session: newSession } } = await supabase.auth.getSession();
          if (newSession?.user?.id) {
            try {
              localStorage.setItem("offo_user_id", newSession.user.id);
              trackEvent("attach_anon", {
                user_id: newSession.user.id,
                persistent_session_id: localStorage.getItem("offo_persistent_session") || undefined,
              });
            } catch {}
            // Sync anonymous garage items to server (fire-and-forget)
            syncAnonGarageToServer(newSession.access_token);
            trackAuthSuccess(newSession.user.id);
          }

          setStatus("success");

          const redirectTo = getPostAuthRedirect(newSession);
          setTimeout(() => {
            router.push(redirectTo);
          }, 1500);
        } catch (err) {
          console.error("Auth callback error:", err);
          setStatus("error");
          setError(err instanceof Error ? err.message : "Authentication failed");
        }
      } else {
        // No code, check for error in URL
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (errorParam) {
          setStatus("error");
          setError(errorDescription || errorParam);
        } else {
          // Wait a moment for Supabase to process any hash fragments
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            console.log("[Auth Callback] Session found after wait:", session.user?.email);
            if (session.user?.id) {
              try {
                localStorage.setItem("offo_user_id", session.user.id);
                trackEvent("attach_anon", {
                  user_id: session.user.id,
                  persistent_session_id: localStorage.getItem("offo_persistent_session") || undefined,
                });
              } catch {}
              // Sync anonymous garage items to server (fire-and-forget)
              syncAnonGarageToServer(session.access_token);
            }
            trackAuthSuccess(session.user?.id);
            setStatus("success");
            const redirectTo = getPostAuthRedirect(session);
            setTimeout(() => {
              router.push(redirectTo);
            }, 1500);
          } else {
            // No session found
            console.log("[Auth Callback] No session found, redirecting to login");
            router.push("/auth/login");
          }
        }
      }
    };

    handleCallback();
  }, [router, searchParams, trackAuthSuccess]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d1117] px-4">
      <Link href="/" className="mb-8">
        <Image src="/offo-logo.png" alt="OFFO" width={120} height={48} className="h-8 w-auto" />
      </Link>
      <div className="max-w-sm w-full">
        <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-8 text-center">
          {status === "loading" && (
            <>
              <div className="w-14 h-14 mx-auto mb-5">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-white/[0.08] border-t-[#00d97e]" />
              </div>
              <h1 className="text-lg font-semibold text-white mb-1">Signing you in…</h1>
              <p className="text-sm text-white/40">Please wait while we verify your login.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-14 h-14 mx-auto mb-5 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-[#00d97e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-white mb-1">Welcome back!</h1>
              <p className="text-sm text-white/40">You&apos;re signed in. Redirecting…</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 mx-auto mb-5 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-white mb-1">Sign in failed</h1>
              <p className="text-sm text-white/40 mb-5">{error || "Something went wrong. Please try again."}</p>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-xl hover:bg-[#00c970] transition-colors"
              >
                Go to Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/[0.08] border-t-[#00d97e]" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
