"use client";

/**
 * /routine — EVRoutine V2 Intake Page
 *
 * Shows RoutineStepV2 form. On submit:
 * 1. POST /api/routine/profile to save profile
 * 2. POST /api/routine/run with routine data
 * 3. Cache run result in localStorage
 * 4. Navigate to /routine/results?run_id={id}
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import RoutineStepV2 from "@/components/RoutineStepV2";
import { useEventTracking } from "@/hooks/useEventTracking";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";
import type { RoutineProfile } from "@/types/routine-v2";

type ProfileData = Omit<RoutineProfile, "id" | "created_at" | "updated_at">;

export default function RoutinePage() {
  const router = useRouter();
  const { trackEvent } = useEventTracking();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (profile: ProfileData) => {
    setIsLoading(true);
    setError(null);

    try {
      const anonSessionId = getOrCreatePersistentSessionId();
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

      // 2. Execute run
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
        }),
      });

      const runData = await runRes.json();
      if (!runData.success) {
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
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}
        <RoutineStepV2 onComplete={handleComplete} />
      </div>
    </div>
  );
}
