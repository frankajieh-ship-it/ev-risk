/**
 * Session Tracking Hook
 *
 * Manages the EV Routine session lifecycle:
 * - Start session when user begins
 * - Complete session when results are computed
 * - Track results viewed
 * - Record resolution
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface SessionContext {
  region?: "AUTO" | "UK" | "US";
  source?: string;
  source_detail?: string;
  thread_type?: string;
  referrer?: string;
  utm?: Record<string, string>;
}

interface SessionInputs {
  // Routine inputs - no PII
  [key: string]: unknown;
}

interface EngineOutputs {
  fit_signal?: "GOOD" | "CONDITIONAL" | "HIGH_FRICTION";
  fade_label?: string;
  friction_bullets?: string[];
  why_not_100?: string[];
  risk_tags?: string[];
}

export function useSessionTracking() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  /**
   * Parse URL params for source/UTM on mount
   */
  const getUrlContext = useCallback((): Partial<SessionContext> => {
    if (typeof window === "undefined") return {};

    const params = new URLSearchParams(window.location.search);
    const context: Partial<SessionContext> = {};

    // Source params
    const source = params.get("source");
    if (source) context.source = source;

    const sourceDetail = params.get("source_detail");
    if (sourceDetail) context.source_detail = sourceDetail;

    const threadType = params.get("thread_type");
    if (threadType) context.thread_type = threadType;

    // UTM params
    const utm: Record<string, string> = {};
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    for (const key of utmKeys) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }
    if (Object.keys(utm).length > 0) {
      context.utm = utm;
    }

    // Referrer
    if (document.referrer) {
      context.referrer = document.referrer;
    }

    return context;
  }, []);

  /**
   * Start a new session
   */
  const startSession = useCallback(async (additionalContext?: Partial<SessionContext>) => {
    // Prevent duplicate starts
    if (startedRef.current || sessionId) return sessionId;
    startedRef.current = true;
    setIsStarting(true);
    setError(null);

    try {
      const urlContext = getUrlContext();
      const context = { ...urlContext, ...additionalContext };

      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to start session");
      }

      setSessionId(data.session_id);

      // Store in sessionStorage for persistence across page navigations
      if (typeof window !== "undefined") {
        sessionStorage.setItem("offo_session_id", data.session_id);
      }

      return data.session_id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("Session start error:", message);
      startedRef.current = false; // Allow retry on error
      return null;
    } finally {
      setIsStarting(false);
    }
  }, [sessionId, getUrlContext]);

  /**
   * Complete session with inputs and engine outputs
   */
  const completeSession = useCallback(async (
    inputs: SessionInputs,
    outputs: EngineOutputs
  ) => {
    const currentSessionId = sessionId || sessionStorage.getItem("offo_session_id");
    if (!currentSessionId) {
      console.warn("No session to complete");
      return false;
    }

    try {
      const response = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSessionId,
          inputs,
          ...outputs,
        }),
      });

      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error("Session complete error:", err);
      return false;
    }
  }, [sessionId]);

  /**
   * Track results viewed
   */
  const trackResultsViewed = useCallback(async () => {
    const currentSessionId = sessionId || sessionStorage.getItem("offo_session_id");
    if (!currentSessionId) return false;

    try {
      const response = await fetch("/api/session/results_viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: currentSessionId }),
      });

      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error("Results viewed error:", err);
      return false;
    }
  }, [sessionId]);

  /**
   * Restore session from sessionStorage on mount
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = sessionStorage.getItem("offo_session_id");
    if (stored && !sessionId) {
      setSessionId(stored);
    }
  }, [sessionId]);

  return {
    sessionId,
    isStarting,
    error,
    startSession,
    completeSession,
    trackResultsViewed,
    getUrlContext,
  };
}
