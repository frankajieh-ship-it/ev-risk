/**
 * Visitor Tracking Hook
 * Automatically tracks page views on offolab.com
 */

import { useEffect, useRef } from "react";

interface TrackingOptions {
  enabled?: boolean;
  trackPageViews?: boolean;
  trackSessionDuration?: boolean;
}

export function useVisitorTracking(options: TrackingOptions = {}) {
  const {
    enabled = true,
    trackPageViews = true,
    trackSessionDuration = true,
  } = options;

  const sessionStartRef = useRef<number>(Date.now());
  const fingerprint = useRef<string | null>(null);

  // Generate simple browser fingerprint
  const generateFingerprint = () => {
    if (typeof window === "undefined") return null;

    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      // Add more fingerprinting data as needed
    ].join("|");

    // Simple hash function (in production, use a proper library like fingerprintjs)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `fp-${Math.abs(hash).toString(36)}`;
  };

  // Track page view
  const trackPageView = async (pagePath: string) => {
    if (!enabled || typeof window === "undefined") return;

    try {
      const sessionDuration = trackSessionDuration
        ? Math.floor((Date.now() - sessionStartRef.current) / 1000)
        : null;

      await fetch("/api/track-visitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pagePath: pagePath || window.location.pathname,
          referrer: document.referrer || null,
          fingerprint: fingerprint.current,
          sessionDuration,
        }),
      });
    } catch (error) {
      console.error("Visitor tracking failed:", error);
      // Fail silently - don't disrupt user experience
    }
  };

  useEffect(() => {
    if (!enabled || !trackPageViews) return;

    // Generate fingerprint once per session
    if (!fingerprint.current) {
      fingerprint.current = generateFingerprint();
    }

    // Track initial page view
    trackPageView(window.location.pathname);

    // Track page view on route changes (for SPAs)
    const handleRouteChange = () => {
      sessionStartRef.current = Date.now();
      trackPageView(window.location.pathname);
    };

    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", handleRouteChange);

    // Track page unload (session duration)
    const handleBeforeUnload = () => {
      if (trackSessionDuration) {
        const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        // Use sendBeacon with Blob for reliable tracking on page unload
        const blob = new Blob(
          [JSON.stringify({
            pagePath: window.location.pathname,
            referrer: document.referrer || null,
            fingerprint: fingerprint.current,
            sessionDuration: duration,
          })],
          { type: "application/json" }
        );
        navigator.sendBeacon("/api/track-visitor", blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, trackPageViews, trackSessionDuration]);

  return {
    trackPageView,
    fingerprint: fingerprint.current,
  };
}
