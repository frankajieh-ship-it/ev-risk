/**
 * useDeepDive
 *
 * Owns deep dive state and auto-loads the deep dive analysis whenever a new
 * receipt is set. Extracted from receipt/page.tsx.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { DeepDiveContent } from "@/types/receipt";

const MAX_202_RETRIES = 15;
const RETRY_DELAY_MS = 10_000;
const INITIAL_DELAY_MS = 15_000; // give the AI upgrade a head start before first attempt

export function useDeepDive({
  receiptId,
  receiptToken,
}: {
  receiptId: string | null | undefined;
  receiptToken: string;
}) {
  const [deepDive, setDeepDive] = useState<DeepDiveContent | null>(null);
  const [isLoadingDeepDive, setIsLoadingDeepDive] = useState(false);
  const [deepDiveFailed, setDeepDiveFailed] = useState(false);
  const retryCountRef = useRef(0);
  const cancelledRef = useRef(false);

  // Reset deep dive when receipt changes
  useEffect(() => {
    setDeepDive(null); // eslint-disable-line react-hooks/set-state-in-effect
    setDeepDiveFailed(false);  
    retryCountRef.current = 0;
  }, [receiptId]);

  const runAttempt = useCallback((currentReceiptId: string, currentReceiptToken: string) => {
    cancelledRef.current = false;
    setDeepDiveFailed(false);
    setIsLoadingDeepDive(true);
    retryCountRef.current = 0;

    async function attempt(): Promise<void> {
      try {
        const res = await fetch("/api/deepdive/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario_type: "receipt",
            scenario_id: currentReceiptId,
            anon_id: currentReceiptToken,
          }),
        });
        const data = await res.json();
        if (process.env.NODE_ENV !== "production") {
          console.log("[DeepDive] API response:", res.status, data.success, data.error || "");
        }
        if (cancelledRef.current) return;

        if (res.status === 202) {
          // Receipt output_json not yet populated — retry silently
          if (retryCountRef.current < MAX_202_RETRIES) {
            retryCountRef.current += 1;
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            if (!cancelledRef.current) return attempt();
          } else {
            setIsLoadingDeepDive(false);
            setDeepDiveFailed(true);
          }
          return;
        }

        if (data.success && data.deep_dive) {
          setDeepDive(data.deep_dive);
          setDeepDiveFailed(false);
        } else {
          setDeepDiveFailed(true);
        }
        setIsLoadingDeepDive(false);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[DeepDive] Fetch error:", err);
        }
        if (!cancelledRef.current) {
          setIsLoadingDeepDive(false);
          setDeepDiveFailed(true);
        }
      }
    }

    // Small initial delay so the AI upgrade has a head start before first poll
    setTimeout(attempt, INITIAL_DELAY_MS);
  }, []);

  // Auto-load deep dive for all users (free — no payment gate)
  useEffect(() => {
    if (!receiptId || !receiptToken) return;
    if (deepDive) return;

    // setTimeout(0) defers setState calls out of the effect body to avoid cascading renders
    const t = setTimeout(() => runAttempt(receiptId, receiptToken), 0);

    return () => {
      clearTimeout(t);
      cancelledRef.current = true;
    };
  }, [receiptId, receiptToken, runAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryDeepDive = useCallback(() => {
    if (!receiptId || !receiptToken || isLoadingDeepDive) return;
    runAttempt(receiptId, receiptToken);
  }, [receiptId, receiptToken, isLoadingDeepDive, runAttempt]);

  return { deepDive, isLoadingDeepDive, deepDiveFailed, retryDeepDive };
}
