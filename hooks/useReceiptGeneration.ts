/**
 * useReceiptGeneration
 *
 * Owns all state and logic for generating, regenerating, and auto-fixing
 * receipts. Extracts the heaviest logic block out of receipt/page.tsx.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { ListingReceipt, LintError, StructuredListingFields } from "@/types/receipt";
import type { MinimumViableRoutine } from "@/types/v2";

// Re-declared here so the hook is self-contained
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status === 429) return res;
      if (res.status === 409 && attempt < maxRetries) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "5", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      if ((res.status === 503 || res.status === 504) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt >= maxRetries) throw err;
      await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
    }
  }
  throw new Error("fetchWithRetry: exhausted retries");
}

export type TrackEventFn = (event: string, props?: { [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | unknown[] }) => void | Promise<void>;
export type AddReceiptFn = (receipt: ListingReceipt) => void;

interface UseReceiptGenerationOpts {
  receiptToken: string;
  region: string;
  trackEvent: TrackEventFn;
  addReceipt: AddReceiptFn;
  executeTurnstile: () => Promise<string | null>;
  routineContext: MinimumViableRoutine | null;
  pageSource: string | null;
  // Callbacks for page-level state that handleGenerate populates
  onRoutineContextUsed?: (opts: {
    fitLabel: string | null;
    fitScore: number | null;
    fitSummary: string | null;
  }) => void;
  onRecallsLoaded?: (recalls: Array<{
    recall_id: string;
    title: string;
    component: string;
    routine_impact_score: number;
    is_safety_critical: boolean;
    ai_summary: string;
  }>) => void;
  onIsProChanged?: (isPro: boolean) => void;
  onListingAgeLoaded?: (data: { firstSeenAt: string | null; priceDropCents: number | null }) => void;
}

export function useReceiptGeneration({
  receiptToken,
  region,
  trackEvent,
  addReceipt,
  executeTurnstile,
  routineContext,
  pageSource,
  onRoutineContextUsed,
  onRecallsLoaded,
  onIsProChanged,
  onListingAgeLoaded,
}: UseReceiptGenerationOpts) {
  const [receipt, setReceipt] = useState<ListingReceipt | null>(null);
  const [lintPassed, setLintPassed] = useState(true);
  const [lintErrors, setLintErrors] = useState<LintError[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [isSimilarityMatch, setIsSimilarityMatch] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeFailed, setUpgradeFailed] = useState(false);
  const [currentVin, setCurrentVin] = useState<string | undefined>(undefined);
  const [sections, setSections] = useState<Record<string, { status: string }> | null>(null);

  const inFlightRef = useRef(false);
  const lastGenerateInputRef = useRef<{
    listing_url?: string;
    listing_text?: string;
    fields: StructuredListingFields;
    extraction_id?: string;
    input_mode?: string;
  } | null>(null);
  const upgradePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Multi-step loading progress
  useEffect(() => {
    if (!isGenerating) {
      setGeneratingStep(0);
      return;
    }
    const timers = [
      setTimeout(() => setGeneratingStep(1), 3000),
      setTimeout(() => setGeneratingStep(2), 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isGenerating]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (upgradePollingRef.current) clearInterval(upgradePollingRef.current);
    };
  }, []);

  const startUpgradePolling = useCallback((receiptId: string, vin?: string) => {
    if (upgradePollingRef.current) clearInterval(upgradePollingRef.current);

    setIsUpgrading(true);
    let attempts = 0;
    const maxAttempts = 40;

    const poll = setInterval(async () => {
      attempts++;
      let didFail = false;
      try {
        const res = await fetch(`/api/receipt/${encodeURIComponent(receiptId)}/status`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.generation_status === "full" && data.receipt) {
          clearInterval(poll);
          upgradePollingRef.current = null;
          const upgradedReceipt = vin && !data.receipt.vin
            ? { ...data.receipt, vin }
            : data.receipt;
          setReceipt(upgradedReceipt);
          if (data.sections) setSections(data.sections);
          setIsUpgrading(false);
          setIsFallback(false);

          addReceipt(data.receipt);

          trackEvent("receipt_full_ready", {
            receipt_id: receiptId,
            polls_count: attempts,
            upgrade_ms: attempts * 3000,
          });
        } else if (data.generation_status === "failed") {
          didFail = true;
          clearInterval(poll);
          upgradePollingRef.current = null;
          setIsUpgrading(false);
          setUpgradeFailed(true);

          trackEvent("receipt_upgrade_failed", {
            receipt_id: receiptId,
            polls_count: attempts,
          });
        }
      } catch {
        // Network error — keep polling
      }

      if (attempts >= maxAttempts && !didFail) {
        clearInterval(poll);
        upgradePollingRef.current = null;
        setIsUpgrading(false);
        setUpgradeFailed(true);

        trackEvent("receipt_upgrade_failed", {
          receipt_id: receiptId,
          polls_count: attempts,
          reason: "max_attempts",
        });
      }
    }, 2000);

    upgradePollingRef.current = poll;
  }, [trackEvent, addReceipt]);

  const handleGenerate = useCallback(
    async (data: {
      listing_url?: string;
      listing_text?: string;
      fields: StructuredListingFields;
      extraction_id?: string;
      input_mode?: string;
      force_regenerate?: boolean;
      photo_urls?: string[];
    }) => {
      if (!receiptToken) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      lastGenerateInputRef.current = data;

      if (upgradePollingRef.current) {
        clearInterval(upgradePollingRef.current);
        upgradePollingRef.current = null;
      }
      setIsUpgrading(false);

      setIsGenerating(true);
      setError(null);
      setReceipt(null);
      setLintPassed(true);
      setLintErrors([]);
      setIsFallback(false);
      setIsSimilarityMatch(false);
      setUpgradeFailed(false);
      setCurrentVin(data.fields.vin || undefined);

      try {
        let turnstileToken = await executeTurnstile();
        if (!turnstileToken) {
          await new Promise((r) => setTimeout(r, 1500));
          turnstileToken = await executeTurnstile();
        }

        const body: Record<string, unknown> = {
          receipt_token: receiptToken,
          mode: "single",
          region,
          turnstileToken,
          leave_this_empty: "",
        };

        if (data.force_regenerate) body.force_regenerate = true;
        if (pageSource) body.page_source = pageSource;
        if (data.input_mode) body.input_mode = data.input_mode;
        if (data.extraction_id) body.extraction_id = data.extraction_id;
        if (data.listing_url) body.listing_url = data.listing_url;
        if (data.listing_text) body.listing_text = data.listing_text;

        const f = data.fields;
        if (f.year) body.year = f.year;
        if (f.make) body.make = f.make;
        if (f.model) body.model = f.model;
        if (f.trim) body.trim = f.trim;
        if (f.mileage) body.mileage = f.mileage;
        if (f.price) body.price = f.price;
        if (f.vin) body.vin = f.vin;
        if (f.location) body.location = f.location;
        if (f.seller_type) body.seller_type = f.seller_type;
        if (f.title_status) body.title_status = f.title_status;
        if (f.accidents_reported) body.accidents_reported = f.accidents_reported;
        if (f.service_history) body.service_history = f.service_history;
        if (f.owners) body.owners = f.owners;
        if (f.carfax_available) body.carfax_available = f.carfax_available;
        if (f.financing_vs_cash) body.financing_vs_cash = f.financing_vs_cash;
        if (f.country) body.country = f.country;
        if (f.zip_or_postcode) body.zip_or_postcode = f.zip_or_postcode;
        if (routineContext) body.routine_context = routineContext;
        if (f.market_price_range) body.market_price_range = f.market_price_range;
        if (f.auto_dev_specs) body.auto_dev_specs = f.auto_dev_specs;
        if (data.photo_urls?.length) body.photo_urls = data.photo_urls;

        const res = await fetchWithRetry("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = await res.json();

        if (!res.ok || !result.success) {
          if (res.status === 403 && result.captcha_required) {
            setError("Bot check failed. Click Generate Receipt to try again — if this keeps happening, refresh the page.");
            return;
          }
          if (res.status === 429 && result.resetAt) {
            const resetDate = new Date(result.resetAt);
            const hoursLeft = Math.max(1, Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60 * 60)));
            setError(
              result.remaining_free === 0
                ? `Free daily limit reached. Resets in ~${hoursLeft} hour${hoursLeft > 1 ? "s" : ""}.`
                : result.error || "Too many requests. Please try again later."
            );
          } else {
            setError(result.error || "Failed to generate receipt");
          }
          if (typeof result.remaining_free === "number") {
            setRemainingFree(result.remaining_free);
          }
          return;
        }

        const receiptWithVin = data.fields.vin
          ? { ...result.receipt, vin: data.fields.vin }
          : result.receipt;
        setReceipt(receiptWithVin);
        setCurrentVin(data.fields.vin || undefined);
        setLintPassed(result.lint_passed);
        setLintErrors(result.lint_error_codes || []);
        setIsFallback(!!result.fallback);
        setIsSimilarityMatch(!!result.similarity_match);

        if (result.routine_context_used && onRoutineContextUsed) {
          onRoutineContextUsed({
            fitLabel: result.routine_fit_label ?? null,
            fitScore: result.routine_fit_score ?? null,
            fitSummary: result.routine_fit_summary ?? null,
          });
        }
        if (typeof result.remaining_free === "number") {
          setRemainingFree(result.remaining_free);
        }
        if (typeof result.is_pro === "boolean" && onIsProChanged) {
          onIsProChanged(result.is_pro);
        }
        if (Array.isArray(result.recalls) && onRecallsLoaded) {
          onRecallsLoaded(result.recalls);
        }

        if (onListingAgeLoaded) {
          onListingAgeLoaded({
            firstSeenAt: (result.first_seen_at as string | null) ?? null,
            priceDropCents: (result.price_drop_cents as number | null) ?? null,
          });
        }

        addReceipt(result.receipt);

        if (result.source === "deal_cache") {
          trackEvent("receipt_deal_cache_hit", {
            receipt_id: result.receipt_id,
            verdict: result.receipt.verdict,
          });
        } else if (result.generation_status === "lite" && result.receipt_id) {
          trackEvent("receipt_lite_shown", {
            receipt_id: result.receipt.receipt_id,
            verdict: result.receipt.verdict,
            fit_score: result.receipt.fit_score,
          });
          startUpgradePolling(result.receipt_id, data.fields.vin || undefined);
        }

        trackEvent("receipt_generate", {
          receipt_id: result.receipt.receipt_id,
          verdict: result.receipt.verdict,
          price_label: result.receipt.price_sanity?.label,
          lint_passed: result.lint_passed,
          fallback: !!result.fallback,
          generation_status: result.generation_status || "full",
          input_method: data.input_mode || (data.listing_url ? "url" : data.listing_text ? "paste" : "structured"),
          is_return_visit: result.source === "deal_cache" ? false : !!result.receipt?.receipt_id && result.generation_status !== "full",
        });
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        setError(
          isAbort
            ? "Receipt is taking longer than expected. Please try again."
            : "Generation failed after multiple attempts. Try pasting less text or entering details manually."
        );
      } finally {
        setIsGenerating(false);
        inFlightRef.current = false;
      }
    },
    [receiptToken, region, trackEvent, addReceipt, executeTurnstile, routineContext, pageSource, onRoutineContextUsed, onIsProChanged, onRecallsLoaded, onListingAgeLoaded, startUpgradePolling]
  );

  const handleRegenerate = useCallback(() => {
    const lastInput = lastGenerateInputRef.current;
    if (!lastInput) {
      setError("Unable to regenerate — please re-submit your listing URL or text.");
      return;
    }
    trackEvent("receipt_regen", {
      receipt_id: receipt?.receipt_id,
      was_fallback: isFallback,
      was_similarity: isSimilarityMatch,
      trigger: "manual",
    });
    handleGenerate({ ...lastInput, force_regenerate: true });
  }, [handleGenerate, receipt?.receipt_id, isFallback, isSimilarityMatch, trackEvent]);

  const handleAutoFix = useCallback(async () => {
    if (!receipt || !receiptToken) return;
    setIsFixing(true);
    try {
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_token: receiptToken,
          mode: "fix_only",
          receipt_json: receipt,
          lint_errors: lintErrors,
        }),
      });
      const result = await res.json();
      if (result.success && result.receipt) {
        setReceipt(result.receipt);
        setLintPassed(result.lint_passed);
        setLintErrors(result.lint_error_codes || []);
        trackEvent("receipt_regen", {
          receipt_id: receipt.receipt_id,
          lint_passed: result.lint_passed,
          trigger: "lint_fix",
        });
      }
    } catch {
      // silently fail
    } finally {
      setIsFixing(false);
    }
  }, [receipt, receiptToken, lintErrors, trackEvent]);

  const handleHistorySelect = useCallback((entry: { receipt: ListingReceipt }) => {
    setReceipt(entry.receipt);
    setLintPassed(true);
    setLintErrors([]);
    setError(null);
  }, []);

  return {
    // State
    receipt,
    setReceipt,
    lintPassed,
    lintErrors,
    isGenerating,
    generatingStep,
    isFixing,
    error,
    setError,
    remainingFree,
    isFallback,
    isSimilarityMatch,
    isUpgrading,
    upgradeFailed,
    currentVin,
    sections,
    // Refs
    lastGenerateInputRef,
    // Handlers
    handleGenerate,
    handleRegenerate,
    handleAutoFix,
    handleHistorySelect,
  };
}
