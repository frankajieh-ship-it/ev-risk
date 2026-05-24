"use client";

/**
 * Dealer Provisioning Confirm Page — /dealers/join/confirm
 *
 * Step 2 of 2: user lands here after clicking the magic link in their email.
 * Reads signup data from localStorage, calls /api/dealer/provision to create
 * the dealership, then redirects to /dealer workspace.
 *
 * If localStorage data is gone (different device/browser), shows a form
 * so the dealer can complete provisioning manually.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, AlertCircle, Building } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";
import { getAttributionForEvent } from "@/lib/attribution";

type Status = "waiting_auth" | "provisioning" | "done" | "error" | "needs_input";

interface PendingData {
  dealership_name: string;
  contact_name: string;
  phone: string;
  city: string;
  state: string;
  zip: string;
  website?: string;
  inventory_size?: string;
  ev_focus?: string;
}

export default function DealerConfirmPage() {
  const { session, isLoading, isAuthenticated, isDealer, isReady } = useAuth();
  const router = useRouter();
  const { trackEvent } = useEventTracking();
  const [status, setStatus] = useState<Status>("waiting_auth");
  const [errorMsg, setErrorMsg] = useState("");

  // Manual input fallback (if localStorage data is missing)
  const [manualName, setManualName] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const provision = async (data: PendingData, token: string) => {
    setStatus("provisioning");
    const attribution = getAttributionForEvent();
    const referral_source = attribution?.utm_source || attribution?.page_source || attribution?.referrer || null;
    try {
      const res = await fetch("/api/dealer/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...data, referral_source }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Provisioning failed");
        setStatus("error");
        trackEvent("dealer_signup_provision_failed", { error: json.error });
        return;
      }
      // Clear stashed data
      try { localStorage.removeItem("dealer_signup_pending"); } catch {}
      trackEvent("dealer_signup_completed");
      setStatus("done");
      // Reload session so role metadata propagates, then redirect
      setTimeout(() => {
        window.location.href = "/dealer";
      }, 1800);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      setErrorMsg(msg);
      setStatus("error");
      trackEvent("dealer_signup_provision_failed", { error: msg });
    }
  };

  useEffect(() => {
    if (isLoading || !isReady) return;

    // Not authenticated yet — shouldn't normally happen (auth callback redirects here)
    if (!isAuthenticated || !session?.access_token) {
      router.replace("/auth/login?redirect=/dealers/join/confirm");
      return;
    }

    // Already a dealer — nothing to do
    if (isDealer) {
      router.replace("/dealer");
      return;
    }

    // Try to read stashed signup data
    let pending: PendingData | null = null;
    try {
      const raw = localStorage.getItem("dealer_signup_pending");
      if (raw) pending = JSON.parse(raw);
    } catch {}

    if (pending?.dealership_name) {
      provision(pending, session.access_token);
    } else {
      // No stashed data — ask for dealership name manually
      setStatus("needs_input");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isReady, isAuthenticated, isDealer, session?.access_token]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !session?.access_token) return;
    setManualSubmitting(true);
    await provision(
      { dealership_name: manualName.trim(), contact_name: "", phone: "", city: "", state: "", zip: "" },
      session.access_token
    );
    setManualSubmitting(false);
  };

  // ── UI ──────────────────────────────────────────────────────────────────

  if (status === "waiting_auth" || isLoading) {
    return <Centered><Loader2 className="w-8 h-8 animate-spin text-green-600" /></Centered>;
  }

  if (status === "provisioning") {
    return (
      <Centered>
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-4" />
        <p className="text-sm text-gray-600 font-medium">Setting up your dealer account…</p>
      </Centered>
    );
  }

  if (status === "done") {
    return (
      <Centered>
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <Check className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">You&apos;re all set!</h2>
        <p className="text-sm text-gray-500">Taking you to your dealer workspace…</p>
      </Centered>
    );
  }

  if (status === "error") {
    return (
      <Centered>
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-4">{errorMsg}</p>
        <button
          onClick={() => router.push("/dealers/join")}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          Try again
        </button>
      </Centered>
    );
  }

  // needs_input — stashed data missing (different browser/device)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center shrink-0">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Almost there!</h2>
              <p className="text-xs text-gray-500">Just confirm your dealership name to finish setup.</p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Dealership Name <span className="text-red-500">*</span>
              </label>
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Green Motors EV"
                required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={manualSubmitting || !manualName.trim()}
              className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {manualSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {manualSubmitting ? "Creating account…" : "Finish Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-center">{children}</div>
    </div>
  );
}
