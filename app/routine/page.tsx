"use client";

/**
 * /routine — EVRoutine V2 Intake Page
 *
 * Shows scenario history + intake form (or paywall if 3-free limit reached).
 * On submit:
 * 1. POST /api/routine/profile to save profile
 * 2. POST /api/routine/run with routine data
 * 3. Cache run result in localStorage
 * 4. Navigate to /routine/results?run_id={id}
 *
 * Handles checkout return from Stripe payment.
 */

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import RoutineStepV2 from "@/components/RoutineStepV2";
import RoutineHistoryList, { type RoutineHistoryEntry } from "@/components/RoutineHistoryList";
import RoutinePaywallCard from "@/components/RoutinePaywallCard";
import { useEventTracking } from "@/hooks/useEventTracking";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { getOrCreatePersistentSessionId, getOrCreateReceiptToken } from "@/lib/session-utils";
import type { RoutineProfile } from "@/types/routine-v2";
import { MATCHMAKER_COPY } from "@/lib/copy/matchmaker";

type ProfileData = Omit<RoutineProfile, "id" | "created_at" | "updated_at">;

const FREE_LIMIT = 3;

function RoutinePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { trackEvent, trackRoutineFormCompleted } = useEventTracking();

  // Session tokens
  const [persistentId, setPersistentId] = useState("");
  const [receiptToken, setReceiptToken] = useState("");

  // History state
  const [history, setHistory] = useState<RoutineHistoryEntry[]>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Form state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Checkout return state
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const isUnlockedRef = useRef(false);

  // Payment status — use oldest run ID as scenario anchor
  const oldestRunId = history.length > 0 ? history[history.length - 1].id : null;
  const shouldCheckPayment = totalRuns >= FREE_LIMIT && !!receiptToken && !!oldestRunId;
  const {
    isUnlocked,
    paymentsEnabled,
    refetch: refetchPayment,
  } = usePaymentStatus(
    "routine",
    shouldCheckPayment ? oldestRunId : "skip",
    receiptToken || "skip"
  );

  // Keep ref in sync for polling
  useEffect(() => {
    isUnlockedRef.current = isUnlocked;
  }, [isUnlocked]);

  // Derived
  const isOverLimit = totalRuns >= FREE_LIMIT && !isUnlocked;

  // Init tokens
  useEffect(() => {
    setPersistentId(getOrCreatePersistentSessionId() || "");
    setReceiptToken(getOrCreateReceiptToken());
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/routine/history?anon_session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.runs || []);
        setTotalRuns(data.total_count || 0);
      }
    } catch {
      // Silent fail
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!persistentId) return;
    fetchHistory(persistentId);
  }, [persistentId, fetchHistory]);

  // Checkout return polling
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    url.searchParams.delete("scenario_type");
    url.searchParams.delete("scenario_id");
    window.history.replaceState({}, "", url.pathname);

    trackEvent("routine_checkout_return", { status: "success" });

    // Poll for payment confirmation
    setIsPollingPayment(true);
    let attempts = 0;
    const maxAttempts = 15;
    const poll = setInterval(async () => {
      attempts++;
      await refetchPayment();
      if (isUnlockedRef.current || attempts >= maxAttempts) {
        clearInterval(poll);
        setIsPollingPayment(false);
        if (isUnlockedRef.current && persistentId) {
          fetchHistory(persistentId);
        }
      }
    }, 2000);

    return () => clearInterval(poll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Paywall checkout handler
  const handlePaywallCheckout = async () => {
    if (!oldestRunId || !receiptToken) return;

    trackEvent("routine_paywall_checkout_started", {
      run_count: totalRuns,
    });

    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario_type: "routine",
        scenario_id: oldestRunId,
        anon_id: receiptToken,
        page_source: "routine_page",
      }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else if (data.status === "paid") {
      // Already paid — refresh
      await refetchPayment();
    } else {
      throw new Error(data.error || "Checkout failed");
    }
  };

  // Track page load time for completion tracking
  const pageLoadTimeRef = useRef(Date.now());

  // Form submit handler
  const handleComplete = async (profile: ProfileData) => {
    setIsLoading(true);
    setError(null);

    try {
      const anonSessionId = persistentId || getOrCreatePersistentSessionId();
      if (!anonSessionId) {
        setError("Could not create session. Please try again.");
        setIsLoading(false);
        return;
      }

      trackEvent("routine_profile_started", {
        charging_access: profile.home_charging,
        has_zip: !!profile.home_location_zip,
        has_vehicle: !!profile.vehicle_profile_id,
      });

      // 1. Save profile
      const profileRes = await fetch("/api/routine/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          anon_session_id: anonSessionId,
        }),
      });

      const profileData = await profileRes.json();
      if (!profileData.success) {
        throw new Error(profileData.error || "Failed to save profile");
      }

      trackEvent("routine_profile_completed", {
        profile_id: profileData.profile_id,
      });

      // Track form completion (NEW: March 2026)
      const submissionTimeSeconds = Math.floor((Date.now() - pageLoadTimeRef.current) / 1000);
      const fieldsCompleted: string[] = [];
      if (profile.home_charging !== undefined) fieldsCompleted.push("home_charging");
      if (profile.weekly_miles || profile.commute_miles_roundtrip) fieldsCompleted.push("miles");
      if (profile.home_location_zip) fieldsCompleted.push("zip");
      if (profile.shared_charger !== undefined) fieldsCompleted.push("shared_charger");
      if (profile.climate_band) fieldsCompleted.push("climate");
      if (profile.longest_day_pattern) fieldsCompleted.push("longest_day");
      if (profile.vehicle_profile_id) fieldsCompleted.push("vehicle");

      trackRoutineFormCompleted({
        daily_miles: profile.commute_miles_roundtrip
          ? profile.commute_miles_roundtrip / 5
          : (profile.weekly_miles || 0) / 7,
        home_charging: Boolean(profile.home_charging),
        zip: profile.home_location_zip || "",
        shared_charger: Boolean(profile.shared_charger),
        submission_time_seconds: submissionTimeSeconds,
        fields_filled: fieldsCompleted,
      });

      // 2. Execute run (includes receipt_token for server-side limit check)
      const runRes = await fetch("/api/routine/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileData.profile_id,
          anon_session_id: anonSessionId,
          charging_access: profile.home_charging,
          weekly_miles: profile.weekly_miles,
          commute_miles_roundtrip: profile.commute_miles_roundtrip,
          climate: profile.climate_band,
          longest_day_pattern: profile.longest_day_pattern,
          vehicle_profile_id: profile.vehicle_profile_id,
          home_location_zip: profile.home_location_zip,
          receipt_token: receiptToken,
        }),
      });

      const runData = await runRes.json();
      if (!runData.success) {
        if (runData.error === "free_limit_reached") {
          setTotalRuns(runData.run_count ?? FREE_LIMIT);
          setError(null);
          setIsLoading(false);
          return;
        }
        throw new Error(runData.error || "Failed to run analysis");
      }

      // 3. Cache result in localStorage
      try {
        localStorage.setItem(
          `routine_run_${runData.run_id}`,
          JSON.stringify(runData)
        );
      } catch {
        // localStorage full or unavailable — continue anyway
      }

      // 4. Navigate to results
      router.push(`/routine/results?run_id=${runData.run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  // Loading spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Analyzing your routine...
          </h2>
          <p className="text-gray-500 text-sm">
            Finding what breaks first and building your Plan B
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Nav */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Landing Tagline */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            {MATCHMAKER_COPY.landing.h1}
          </h1>
          <p className="text-lg text-gray-600">
            {MATCHMAKER_COPY.landing.subtext}
          </p>
        </div>

        {/* Checkout return confirmation */}
        {isPollingPayment && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Confirming your payment...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* History list */}
        {!historyLoading && history.length > 0 && (
          <RoutineHistoryList
            runs={history}
            onSelect={(run) => router.push(`/routine/results?run_id=${run.id}`)}
            totalCount={totalRuns}
            maxFree={FREE_LIMIT}
            isUnlocked={isUnlocked}
          />
        )}

        {/* Form or Paywall */}
        {isOverLimit ? (
          <RoutinePaywallCard
            onCheckout={handlePaywallCheckout}
            runCount={totalRuns}
          />
        ) : (
          <RoutineStepV2 onComplete={handleComplete} />
        )}
      </div>
    </div>
  );
}

export default function RoutinePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RoutinePageContent />
    </Suspense>
  );
}
