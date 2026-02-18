"use client";

import { useEffect, useRef } from "react";

type TrackEventFn = (eventName: string, eventData?: Record<string, any>) => void;

const SS_VISIBLE = "offo_hs_visible";
const SS_SCROLL = "offo_hs_scroll";
const SS_INTERACT = "offo_hs_interact";

/**
 * Fires 3 "proof of human" events, each at most once per tab session.
 * Deduped via sessionStorage so reopening a tab resets them.
 */
export function useHumanSignals(trackEvent: TrackEventFn) {
  const firedRef = useRef({ visible: false, scroll: false, interact: false });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cleanups: (() => void)[] = [];

    // 1. page_visible_10s — user stayed on a visible tab for 10 seconds
    if (!sessionStorage.getItem(SS_VISIBLE) && !firedRef.current.visible) {
      const timer = setTimeout(() => {
        if (document.visibilityState === "visible" && !firedRef.current.visible) {
          firedRef.current.visible = true;
          sessionStorage.setItem(SS_VISIBLE, "1");
          trackEvent("page_visible_10s", { page: window.location.pathname });
        }
      }, 10_000);
      cleanups.push(() => clearTimeout(timer));
    }

    // 2. scroll_depth_25 — user scrolled past 25% of page
    if (!sessionStorage.getItem(SS_SCROLL) && !firedRef.current.scroll) {
      const onScroll = () => {
        const scrollPct =
          window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
        if (scrollPct >= 0.25 && !firedRef.current.scroll) {
          firedRef.current.scroll = true;
          sessionStorage.setItem(SS_SCROLL, "1");
          trackEvent("scroll_depth_25", {
            page: window.location.pathname,
            depth: Math.round(scrollPct * 100),
          });
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }

    // 3. first_interaction — user clicked or typed anywhere
    if (!sessionStorage.getItem(SS_INTERACT) && !firedRef.current.interact) {
      const onInteract = () => {
        if (!firedRef.current.interact) {
          firedRef.current.interact = true;
          sessionStorage.setItem(SS_INTERACT, "1");
          trackEvent("first_interaction", { page: window.location.pathname });
          document.removeEventListener("click", onInteract);
          document.removeEventListener("keydown", onInteract);
        }
      };
      document.addEventListener("click", onInteract, { once: true });
      document.addEventListener("keydown", onInteract, { once: true });
      cleanups.push(() => {
        document.removeEventListener("click", onInteract);
        document.removeEventListener("keydown", onInteract);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, [trackEvent]);
}
