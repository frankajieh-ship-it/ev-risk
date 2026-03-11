"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useHumanSignals } from "@/hooks/useHumanSignals";

export function HumanSignalCollector() {
  const { trackEvent } = useEventTracking();
  const pathname = usePathname();
  const initialRenderRef = useRef(true);

  useHumanSignals(trackEvent);

  // Fire page_viewed with a fresh view_id on every SPA route change
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Generate a unique view_id per route render
    const viewId = `view-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Skip firing on very first render — useVisitorTracking in each page handles the initial hit.
    // We fire on subsequent navigations so the user_events table gets page_viewed entries
    // that the coverage watchdog can count.
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      // Still fire on first load so /api/health/tracking can count it
      trackEvent("page_viewed", {
        view_id: viewId,
        page_path: pathname,
        flow: pathname.startsWith("/receipt")
          ? "receipt"
          : pathname.startsWith("/routine")
          ? "evfit"
          : pathname.startsWith("/dealer")
          ? "dealer"
          : "landing",
      });
      return;
    }

    trackEvent("page_viewed", {
      view_id: viewId,
      page_path: pathname,
      flow: pathname.startsWith("/receipt")
        ? "receipt"
        : pathname.startsWith("/routine")
        ? "evfit"
        : pathname.startsWith("/dealer")
        ? "dealer"
        : "landing",
    });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
