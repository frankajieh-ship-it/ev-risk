/**
 * useDeepDive
 *
 * Owns deep dive state and auto-loads the deep dive analysis whenever a new
 * receipt is set. Extracted from receipt/page.tsx.
 */

import { useState, useEffect } from "react";
import type { DeepDiveContent } from "@/types/receipt";

export function useDeepDive({
  receiptId,
  receiptToken,
}: {
  receiptId: string | null | undefined;
  receiptToken: string;
}) {
  const [deepDive, setDeepDive] = useState<DeepDiveContent | null>(null);
  const [isLoadingDeepDive, setIsLoadingDeepDive] = useState(false);

  // Reset deep dive when receipt changes
  useEffect(() => {
    setDeepDive(null); // eslint-disable-line react-hooks/set-state-in-effect
  }, [receiptId]);

  // Auto-load deep dive for all users (free — no payment gate)
  useEffect(() => {
    if (!receiptId || !receiptToken) return;
    if (deepDive) return;

    let cancelled = false;
    setIsLoadingDeepDive(true); // eslint-disable-line react-hooks/set-state-in-effect

    (async () => {
      try {
        const res = await fetch("/api/deepdive/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario_type: "receipt",
            scenario_id: receiptId,
            anon_id: receiptToken,
          }),
        });
        const data = await res.json();
        if (process.env.NODE_ENV !== "production") {
          console.log("[DeepDive] API response:", res.status, data.success, data.error || "");
        }
        if (cancelled) return;
        if (res.status === 202) {
          // Receipt output_json not yet populated — retry after delay
          await new Promise((r) => setTimeout(r, 5000));
          if (!cancelled) setIsLoadingDeepDive(false); // reset so effect can retry
          return;
        }
        if (data.success && data.deep_dive) {
          setDeepDive(data.deep_dive);
        }
        setIsLoadingDeepDive(false);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[DeepDive] Fetch error:", err);
        }
        if (!cancelled) setIsLoadingDeepDive(false);
      }
    })();

    return () => {
      cancelled = true;
      setIsLoadingDeepDive(false);
    };
  }, [receiptId, receiptToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return { deepDive, isLoadingDeepDive };
}
