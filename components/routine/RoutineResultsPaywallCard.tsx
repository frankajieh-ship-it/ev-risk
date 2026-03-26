/**
 * RoutineResultsPaywallCard — $4.99 paywall for EVRoutine fit results
 *
 * Shows a static demo preview of what the result looks like,
 * then prompts the user to pay $4.99 to unlock their personalized result.
 */

"use client";

import { useEffect, useState } from "react";
import { Lock, Zap, AlertTriangle, MapPin, Car, Loader2, CheckCircle } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

interface RoutineResultsPaywallCardProps {
  runId: string;
  receiptToken: string;
  scenarioType?: "routine" | "evroutine";
}

// Static demo values — NOT the user's real data
const DEMO_VERDICT = { label: "Great Fit", score: 84, color: "bg-green-100 text-green-800 border-green-200" };
const DEMO_BREAKPOINT = "Home charging dependency — 3 nights/week overnight charging";
const DEMO_STRESS_FLAG = "Moderate · Range anxiety on 65+ mi days";
const DEMO_CHARGING = "B · 8 chargers within 5 mi";

export default function RoutineResultsPaywallCard({ runId, receiptToken, scenarioType = "routine" }: RoutineResultsPaywallCardProps) {
  const { trackEvent } = useEventTracking();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackEvent("paywall_shown", {
      run_id: runId,
      offer_type: "routine_results_499",
      page_source: "routine_results_paywall",
    });
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnlock = async () => {
    setCheckingOut(true);
    setError(null);

    trackEvent("checkout_started", {
      run_id: runId,
      pack_tier: "seller_questions",
      display_price: "$4.99",
      page_source: "routine_results_paywall",
    });

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_type: scenarioType,
          scenario_id: runId,
          anon_id: receiptToken,
          page_source: "routine_results_paywall",
          pack_tier: "seller_questions",
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.status === "paid") {
        window.location.reload();
        return;
      }

      setError(data.error || "Checkout failed. Please try again.");
      trackEvent("checkout_failed", {
        run_id: runId,
        pack_tier: "seller_questions",
        error: data.error || "unknown",
        page_source: "routine_results_paywall",
      });
    } catch (err) {
      setError("Connection error. Please try again.");
      trackEvent("checkout_failed", {
        run_id: runId,
        pack_tier: "seller_questions",
        error: err instanceof Error ? err.message : "connection_error",
        page_source: "routine_results_paywall",
      });
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo preview — blurred, lock overlay */}
      <div className="relative rounded-2xl border border-gray-200 overflow-hidden">
        {/* Lock overlay */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Your result is ready — unlock it below</p>
          </div>
        </div>

        {/* Blurred demo content */}
        <div className="p-5 space-y-4 select-none pointer-events-none">
          {/* Verdict */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${DEMO_VERDICT.color}`}>
              {DEMO_VERDICT.label}
            </span>
            <span className="text-2xl font-bold text-gray-900">{DEMO_VERDICT.score}/100</span>
          </div>

          {/* Breakpoint */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <Zap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800 mb-0.5">What breaks first</p>
              <p className="text-sm text-amber-700">{DEMO_BREAKPOINT}</p>
            </div>
          </div>

          {/* Stress flag */}
          <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <p className="text-sm text-orange-800">{DEMO_STRESS_FLAG}</p>
          </div>

          {/* Charging grade */}
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-sm text-blue-800">Charging: {DEMO_CHARGING}</p>
          </div>
        </div>
      </div>

      {/* Paywall card */}
      <div className="rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-900">Your EVFit result is ready</h3>
          <span className="text-sm font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
            $4.99 one-time
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          See your fit verdict, what breaks first, stress flags, and charging grade — personalized to your routine.
        </p>

        {/* Benefits */}
        <ul className="space-y-2 mb-5">
          {[
            "Fit verdict with score (Great / Good / Mixed / High Friction)",
            "What breaks first for your specific drive pattern",
            "Stress flags ranked by severity",
            "Charging grade for your ZIP code",
            "Plan B vehicle if this one doesn't fit",
          ].map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              {b}
            </li>
          ))}
        </ul>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={checkingOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-60"
        >
          {checkingOut ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to payment...</>
          ) : (
            <><Car className="w-4 h-4" /> Unlock My Result — $4.99</>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">
          One-time payment · No subscription · Instant access
        </p>
      </div>
    </div>
  );
}
