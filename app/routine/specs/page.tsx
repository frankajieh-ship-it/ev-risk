"use client";

/**
 * /routine/specs — Optional specs & accessories questionnaire
 *
 * Reads run_id from URL. On submit, saves VehicleSpecsPrefs to localStorage
 * and navigates back to /routine/results?run_id=...
 */

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SpecsQuestionnaire from "@/components/SpecsQuestionnaire";
import { saveSpecsPrefs } from "@/lib/specs-scorer";
import type { VehicleSpecsPrefs } from "@/types/v2";

function SpecsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const runId = searchParams.get("run_id") ?? "";

  const handleSubmit = (prefs: VehicleSpecsPrefs) => {
    if (runId) {
      saveSpecsPrefs(runId, prefs);
    }
    router.push(`/routine/results?run_id=${runId}`);
  };

  const handleSkip = () => {
    router.push(`/routine/results?run_id=${runId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <SpecsQuestionnaire onSubmit={handleSubmit} onSkip={handleSkip} />
    </div>
  );
}

export default function SpecsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SpecsPageInner />
    </Suspense>
  );
}
