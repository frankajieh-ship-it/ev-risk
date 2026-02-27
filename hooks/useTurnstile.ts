/**
 * useTurnstile — Invisible Cloudflare Turnstile widget hook
 *
 * Manages the Turnstile widget lifecycle using the `window.turnstile` API.
 * Uses invisible/execute mode: zero user friction, challenge runs in background.
 *
 * Usage:
 *   const { execute, isReady } = useTurnstile({
 *     containerId: "turnstile-receipt",
 *     action: "receipt-submit",
 *   });
 *
 *   // On form submit:
 *   const token = await execute();
 *   // token is string on success, null if Turnstile unavailable
 */

"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Global type for the Turnstile JS API
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: Record<string, unknown>
      ) => string;
      execute: (
        container: string | HTMLElement,
        options?: Record<string, unknown>
      ) => void;
      getResponse: (widgetId: string) => string | undefined;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      isExpired: (widgetId: string) => boolean;
    };
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseTurnstileOptions {
  /** Unique DOM id for this widget's container div */
  containerId: string;
  /** Action label sent to Cloudflare for analytics (e.g. "receipt-submit") */
  action?: string;
}

export function useTurnstile({ containerId, action }: UseTurnstileOptions) {
  const widgetIdRef = useRef<string | null>(null);
  const resolveRef = useRef<((token: string | null) => void) | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return;

    let mounted = true;

    const init = () => {
      if (!mounted || !window.turnstile) return;
      if (widgetIdRef.current) return; // already rendered

      const container = document.getElementById(containerId);
      if (!container) return;

      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        size: "invisible",
        execution: "execute",
        action: action || "submit",
        callback: (token: string) => {
          if (resolveRef.current) {
            resolveRef.current(token);
            resolveRef.current = null;
          }
        },
        "error-callback": () => {
          if (resolveRef.current) {
            resolveRef.current(null);
            resolveRef.current = null;
          }
        },
        "expired-callback": () => {
          // Token expired before use — next execute() will get a fresh one
        },
      });

      setIsReady(true);
    };

    // If script already loaded, init immediately
    if (window.turnstile) {
      init();
    } else {
      // Poll for script load (layout.tsx loads it async)
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          init();
        }
      }, 200);

      const timeout = setTimeout(() => clearInterval(interval), 10000);

      return () => {
        mounted = false;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [containerId, action]);

  /**
   * Execute the invisible challenge and return a fresh token.
   * Returns null if Turnstile is not loaded or the challenge fails.
   */
  const execute = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!window.turnstile || !widgetIdRef.current) {
        resolve(null);
        return;
      }

      // Reset to get a fresh token (in case a previous one expired)
      window.turnstile.reset(widgetIdRef.current);
      resolveRef.current = resolve;

      window.turnstile.execute(`#${containerId}`, {});

      // Safety timeout: 8s (well under 30s fetch timeout)
      setTimeout(() => {
        if (resolveRef.current) {
          resolveRef.current(null);
          resolveRef.current = null;
        }
      }, 8000);
    });
  }, [containerId]);

  return { execute, isReady };
}
