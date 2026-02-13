/**
 * Event Tracking Hook
 * Tracks user interactions for analytics
 */

import { useCallback, useRef } from "react";
import { getOrCreatePersistentSessionId } from "@/lib/session-utils";
import { initAttribution, getAttributionForEvent } from "@/lib/attribution";

interface EventData {
  [key: string]: any;
}

function getRegion(): "US" | "UK" | "AU" | "CA" {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith("Europe/London") || tz.startsWith("Europe/Belfast")) return "UK";
    if (tz.startsWith("Australia/")) return "AU";
    if (tz.startsWith("America/Toronto") || tz.startsWith("America/Vancouver") || tz.startsWith("America/Edmonton") || tz.startsWith("America/Winnipeg") || tz.startsWith("America/Halifax")) return "CA";
    return "US";
  } catch {
    return "US";
  }
}

export function useEventTracking() {
  const visitorIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const persistentSessionIdRef = useRef<string | null>(null);
  const attributionInitRef = useRef(false);

  // Initialize attribution on first render (client-side only)
  if (typeof window !== "undefined" && !attributionInitRef.current) {
    initAttribution();
    attributionInitRef.current = true;
  }

  // Generate visitor ID (same as visitor tracking)
  const getVisitorId = useCallback(() => {
    if (visitorIdRef.current) return visitorIdRef.current;

    if (typeof window === "undefined") return null;

    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
    ].join("|");

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    visitorIdRef.current = `fp-${Math.abs(hash).toString(36)}`;
    return visitorIdRef.current;
  }, []);

  // Generate session ID (tab-level, lost on tab close)
  const getSessionId = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current;

    sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return sessionIdRef.current;
  }, []);

  // Get persistent session ID (survives browser sessions, tracks unique customers)
  const getPersistentSessionId = useCallback(() => {
    if (persistentSessionIdRef.current) return persistentSessionIdRef.current;

    persistentSessionIdRef.current = getOrCreatePersistentSessionId();
    return persistentSessionIdRef.current;
  }, []);

  // Track event
  const trackEvent = useCallback(
    async (eventName: string, eventData?: EventData) => {
      if (typeof window === "undefined") return;

      try {
        await fetch("/api/track-event", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventName,
            eventData: {
              ...(eventData || {}),
              persistent_session_id: getPersistentSessionId(),
              region: getRegion(),
              sensitivity: "normal",
              source: "web",
              ...(getAttributionForEvent() ? { attribution: getAttributionForEvent() } : {}),
            },
            visitorId: getVisitorId(),
            sessionId: getSessionId(),
            pagePath: window.location.pathname,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error("Event tracking failed:", error);
        // Fail silently - don't disrupt user experience
      }
    },
    [getVisitorId, getSessionId, getPersistentSessionId]
  );

  // Specific event trackers
  const trackFormSubmit = useCallback(
    (success: boolean, formData?: any, error?: string) => {
      trackEvent("form_submit", {
        success,
        formData,
        error,
      });
    },
    [trackEvent]
  );

  const trackUrlAutofillAttempt = useCallback(
    (url: string, success: boolean, extractedData?: any, error?: string) => {
      trackEvent("url_autofill_attempt", {
        url,
        success,
        extractedData,
        error,
      });
    },
    [trackEvent]
  );

  const trackBlogLinkClick = useCallback(
    (source: string, destination: string) => {
      trackEvent("blog_link_click", {
        source,
        destination,
      });
    },
    [trackEvent]
  );

  const trackReportGenerated = useCallback(
    (reportData: any) => {
      trackEvent("report_generated", {
        vehicle: reportData.vehicle,
        year: reportData.year,
        model: reportData.model,
      });
    },
    [trackEvent]
  );

  const trackButtonClick = useCallback(
    (buttonName: string, context?: string) => {
      trackEvent("button_click", {
        buttonName,
        context,
      });
    },
    [trackEvent]
  );

  const trackWhyCheckpoint = useCallback(
    (action: 'shown' | 'skipped' | 'submitted' | 'error', data?: {
      placement?: string;
      why_choice?: string;
      why_other_text?: string;
      report_id?: string;
      error_code?: string;
    }) => {
      trackEvent(`why_checkpoint_${action}`, {
        placement: data?.placement || 'report_view',
        ...data,
      });
    },
    [trackEvent]
  );

  // Constraint Impact Layer telemetry
  const trackConstraintDetected = useCallback(
    (constraintId: string, source: string, model: string) => {
      trackEvent("constraint_detected", {
        constraint_id: constraintId,
        constraint_source: source,
        model,
      });
    },
    [trackEvent]
  );

  const trackConstraintSignalViewed = useCallback(
    (signalType: string, constraintId: string) => {
      trackEvent("constraint_signal_viewed", {
        signal_type: signalType,
        constraint_id: constraintId,
      });
    },
    [trackEvent]
  );

  // Report view tracking
  const trackReportView = useCallback(
    (data: {
      vehicle_model: string;
      vehicle_year?: number;
      scenario_hash?: string;
      fit_signal?: string;
    }) => {
      trackEvent("report_view", data);
    },
    [trackEvent]
  );

  // Scenario save tracking
  const trackScenarioSaveClicked = useCallback(
    (data: {
      scenario_hash?: string;
      vehicle_model?: string;
      is_authenticated: boolean;
    }) => {
      trackEvent("scenario_save_clicked", data);
    },
    [trackEvent]
  );

  const trackScenarioSaveSuccess = useCallback(
    (data: {
      scenario_id: string;
      scenario_hash?: string;
      vehicle_model?: string;
      is_new: boolean;
    }) => {
      trackEvent("scenario_save_success", data);
    },
    [trackEvent]
  );

  // Email/Auth funnel tracking
  const trackEmailEntryStart = useCallback(
    (triggerSource: string) => {
      trackEvent("email_entry_start", {
        trigger_source: triggerSource,
      });
    },
    [trackEvent]
  );

  const trackEmailEntrySubmitted = useCallback(
    (emailHash?: string) => {
      trackEvent("email_entry_submitted", {
        email_hash: emailHash,
      });
    },
    [trackEvent]
  );

  const trackEmailConfirmed = useCallback(
    (userId?: string) => {
      trackEvent("email_confirmed", {
        user_id: userId,
      });
    },
    [trackEvent]
  );

  // Feedback tracking
  const trackFeedbackHelpful = useCallback(
    (response: "yes" | "no", section?: string) => {
      trackEvent("feedback_helpful", {
        response,
        section,
      });
    },
    [trackEvent]
  );

  const trackFeedbackAccuracy = useCallback(
    (data: {
      rating: number;
      vehicle_model?: string;
      comments?: string;
    }) => {
      trackEvent("feedback_accuracy", data);
    },
    [trackEvent]
  );

  // Micro feedback tracking
  const trackMicroFeedback = useCallback(
    (action: "shown" | "submitted" | "skipped", data?: {
      section?: string;
      response?: string;
      vehicle_model?: string;
    }) => {
      trackEvent(`micro_feedback_${action}` as any, {
        ...data,
      });
    },
    [trackEvent]
  );

  // Scroll depth tracking
  const trackScrollDepth = useCallback(
    (depth: number, pagePath?: string) => {
      trackEvent("scroll_depth", {
        depth_percent: depth,
        page_path: pagePath || window.location.pathname,
      });
    },
    [trackEvent]
  );

  // ==========================================
  // NEW: Report Generation Lifecycle Events
  // ==========================================

  // Track when form intake is submitted (before report generation starts)
  const trackIntakeSubmitted = useCallback(
    (data: {
      vehicle_model?: string;
      vehicle_year?: number;
      form_name?: string;
    }) => {
      trackEvent("intake_submitted", data);
    },
    [trackEvent]
  );

  // Track when report generation starts (client-side, before API call)
  const trackReportGenerationStarted = useCallback(
    (data: {
      vehicle_model?: string;
      vehicle_year?: number;
    }) => {
      trackEvent("report_generation_started", data);
    },
    [trackEvent]
  );

  // Track successful report generation
  const trackReportGenerationSucceeded = useCallback(
    (data: {
      report_id: string;
      vehicle_model?: string;
      vehicle_year?: number;
      report_status?: string;
    }) => {
      trackEvent("report_generation_succeeded", data);
    },
    [trackEvent]
  );

  // Track failed report generation
  const trackReportGenerationFailed = useCallback(
    (data: {
      vehicle_model?: string;
      vehicle_year?: number;
      error_code?: string;
      error_message?: string;
    }) => {
      trackEvent("report_generation_failed", data);
    },
    [trackEvent]
  );

  // ==========================================
  // NEW: Failure Tracking Events
  // ==========================================

  // Track form validation failures
  const trackFormValidationFailed = useCallback(
    (data: {
      form_name: string;
      errors: Record<string, string>;
      fields_completed?: string[];
    }) => {
      trackEvent("form_validation_failed", data);
    },
    [trackEvent]
  );

  // Track API errors
  const trackApiError = useCallback(
    (data: {
      endpoint: string;
      error_code?: string;
      error_message?: string;
      status_code?: number;
    }) => {
      trackEvent("api_error", data);
    },
    [trackEvent]
  );

  // Track form abandonment (call on page unload if form started but not submitted)
  const trackFormAbandoned = useCallback(
    (data: {
      form_name: string;
      fields_completed: string[];
      time_spent_ms?: number;
    }) => {
      trackEvent("form_abandoned", data);
    },
    [trackEvent]
  );

  // ==========================================
  // NEW: Funnel Instrumentation Events
  // ==========================================

  const trackLandingView = useCallback(
    () => {
      trackEvent("landing_view", { page: typeof window !== "undefined" ? window.location.pathname : "/" });
    },
    [trackEvent]
  );

  const trackCTAClick = useCallback(
    (ctaId: string) => {
      trackEvent("cta_start_click", { cta_id: ctaId, page: typeof window !== "undefined" ? window.location.pathname : "/" });
    },
    [trackEvent]
  );

  const trackIntakeStarted = useCallback(
    () => {
      trackEvent("intake_started", {});
    },
    [trackEvent]
  );

  const trackIntakeStepCompleted = useCallback(
    (step: string, stepData?: Record<string, any>) => {
      trackEvent("intake_step_completed", { step, ...stepData });
    },
    [trackEvent]
  );

  const trackReportGenerateClick = useCallback(
    (data?: { report_id?: string; scenario_id?: string; scenario_slug?: string }) => {
      trackEvent("report_generate_click", data);
    },
    [trackEvent]
  );

  const trackSaveClick = useCallback(
    (data?: { scenario_id?: string; scenario_slug?: string }) => {
      trackEvent("save_click", data);
    },
    [trackEvent]
  );

  const trackSaveSuccess = useCallback(
    (data: { scenario_id: string; scenario_slug?: string; save_type?: "anon" | "account" }) => {
      trackEvent("save_success", data);
    },
    [trackEvent]
  );

  const trackCopyClick = useCallback(
    (target: string) => {
      trackEvent("copy_click", { target });
    },
    [trackEvent]
  );

  return {
    trackEvent,
    trackFormSubmit,
    trackUrlAutofillAttempt,
    trackBlogLinkClick,
    trackReportGenerated,
    trackButtonClick,
    trackWhyCheckpoint,
    trackConstraintDetected,
    trackConstraintSignalViewed,
    // Report & scenario trackers
    trackReportView,
    trackScenarioSaveClicked,
    trackScenarioSaveSuccess,
    // Auth trackers
    trackEmailEntryStart,
    trackEmailEntrySubmitted,
    trackEmailConfirmed,
    // Feedback trackers
    trackFeedbackHelpful,
    trackFeedbackAccuracy,
    trackMicroFeedback,
    trackScrollDepth,
    // Report generation lifecycle
    trackIntakeSubmitted,
    trackReportGenerationStarted,
    trackReportGenerationSucceeded,
    trackReportGenerationFailed,
    // Failure tracking
    trackFormValidationFailed,
    trackApiError,
    trackFormAbandoned,
    // Funnel instrumentation
    trackLandingView,
    trackCTAClick,
    trackIntakeStarted,
    trackIntakeStepCompleted,
    trackReportGenerateClick,
    trackSaveClick,
    trackSaveSuccess,
    trackCopyClick,
    // Expose persistent session ID for external use
    getPersistentSessionId,
  };
}
