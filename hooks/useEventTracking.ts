/**
 * Event Tracking Hook
 * Tracks user interactions for analytics
 */

import { useCallback, useRef } from "react";

interface EventData {
  [key: string]: any;
}

export function useEventTracking() {
  const visitorIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

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

  // Generate session ID
  const getSessionId = useCallback(() => {
    if (sessionIdRef.current) return sessionIdRef.current;

    sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return sessionIdRef.current;
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
            eventData: eventData || {},
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
    [getVisitorId, getSessionId]
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

  return {
    trackEvent,
    trackFormSubmit,
    trackUrlAutofillAttempt,
    trackBlogLinkClick,
    trackReportGenerated,
    trackButtonClick,
    trackWhyCheckpoint,
  };
}
