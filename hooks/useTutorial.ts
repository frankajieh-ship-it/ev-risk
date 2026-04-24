"use client";

import { useState, useEffect, useCallback } from "react";
import { TUTORIAL_STEPS } from "@/components/tutorial/steps";
import { useEventTracking } from "@/hooks/useEventTracking";

const DISMISSED_KEY = "offo_tutorial_dismissed";
const STEP_KEY = "offo_tutorial_step";

export function useTutorial() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const { trackEvent } = useEventTracking();

  useEffect(() => {
    // Defer all state updates to avoid synchronous setState-in-effect lint error.
    // This is the standard pattern for hydration-guard + first-mount side effects.
    const timer = setTimeout(() => {
      setMounted(true);
      try {
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (!dismissed) {
          const savedStep = localStorage.getItem(STEP_KEY);
          const startStep = savedStep ? Number(savedStep) : 0;
          setStep(startStep);
          setActive(true);
          if (!savedStep) {
            trackEvent("tutorial_started", { total_steps: TUTORIAL_STEPS.length });
          }
        }
      } catch {
        // localStorage unavailable (SSR, private browsing) — skip tutorial
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    const nextStep = step + 1;
    if (nextStep >= TUTORIAL_STEPS.length) {
      // Completed all steps
      setActive(false);
      try {
        localStorage.setItem(DISMISSED_KEY, "completed");
        localStorage.removeItem(STEP_KEY);
      } catch {}
      trackEvent("tutorial_completed", { total_steps: TUTORIAL_STEPS.length });
      return;
    }
    setStep(nextStep);
    try {
      localStorage.setItem(STEP_KEY, String(nextStep));
    } catch {}
    const stepDef = TUTORIAL_STEPS[nextStep];
    trackEvent("tutorial_step_viewed", {
      step: nextStep,
      step_id: stepDef.id,
      page: stepDef.page,
    });
  }, [step, trackEvent]);

  const dismiss = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "skipped");
      localStorage.removeItem(STEP_KEY);
    } catch {}
    trackEvent("tutorial_dismissed", {
      step,
      step_id: TUTORIAL_STEPS[step]?.id,
      completed_pct: Math.round((step / TUTORIAL_STEPS.length) * 100),
    });
  }, [step, trackEvent]);

  const restart = useCallback(() => {
    setStep(0);
    setActive(true);
    try {
      localStorage.removeItem(DISMISSED_KEY);
      localStorage.removeItem(STEP_KEY);
    } catch {}
    trackEvent("tutorial_restarted", {});
  }, [trackEvent]);

  const wasDismissedEarly = useCallback((): boolean => {
    try {
      const status = localStorage.getItem(DISMISSED_KEY);
      const savedStep = localStorage.getItem(STEP_KEY);
      // Was dismissed before finishing and didn't complete
      return status === "skipped" && savedStep !== null && Number(savedStep) < TUTORIAL_STEPS.length - 1;
    } catch {
      return false;
    }
  }, []);

  return {
    active,
    step,
    mounted,
    currentStepDef: TUTORIAL_STEPS[step] ?? null,
    totalSteps: TUTORIAL_STEPS.length,
    next,
    dismiss,
    restart,
    wasDismissedEarly,
  };
}
