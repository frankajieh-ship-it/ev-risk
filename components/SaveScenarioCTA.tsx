"use client";

/**
 * SaveScenarioCTA Component
 *
 * "Save This Scenario" call-to-action button shown after results.
 * Triggers login modal if not authenticated, then saves the scenario.
 */

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";
import { generateScenarioFingerprint } from "@/lib/scenario-fingerprint";

interface SaveScenarioCTAProps {
  sessionId: string | null;
  vehicleModel: string;
  vehicleYear: number;
  fitSignal?: string;
  oneSentenceVerdict?: string;
  inputs: {
    model?: string;
    year?: number;
    zipCode?: string;
    dailyMiles?: number;
    homeCharging?: boolean;
    riskTolerance?: string;
    constraintMultiplier?: number;
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SaveScenarioCTA({
  sessionId,
  vehicleModel,
  vehicleYear,
  fitSignal,
  oneSentenceVerdict,
  inputs,
}: SaveScenarioCTAProps) {
  const { isAuthenticated, session, isConfigured } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Don't render if auth not configured
  if (!isConfigured) {
    return null;
  }

  const handleSave = async () => {
    if (!isAuthenticated || !session?.access_token) {
      setShowLoginModal(true);
      return;
    }

    setSaveState("saving");
    setError(null);

    try {
      // Generate scenario hash
      const scenarioHash = generateScenarioFingerprint({
        model: inputs.model || vehicleModel,
        year: inputs.year || vehicleYear,
        dailyMiles: inputs.dailyMiles || 30,
        zipCode: inputs.zipCode || "00000",
        homeCharging: inputs.homeCharging ?? true,
        riskTolerance: inputs.riskTolerance || "moderate",
        constraintMultiplier: inputs.constraintMultiplier,
      });

      const response = await fetch("/api/user/scenario/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          scenario_hash: scenarioHash,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear,
          fit_signal: fitSignal,
          one_sentence_verdict: oneSentenceVerdict,
          inputs,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save scenario");
      }

      setSaveState("saved");
    } catch (err) {
      console.error("Save scenario error:", err);
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleLoginSuccess = () => {
    // After login, trigger save
    // Note: User needs to click save again after auth completes
    setShowLoginModal(false);
  };

  return (
    <>
      <div className="mt-6">
        {saveState === "idle" && (
          <button
            onClick={handleSave}
            className="flex items-center justify-center w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors group"
          >
            <svg
              className="w-5 h-5 mr-2 text-indigo-600 group-hover:scale-110 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span className="font-medium text-indigo-700">
              {isAuthenticated ? "Save This Scenario" : "Sign in to Save This Scenario"}
            </span>
          </button>
        )}

        {saveState === "saving" && (
          <div className="flex items-center justify-center w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-200 border-t-indigo-600 mr-2"></div>
            <span className="text-gray-600">Saving...</span>
          </div>
        )}

        {saveState === "saved" && (
          <div className="flex items-center justify-center w-full px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-700 font-medium">Scenario Saved!</span>
          </div>
        )}

        {saveState === "error" && (
          <div className="w-full">
            <div className="flex items-center justify-center px-4 py-3 bg-red-50 border border-red-200 rounded-lg mb-2">
              <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-red-700">{error || "Failed to save"}</span>
            </div>
            <button
              onClick={() => {
                setSaveState("idle");
                setError(null);
              }}
              className="text-sm text-indigo-600 hover:text-indigo-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {!isAuthenticated && saveState === "idle" && (
          <p className="mt-2 text-xs text-gray-500 text-center">
            Save scenarios to compare later and track your EV search
          </p>
        )}
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        redirectPath={typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined}
      />
    </>
  );
}
