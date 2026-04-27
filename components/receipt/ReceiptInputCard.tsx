/**
 * ReceiptInputCard — One-click feeling
 *
 * Simplified flow:
 * 1. Paste URL or text → auto-extract on paste → "Generate Receipt" button
 * 2. Vehicle detail fields hidden behind "Add details" (expanded after extraction or on click)
 * 3. Multi-step loading states during extraction & generation
 * 4. Auto-focus text input on extraction failure
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Link,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronDown,
  Check,
  X,
  ShieldCheck,
} from "lucide-react";
import type { FetchedListingFields, StructuredListingFields } from "@/types/receipt";
import FbMarketplacePasteModal from "@/components/receipt/FbMarketplacePasteModal";

type InputMode = "url" | "text" | "vin";

type ExtractError = {
  message: string;
  isWarning?: boolean;
};

interface ReceiptInputCardProps {
  onGenerate: (data: {
    listing_url?: string;
    listing_text?: string;
    fields: StructuredListingFields;
    extraction_id?: string;
  }) => void;
  onExtractionSuccess?: (vehicleSummary: string) => void;
  onExtractionFields?: (fields: { year?: number; make?: string; model?: string; trim?: string; mileage?: number }) => void;
  onPhotosExtracted?: (photos: string[]) => void;
  isGenerating: boolean;
  generatingStep?: number;
  remainingFree: number | null;
  error: string | null;
  isPro?: boolean;
  prefillText?: string | null;
  prefillUrl?: string | null;
  trackEvent?: (eventName: string, eventData?: Record<string, unknown>) => void;
  receiptToken?: string;
  hasResult?: boolean;
}

const REQUIRED_FIELDS: (keyof StructuredListingFields)[] = [
  "year",
  "make",
  "model",
  "price",
  "mileage",
];

const FIELD_LABELS: Record<string, string> = {
  year: "Year",
  make: "Make",
  model: "Model",
  trim: "Trim",
  mileage: "Mileage",
  price: "Price",
  vin: "VIN",
  location: "Location",
};

const LABEL_CLASS = "text-xs font-medium text-white/60 mb-1";

function getInputClass(confidence?: string, isDirty?: boolean): string {
  const base = "form-input-sm";
  if (isDirty) {
    return `${base} border-blue-300 focus:border-blue-600 focus:ring-blue-600`;
  }
  if (confidence === "extracted") {
    return `${base} border-green-300 focus:border-green-600 focus:ring-green-600`;
  }
  return base;
}

// Extraction loading step labels
const EXTRACT_STEPS = ["Fetching listing page...", "Rendering JS — this takes a moment...", "Scanning for vehicle data...", "Almost there..."];
const GENERATE_STEPS = ["Checking risks...", "Analyzing pricing...", "Building your checklist..."];

/**
 * Attempts to extract a CarGurus listing ID from any CarGurus URL.
 * Checks: /details/<id>, /listing/<id>, ?listingId=, ?id=, and --d<id> path segment.
 */
function extractCarGurusListingId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("cargurus.com")) return null;
    const pathMatch = u.pathname.match(/\/(details|listing)\/(\d{6,12})/i);
    if (pathMatch) return pathMatch[2];
    const qId = u.searchParams.get("listingId") || u.searchParams.get("id");
    if (qId && /^\d{6,12}$/.test(qId)) return qId;
    const embeddedMatch = u.pathname.match(/--d(\d{6,12})/i);
    if (embeddedMatch) return embeddedMatch[1];
    return null;
  } catch {
    return null;
  }
}

function isCarGurusSearchUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("cargurus.com") && (
    lower.includes("/cars/") || lower.includes("/shopping/results")
  );
}

function isFacebookMarketplaceUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("facebook.com/marketplace") ||
    lower.includes("facebook.com/commerce") ||
    lower.includes("fb.com/marketplace")
  );
}

const SOURCE_DISPLAY_LABELS: Record<string, string> = {
  facebook: "Facebook Marketplace",
  cargurus: "CarGurus",
  autotrader: "AutoTrader",
  "cars.com": "Cars.com",
  carvana: "Carvana",
  carfax: "Carfax",
  truecar: "TrueCar",
  edmunds: "Edmunds",
  kbb: "KBB",
  vroom: "Vroom",
  carmax: "CarMax",
};

export default function ReceiptInputCard({
  onGenerate,
  onExtractionSuccess,
  onExtractionFields,
  onPhotosExtracted,
  isGenerating,
  generatingStep = 0,
  remainingFree,
  error,
  prefillText,
  prefillUrl,
  trackEvent,
  receiptToken,
  hasResult = false,
}: ReceiptInputCardProps) {
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<ExtractError | null>(null);
  const [extractStep, setExtractStep] = useState(0);

  // Structured fields
  const [fields, setFields] = useState<StructuredListingFields>({});

  // Vehicle details panel — collapsed by default
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);

  // Extraction state
  const [hasExtracted, setHasExtracted] = useState(false);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, string>>({});
  const [extractedFieldNames, setExtractedFieldNames] = useState<string[]>([]);
  const [missingFieldNames, setMissingFieldNames] = useState<string[]>([]);
  const [listingSource, setListingSource] = useState<string | null>(null);
  const [extractedRawText, setExtractedRawText] = useState<string | null>(null);

  // Dirty tracking
  const [dirtyFields, setDirtyFields] = useState<Set<keyof StructuredListingFields>>(new Set());

  // Dirty-after-result: tracks whether user changed inputs after a receipt was displayed
  const [dirtyAfterResult, setDirtyAfterResult] = useState(false);

  // Reset dirty flag and manual banner when a new result arrives
  useEffect(() => {
    if (hasResult) {
      setDirtyAfterResult(false);
      setShowManualFallbackBanner(false);
    }
  }, [hasResult]);

  // Manual form fallback banner — shown after extraction failure
  const [showManualFallbackBanner, setShowManualFallbackBanner] = useState(false);

  // VIN fallback state — shown after VIN autofill flow (not auto-triggered on extraction failure)
  const [showVinFallback, setShowVinFallback] = useState(false);
  const [vinFallbackValue, setVinFallbackValue] = useState("");
  const [vinLookupStatus, setVinLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [vinLookupError, setVinLookupError] = useState<string | null>(null);
  const [vinFilledNeedsPriceMileage, setVinFilledNeedsPriceMileage] = useState(false);
  const vinInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);

  // CarGurus search URL banner
  const [carGurusCleanId, setCarGurusCleanId] = useState<string | null>(null);
  const [showCarGurusBanner, setShowCarGurusBanner] = useState(false);

  // CarGurus bot-protection specific hint (shown after failed extraction)
  const [showCgPasteHint, setShowCgPasteHint] = useState(false);

  // Facebook Marketplace paste modal
  const [showFbPasteModal, setShowFbPasteModal] = useState(false);

  // Clean-and-extract success toast
  const [cleanToast, setCleanToast] = useState<{ durationSec: string } | null>(null);
  const cleanStartRef = useRef<number>(0);

  // Auto-extract on URL paste
  const [lastAutoExtractedUrl, setLastAutoExtractedUrl] = useState<string | null>(null);
  const autoExtractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for auto-focus
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prefill from SEO page
  useEffect(() => {
    if (prefillText) {
      setInputMode("text");
      setListingText(prefillText);
    }
  }, [prefillText]);

  // Prefill from ?url= param (extension, homepage paste, or any source)
  const prefillUrlHandled = useRef(false);
  useEffect(() => {
    if (prefillUrl && !prefillUrlHandled.current) {
      prefillUrlHandled.current = true;
      setInputMode("url");
      setListingUrl(prefillUrl);
      // Use a ref so the timer can be cancelled on unmount, and give React
      // enough time to fully mount before calling handleExtract
      autoExtractTimerRef.current = setTimeout(() => handleExtract(prefillUrl), 800);
    }
  }, [prefillUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup auto-extract timer on unmount
  useEffect(() => {
    return () => {
      if (autoExtractTimerRef.current) clearTimeout(autoExtractTimerRef.current);
    };
  }, []);

  // Animate extraction steps
  useEffect(() => {
    if (!isExtracting) {
      setExtractStep(0);
      return;
    }
    const timers = [
      setTimeout(() => setExtractStep(1), 3000),
      setTimeout(() => setExtractStep(2), 12000),
      setTimeout(() => setExtractStep(3), 22000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isExtracting]);

  // Auto-extract when user pastes a URL
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (!/^https?:\/\/.+/.test(pasted)) return;
    if (isExtracting || pasted === lastAutoExtractedUrl) return;

    setListingUrl(pasted);
    setLastAutoExtractedUrl(pasted);
    setExtractError(null);

    // Intercept Facebook Marketplace URLs — show paste modal immediately
    if (isFacebookMarketplaceUrl(pasted)) {
      setShowFbPasteModal(true);
      trackEvent?.("fb_marketplace_url_detected", { anon_id: receiptToken });
      return;
    }

    // Intercept CarGurus search URLs — show banner instead of auto-extracting
    if (isCarGurusSearchUrl(pasted)) {
      const id = extractCarGurusListingId(pasted);
      setCarGurusCleanId(id);
      setShowCarGurusBanner(true);
      return;
    }

    setShowCarGurusBanner(false);
    setCarGurusCleanId(null);

    if (autoExtractTimerRef.current) clearTimeout(autoExtractTimerRef.current);
    autoExtractTimerRef.current = setTimeout(() => handleExtract(pasted), 300);
  };

  const updateField = <K extends keyof StructuredListingFields>(
    key: K,
    value: StructuredListingFields[K]
  ) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (hasExtracted) {
      setDirtyFields((prev) => new Set(prev).add(key));
    }
    if (hasResult) setDirtyAfterResult(true);
  };

  // Required fields validation
  const filledRequired = REQUIRED_FIELDS.filter(
    (k) => fields[k] !== undefined && fields[k] !== null && fields[k] !== ""
  );
  const missingRequired = REQUIRED_FIELDS.filter(
    (k) => !filledRequired.includes(k)
  );
  const fieldsComplete = filledRequired.length === REQUIRED_FIELDS.length;
  const blockedByResult = hasResult && !dirtyAfterResult;
  const canGenerate = !isGenerating && !isExtracting && fieldsComplete && !blockedByResult;

  // Can extract?
  const canExtractUrl = inputMode === "url" && listingUrl.trim().length > 0;
  const canExtractText = inputMode === "text" && listingText.trim().length >= 20;

  // Opens the manual form after extraction failure
  const showManualForm = () => {
    setDetailsOpen(true);
    setShowManualFallbackBanner(true);
    trackEvent?.("manual_form_shown", { anon_id: receiptToken, trigger: "extraction_failure" });
    setTimeout(() => {
      document.getElementById("vehicle-details-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Unified extract handler for both URL and text modes
  const handleExtract = async (urlOverride?: string) => {
    // Intercept Facebook Marketplace URLs before any API call
    const urlToCheck = urlOverride ?? (inputMode === "url" ? listingUrl.trim() : "");
    if (urlToCheck && isFacebookMarketplaceUrl(urlToCheck)) {
      setShowFbPasteModal(true);
      trackEvent?.("fb_marketplace_url_detected", { anon_id: receiptToken, trigger: "manual_extract" });
      return;
    }

    trackEvent?.("receipt_extract_clicked", { input_mode: inputMode, anon_id: receiptToken });

    setIsExtracting(true);
    setExtractError(null);
    setShowManualFallbackBanner(false);
    setShowCgPasteHint(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const bodyPayload: Record<string, string> = {};
      // When urlOverride is passed (auto-extract on prefill), always treat as URL
      // regardless of inputMode state which may not have settled yet
      if (urlOverride || inputMode === "url") {
        bodyPayload.url = urlOverride ?? listingUrl.trim();
      } else {
        bodyPayload.text = listingText.trim();
      }

      const res = await fetch("/api/receipt/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        trackEvent?.("receipt_extract_failed", {
          input_mode: inputMode,
          anon_id: receiptToken,
          error: data.error || "extract_failed",
          failure_reason: data.diagnostics?.failureReason || data.error || "api_error",
          bot_protection: data.diagnostics?.botProtectionDetected || false,
          input_length: inputMode === "url" ? (urlOverride ?? listingUrl.trim()).length : listingText.trim().length,
        });

        // Show specific error based on diagnostics
        if (data.diagnostics?.botProtectionDetected) {
          const urlValue = urlOverride ?? listingUrl.trim();
          if (urlValue.toLowerCase().includes("cargurus.com")) {
            setShowCgPasteHint(true);
            setExtractError({
              message: "CarGurus blocked auto-fetch. Copy the listing details and paste them below."
            });
          } else {
            setExtractError({
              message: "This site blocked auto-extraction."
            });
          }
          showManualForm();
        } else if (data.diagnostics?.failureReason === "timeout") {
          setExtractError({
            message: "Extraction timed out — please fill in the details below."
          });
          showManualForm();
        } else if (data.diagnostics?.failureReason === "listing_sold") {
          setExtractError({
            message: "This listing has already sold or been removed. Try a different listing."
          });
          // Don't show manual form for sold listings — nothing to fill in
        } else if (data.diagnostics?.failureReason === "search_page") {
          const urlValue = urlOverride ?? listingUrl.trim();
          const id = extractCarGurusListingId(urlValue);
          if (id) {
            setCarGurusCleanId(id);
            setShowCarGurusBanner(true);
            setExtractError(null);
          } else {
            setExtractError({
              message: "That looks like a search page. Open a specific listing and copy its URL."
            });
            showManualForm();
          }
        } else {
          setExtractError({
            message: "Couldn't extract listing details."
          });
          showManualForm();
        }
        return;
      }

      setShowManualFallbackBanner(false);

      // Merge extracted fields into state, skipping dirty fields
      const f: FetchedListingFields = data.fields;
      setFields((prev) => {
        const merged = { ...prev };
        const fieldMap: Partial<Record<keyof StructuredListingFields, unknown>> = {
          year: f.year,
          make: f.make,
          model: f.model,
          trim: f.trim,
          mileage: f.mileage,
          price: f.price,
          vin: f.vin,
          location: f.location,
          title_status: f.title_status,
          accidents_reported: f.accidents_reported,
        };
        for (const [key, val] of Object.entries(fieldMap)) {
          const k = key as keyof StructuredListingFields;
          if (val !== undefined && val !== null && !dirtyFields.has(k)) {
            (merged as Record<string, unknown>)[key] = val;
          }
        }
        return merged;
      });

      // Store extraction metadata
      setHasExtracted(true);
      setExtractionId(data.extraction_id || null);
      setExtractedRawText(data.raw_text || null);
      // Auto-open details panel always after extraction so user can verify/fill gaps
      setDetailsOpen(true);

      // Show "Cleaned & extracted" toast if this was a clean-and-extract flow
      if (cleanStartRef.current > 0) {
        const sec = ((Date.now() - cleanStartRef.current) / 1000).toFixed(1);
        setCleanToast({ durationSec: sec });
        cleanStartRef.current = 0;
        setTimeout(() => setCleanToast(null), 4000);
      }
      setFieldConfidence(data.field_confidence || {});
      setExtractedFieldNames(data.extractedFields || []);
      setMissingFieldNames(data.missingFields || []);
      setListingSource(data.listing_source || null);

      // Track successful extraction
      trackEvent?.("receipt_extract_succeeded", {
        input_mode: inputMode,
        anon_id: receiptToken,
        fields_extracted: data.extractedFields?.length ?? 0,
        fields_missing: data.missingFields?.length ?? 0,
        listing_source: data.listing_source || null,
      });

      // Auto-expand form so user can confirm extracted fields
      setDetailsOpen(true);
      setTimeout(() => {
        document.getElementById("vehicle-details-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);

      // Notify parent for email gate
      const summary = [f.year, f.make, f.model].filter(Boolean).join(" ");
      onExtractionSuccess?.(summary || "your vehicle");
      onExtractionFields?.({ year: f.year, make: f.make, model: f.model, trim: f.trim, mileage: f.mileage });
      if (data.photo_urls?.length) onPhotosExtracted?.(data.photo_urls);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        trackEvent?.("receipt_extract_failed", {
          input_mode: inputMode,
          anon_id: receiptToken,
          error: "client_timeout",
          failure_reason: "client_timeout",
          input_length: inputMode === "url" ? (urlOverride ?? listingUrl.trim()).length : listingText.trim().length,
        });
        setExtractError({ message: "Extraction timed out — please fill in the details below." });
        showManualForm();
      } else {
        trackEvent?.("receipt_extract_failed", {
          input_mode: inputMode,
          anon_id: receiptToken,
          error: err instanceof Error ? err.message : "network_error",
          failure_reason: "network_error",
          input_length: inputMode === "url" ? (urlOverride ?? listingUrl.trim()).length : listingText.trim().length,
        });
        setExtractError({
          message: "Network error — try again or paste the listing text"
        });
        showManualForm();
      }
    } finally {
      clearTimeout(timeoutId);
      setIsExtracting(false);
    }
  };

  // VIN lookup handler — called when user submits VIN in fallback mode
  const handleVinLookup = async () => {
    const vin = vinFallbackValue.trim().toUpperCase();
    if (vin.length !== 17) {
      setVinLookupError("Please enter the full 17-character VIN.");
      return;
    }
    setVinLookupStatus("loading");
    setVinLookupError(null);
    try {
      const res = await fetch("/api/receipt/vin-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const data = await res.json();
      if (!data.success) {
        setVinLookupStatus("error");
        setVinLookupError(data.error || "VIN not recognised — try entering details manually.");
        return;
      }
      // Merge decoded fields
      setFields((prev) => ({
        ...prev,
        vin,
        year: data.fields.year ?? prev.year,
        make: data.fields.make ?? prev.make,
        model: data.fields.model ?? prev.model,
        trim: data.fields.trim ?? prev.trim,
      }));
      if (data.photo_urls?.length) onPhotosExtracted?.(data.photo_urls);
      setHasExtracted(true);
      setVinLookupStatus("success");
      setShowVinFallback(false);
      setExtractError(null);
      setDetailsOpen(true);
      setVinFilledNeedsPriceMileage(true);
      trackEvent?.("vin_fallback_lookup_success", { vin, anon_id: receiptToken });
      setTimeout(() => {
        document.getElementById("vehicle-details-section")?.scrollIntoView({ behavior: "smooth" });
        priceInputRef.current?.focus();
      }, 150);
    } catch {
      setVinLookupStatus("error");
      setVinLookupError("Network error — check your connection and try again.");
    }
  };

  // Debounce: ignore rapid clicks within 1s
  const lastGenerateRef = useRef(0);

  const handleGenerate = () => {
    const now = Date.now();
    if (now - lastGenerateRef.current < 1000) return;
    if (isGenerating || isExtracting) return;
    lastGenerateRef.current = now;

    // Build confidence map for VehicleFacts
    const confidenceFields: Record<string, string> = {};
    for (const key of Object.keys(fields)) {
      if (dirtyFields.has(key as keyof StructuredListingFields)) {
        confidenceFields[key] = "user";
      } else if (fieldConfidence[key] === "extracted") {
        confidenceFields[key] = "extracted";
      } else if (fieldConfidence[key]) {
        confidenceFields[key] = fieldConfidence[key];
      } else {
        confidenceFields[key] = "unknown";
      }
    }

    trackEvent?.("vehicle_facts_form_submitted", {
      input_mode: inputMode,
      anon_id: receiptToken,
      has_extraction: hasExtracted,
      fields_filled: filledRequired.length,
      confidence_fields: confidenceFields,
      listing_source: listingSource || (inputMode === "text" ? "text_paste" : "manual"),
    });

    if (showManualFallbackBanner || (!hasExtracted && inputMode === "url")) {
      trackEvent?.("manual_form_submitted", {
        anon_id: receiptToken,
        fields_filled: filledRequired.length,
        input_mode: inputMode,
      });
    }

    onGenerate({
      listing_url: inputMode === "url" ? listingUrl.trim() : undefined,
      // In URL mode, pass the scraped raw text so the AI has full listing context
      listing_text: inputMode === "text" ? listingText.trim() : (extractedRawText || undefined),
      fields,
      extraction_id: extractionId || undefined,
    });
  };

  // Count how many detail fields the user has filled (for the toggle label)
  const detailFieldCount = Object.values(fields).filter(
    (v) => v !== undefined && v !== null && v !== ""
  ).length;

  return (
    <div className="dark-inputs bg-white/[0.05] rounded-2xl border border-white/10 shadow-sm overflow-hidden">
      {/* Facebook Marketplace paste modal */}
      {showFbPasteModal && (
        <FbMarketplacePasteModal
          onAnalyze={(text) => {
            setShowFbPasteModal(false);
            setInputMode("text");
            setListingText(text);
            // Trigger extraction with the pasted text
            setTimeout(() => handleExtract(), 50);
          }}
          onClose={() => setShowFbPasteModal(false)}
        />
      )}

      {/* Clean-and-extract success toast */}
      <AnimatePresence>
        {cleanToast && (
          <motion.div
            key="clean-toast"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 bg-[#00d97e]/10 border-b border-[#00d97e]/20 px-4 py-2 text-sm text-[#00d97e]"
          >
            <Check className="h-4 w-4 text-[#00d97e] shrink-0" />
            <span>Cleaned &amp; extracted in {cleanToast.durationSec}s</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab toggle */}
      <div className="flex border-b border-white/[0.08]">
        <button
          onClick={() => {
            setInputMode("url");
            setShowVinFallback(false);
            trackEvent?.("entry_mode_selected", { mode: "url", context: "receipt_page" });
          }}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            inputMode === "url"
              ? "text-[#00d97e] bg-[#00d97e]/10 border-b-2 border-[#00d97e]"
              : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
          }`}
        >
          <Link className="w-4 h-4" /> Paste URL
        </button>
        <button
          onClick={() => {
            setInputMode("text");
            setShowVinFallback(false);
            trackEvent?.("entry_mode_selected", { mode: "text", context: "receipt_page" });
          }}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            inputMode === "text"
              ? "text-[#00d97e] bg-[#00d97e]/10 border-b-2 border-[#00d97e]"
              : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
          }`}
        >
          <FileText className="w-4 h-4" /> Paste Text <span className="text-xs text-white/30 ml-0.5 font-normal">(advanced)</span>
        </button>
        <button
          onClick={() => {
            setInputMode("vin");
            setShowVinFallback(true);
            setVinFallbackValue("");
            setVinLookupError(null);
            trackEvent?.("entry_mode_selected", { mode: "vin", context: "receipt_page" });
          }}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            inputMode === "vin"
              ? "text-[#00d97e] bg-[#00d97e]/10 border-b-2 border-[#00d97e]"
              : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Enter VIN
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* URL input */}
        {inputMode === "url" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={listingUrl}
                onChange={(e) => {
                  setListingUrl(e.target.value);
                  setExtractError(null);
                  setShowVinFallback(false);
                  setShowManualFallbackBanner(false);
                  setVinFallbackValue("");
                  setVinLookupStatus("idle");
                  setVinLookupError(null);
                  if (hasResult) setDirtyAfterResult(true);
                }}
                onPaste={handleUrlPaste}
                placeholder="https://www.cargurus.com/Cars/..."
                className="form-input flex-1"
                disabled={isGenerating || isExtracting}
              />
              <button
                onClick={() => handleExtract()}
                disabled={!canExtractUrl || isExtracting || isGenerating}
                className={`px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  !canExtractUrl || isExtracting
                    ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {isExtracting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : hasExtracted ? (
                  "Re-extract"
                ) : (
                  "Extract"
                )}
              </button>
            </div>

            {/* CarGurus search URL banner */}
            {showCarGurusBanner && !isExtracting && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="flex-1">
                  {carGurusCleanId ? (
                    <>
                      <span className="text-amber-300">
                        Detected a search page URL. Clean it to the exact listing?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const cleanUrl = `https://www.cargurus.com/details/${carGurusCleanId}`;
                          setListingUrl(cleanUrl);
                          setShowCarGurusBanner(false);
                          trackEvent?.("messy_url_cleaned", { listing_id: carGurusCleanId, source: "cargurus" });
                          cleanStartRef.current = Date.now();
                          handleExtract(cleanUrl);
                        }}
                        className="ml-2 font-semibold text-amber-400 underline hover:text-amber-300"
                      >
                        Clean &amp; Extract
                      </button>
                    </>
                  ) : (
                    <span className="text-amber-300">
                      Couldn&apos;t find a listing ID in that URL.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setInputMode("text");
                          setShowCarGurusBanner(false);
                          setTimeout(() => textareaRef.current?.focus(), 100);
                        }}
                        className="font-semibold underline hover:text-amber-900"
                      >
                        Paste the full page text instead
                      </button>{" "}
                      (Ctrl+A → Ctrl+C on the listing page).
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCarGurusBanner(false)}
                  className="text-amber-400/70 hover:text-amber-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Always-visible fallback hint */}
            {!showCarGurusBanner && (
              <p className="text-xs text-white/35">
                Site blocking extraction?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setInputMode("text");
                    setTimeout(() => textareaRef.current?.focus(), 100);
                    trackEvent?.("helper_text_switch_to_text", { from: "url_fallback_hint" });
                  }}
                  className="text-[#00d97e]/70 underline hover:text-[#00d97e]"
                >
                  Paste the full page text instead
                </button>
                {" · "}
                <button
                  type="button"
                  onClick={() => {
                    setShowFbPasteModal(true);
                    trackEvent?.("fb_paste_modal_opened", { from: "url_fallback_hint" });
                  }}
                  className="text-[#00d97e]/70 underline hover:text-[#00d97e]"
                >
                  Facebook Marketplace?
                </button>
              </p>
            )}

            {/* CarGurus bot-protection hint — shown after a blocked CarGurus extraction */}
            {showCgPasteHint && !isExtracting && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-amber-300 font-medium text-xs">CarGurus blocked auto-fetch</p>
                  <p className="text-amber-400/80 text-xs mt-0.5">
                    On the listing, copy the specs panel on the right side, then{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setShowCgPasteHint(false);
                        setExtractError(null);
                        setInputMode("text");
                        setTimeout(() => textareaRef.current?.focus(), 100);
                        trackEvent?.("cg_paste_hint_clicked", { anon_id: receiptToken });
                      }}
                      className="font-semibold underline text-amber-300 hover:text-amber-200"
                    >
                      switch to paste mode →
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* Extraction loading with step progress */}
            {isExtracting && (
              <div className="flex items-center gap-2 text-sm text-[#00d97e] bg-[#00d97e]/10 p-3 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <span>{EXTRACT_STEPS[extractStep] || EXTRACT_STEPS[0]}</span>
              </div>
            )}

            {/* Extract error + VIN fallback */}
            {extractError && !isExtracting && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{extractError.message}</span>
                </div>

                {showVinFallback && (
                  <div className="bg-white/[0.05] border border-white/10 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#00d97e] shrink-0" />
                      <p className="text-sm font-semibold text-white">Enter the VIN to autofill</p>
                    </div>
                    <p className="text-xs text-white/50">
                      Found on the dashboard, door jamb, or listing page. We&apos;ll decode it and fill in the details automatically.
                    </p>
                    <div className="flex gap-2">
                      <input
                        ref={vinInputRef}
                        type="text"
                        maxLength={17}
                        placeholder="17-character VIN"
                        value={vinFallbackValue}
                        onChange={(e) => {
                          setVinFallbackValue(e.target.value.toUpperCase());
                          setVinLookupError(null);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleVinLookup(); }}
                        className="flex-1 px-3 py-2 text-sm font-mono bg-white/[0.06] border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-[#00d97e]/40 focus:border-[#00d97e]/50 outline-none uppercase tracking-wider placeholder-white/25"
                        disabled={vinLookupStatus === "loading"}
                      />
                      <button
                        onClick={handleVinLookup}
                        disabled={vinFallbackValue.length !== 17 || vinLookupStatus === "loading"}
                        className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                      >
                        {vinLookupStatus === "loading" ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up…</>
                        ) : (
                          "Autofill"
                        )}
                      </button>
                    </div>
                    {vinLookupError && (
                      <p className="text-xs text-red-600">{vinLookupError}</p>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => {
                          setShowVinFallback(false);
                          setInputMode("text");
                          setTimeout(() => textareaRef.current?.focus(), 100);
                          trackEvent?.("receipt_extract_fallback_used", { input_mode: "url", trigger: "switch_to_text", anon_id: receiptToken });
                        }}
                        className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] underline"
                      >
                        Paste listing text instead
                      </button>
                      <button
                        onClick={() => {
                          setShowVinFallback(false);
                          setDetailsOpen(true);
                          setTimeout(() => {
                            document.getElementById("vehicle-details-section")?.scrollIntoView({ behavior: "smooth" });
                          }, 100);
                          trackEvent?.("receipt_extract_fallback_used", { input_mode: "url", trigger: "fill_manually", anon_id: receiptToken });
                        }}
                        className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] underline"
                      >
                        Fill in manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isExtracting && !extractError && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/30">
                  CarGurus extraction works now —{" "}
                  <span className="text-white/20">AutoTrader, Cars.com & more coming soon</span>
                </p>
                {!hasExtracted && (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailsOpen(true);
                      setTimeout(() => {
                        document.getElementById("vehicle-details-section")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                      trackEvent?.("manual_entry_shortcut_clicked", { anon_id: receiptToken });
                    }}
                    className="text-xs text-[#00d97e]/70 hover:text-[#00d97e] underline whitespace-nowrap ml-2"
                  >
                    Enter manually ↓
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Text input */}
        {inputMode === "text" && (
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              value={listingText}
              onChange={(e) => {
                setListingText(e.target.value);
                if (hasResult) setDirtyAfterResult(true);
              }}
              placeholder={`Paste the listing details here...\n\nExample:\n2021 Toyota RAV4 Prime XSE\n45,000 miles · $32,500\nDenver, CO · Clean title, 1 owner`}
              rows={6}
              maxLength={8000}
              className="w-full px-4 py-3 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder-white/25 resize-none focus:border-[#00d97e]/50 focus:outline-none focus:ring-1 focus:ring-[#00d97e]/30"
              disabled={isGenerating || isExtracting}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-white/30">
                Paste the listing text. We&apos;ll extract year, price, mileage, location.
              </span>
              <span className="text-xs text-white/30">
                {listingText.length}/8000
              </span>
            </div>

            {/* Extract button for text mode */}
            <button
              onClick={() => handleExtract()}
              disabled={!canExtractText || isExtracting || isGenerating}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !canExtractText || isExtracting
                  ? "bg-white/[0.05] text-white/30 cursor-not-allowed"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {isExtracting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {EXTRACT_STEPS[extractStep] || EXTRACT_STEPS[0]}
                </span>
              ) : hasExtracted ? (
                "Re-extract Details"
              ) : (
                "Extract Details"
              )}
            </button>

            {/* Extract error with fallback */}
            {extractError && !isExtracting && (
              <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${
                extractError.isWarning
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {extractError.isWarning ? (
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <span>{extractError.message}</span>
                  <button
                    onClick={() => {
                      setDetailsOpen(true);
                      setTimeout(() => {
                        document.getElementById("vehicle-details-section")?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                      trackEvent?.("receipt_extract_fallback_used", { input_mode: "text", trigger: "fill_manually", anon_id: receiptToken });
                    }}
                    className="block mt-1.5 text-[#00d97e]/70 hover:text-[#00d97e] underline text-xs font-medium"
                  >
                    Fill in the required fields manually
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIN entry mode — shown when user clicks "Enter VIN" tab */}
        {inputMode === "vin" && (
          <div className="bg-white/[0.05] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00d97e] shrink-0" />
              <p className="text-sm font-semibold text-white">Enter the VIN to autofill</p>
            </div>
            <p className="text-xs text-white/50">
              Found on the dashboard, door jamb, or listing page. We&apos;ll decode it and fill in the details automatically.
            </p>
            <div className="flex gap-2">
              <input
                ref={vinInputRef}
                type="text"
                maxLength={17}
                placeholder="17-character VIN"
                value={vinFallbackValue}
                onChange={(e) => {
                  setVinFallbackValue(e.target.value.toUpperCase());
                  setVinLookupError(null);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleVinLookup(); }}
                className="flex-1 px-3 py-2 text-sm font-mono bg-white/[0.06] border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-[#00d97e]/40 focus:border-[#00d97e]/50 outline-none uppercase tracking-wider placeholder-white/25"
                disabled={vinLookupStatus === "loading"}
              />
              <button
                onClick={handleVinLookup}
                disabled={vinFallbackValue.length !== 17 || vinLookupStatus === "loading"}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                {vinLookupStatus === "loading" ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up…</>
                ) : (
                  "Autofill"
                )}
              </button>
            </div>
            {vinLookupError && (
              <p className="text-xs text-red-600">{vinLookupError}</p>
            )}
          </div>
        )}

        {/* Extraction Result Chips */}
        {hasExtracted && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {extractedFieldNames.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#00d97e]/10 text-[#00d97e] border border-[#00d97e]/20"
                >
                  <Check className="w-3 h-3" />
                  {FIELD_LABELS[f] || f}
                  {dirtyFields.has(f as keyof StructuredListingFields) && (
                    <span className="text-blue-600">*</span>
                  )}
                </span>
              ))}
              {missingFieldNames
                .filter((f) => REQUIRED_FIELDS.includes(f as keyof StructuredListingFields))
                .map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"
                  >
                    <X className="w-3 h-3" />
                    {FIELD_LABELS[f] || f}
                  </span>
                ))}
              {missingFieldNames
                .filter((f) => !REQUIRED_FIELDS.includes(f as keyof StructuredListingFields))
                .map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/[0.05] text-white/40 border border-white/10"
                  >
                    {FIELD_LABELS[f] || f}
                  </span>
                ))}
            </div>
            {listingSource && listingSource !== "text_paste" && (
              <p className="text-xs text-white/30">
                Source: {SOURCE_DISPLAY_LABELS[listingSource] ?? listingSource}
              </p>
            )}
          </div>
        )}

        {/* Vehicle Details — collapsed by default, "Add details" toggle */}
        <button
          type="button"
          id="vehicle-details-section"
          onClick={() => {
            const opening = !detailsOpen;
            setDetailsOpen(opening);
            if (opening) {
              trackEvent?.("vehicle_facts_form_shown", {
                fields_extracted: extractedFieldNames.length,
                input_mode: inputMode,
                anon_id: receiptToken,
              });
            }
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white/70 transition-colors w-full"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              detailsOpen ? "rotate-180" : ""
            }`}
          />
          {detailsOpen
            ? "Hide details"
            : hasExtracted
              ? "Confirm these details"
              : extractError
                ? "Enter vehicle details"
                : "Add details"}
          {!detailsOpen && detailFieldCount > 0 && (
            <span className="text-xs text-[#00d97e]/70 ml-1">
              ({detailFieldCount} field{detailFieldCount !== 1 ? "s" : ""} filled)
            </span>
          )}
          {!detailsOpen && hasExtracted && missingRequired.length > 0 && (
            <span className="text-xs text-amber-400 ml-1">
              — {missingRequired.length} required missing
            </span>
          )}
        </button>

        {detailsOpen && (
          <div className="space-y-3">
            {/* Extraction failure banner */}
            {showManualFallbackBanner && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  We couldn&apos;t extract the listing automatically. Please fill in the details below.
                </p>
              </div>
            )}
            {/* VIN-fill prompt — shown after VIN autofill when price/mileage still missing */}
            {vinFilledNeedsPriceMileage && !fields.price && !fields.mileage && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <span className="text-amber-400 text-base">✏️</span>
                <p className="text-xs text-amber-300 font-medium">
                  Almost there — add the asking price and mileage from the listing to generate your receipt.
                </p>
              </div>
            )}
            {/* Row 1: Price, Mileage */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>
                  Price ($) <span className="text-red-400">*</span>
                </label>
                <input
                  ref={priceInputRef}
                  type="number"
                  value={fields.price ?? ""}
                  onChange={(e) => {
                    updateField(
                      "price",
                      e.target.value ? Math.max(0, Number(e.target.value)) : undefined
                    );
                    if (vinFilledNeedsPriceMileage) setVinFilledNeedsPriceMileage(false);
                  }}
                  placeholder="32500"
                  min="0"
                  className={`${getInputClass(fieldConfidence.price, dirtyFields.has("price"))} ${vinFilledNeedsPriceMileage && !fields.price ? "ring-2 ring-amber-400 border-amber-400" : ""}`}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  Mileage <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={fields.mileage ?? ""}
                  onChange={(e) => {
                    updateField(
                      "mileage",
                      e.target.value ? Math.max(0, Number(e.target.value)) : undefined
                    );
                    if (vinFilledNeedsPriceMileage) setVinFilledNeedsPriceMileage(false);
                  }}
                  placeholder="45000"
                  min="0"
                  className={`${getInputClass(fieldConfidence.mileage, dirtyFields.has("mileage"))} ${vinFilledNeedsPriceMileage && !fields.mileage ? "ring-2 ring-amber-400 border-amber-400" : ""}`}
                  disabled={isGenerating}
                />
              </div>
            </div>

            {/* VIN — shown prominently after price/mileage */}
            <div>
              <label className={LABEL_CLASS}>
                VIN{" "}
                <span className="text-gray-400 font-normal">(17 characters — improves accuracy)</span>
              </label>
              <input
                type="text"
                value={fields.vin ?? ""}
                onChange={(e) =>
                  updateField("vin", e.target.value.toUpperCase() || undefined)
                }
                placeholder="e.g. 1HGBH41JXMN109186"
                maxLength={17}
                className={getInputClass(fieldConfidence.vin, dirtyFields.has("vin"))}
                disabled={isGenerating}
              />
              {/* Nudge when extraction succeeded but VIN wasn't available (e.g. CarGurus) */}
              {hasExtracted && !fields.vin && (
                <p className="mt-1.5 text-xs text-amber-400/80">
                  VIN wasn&apos;t found on this listing — enter it above for richer analysis and recall checks.
                  <span className="ml-1 text-white/30">(Found on dashboard, door jamb, or title)</span>
                </p>
              )}
            </div>

            {/* Row 2: Year, Make, Model */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLASS}>
                  Year <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={fields.year ?? ""}
                  onChange={(e) =>
                    updateField(
                      "year",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                  placeholder="2021"
                  className={getInputClass(
                    fieldConfidence.year,
                    dirtyFields.has("year")
                  )}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  Make <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={fields.make ?? ""}
                  onChange={(e) =>
                    updateField("make", e.target.value || undefined)
                  }
                  placeholder="Toyota"
                  className={getInputClass(
                    fieldConfidence.make,
                    dirtyFields.has("make")
                  )}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  Model <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={fields.model ?? ""}
                  onChange={(e) =>
                    updateField("model", e.target.value || undefined)
                  }
                  placeholder="RAV4 Prime"
                  className={getInputClass(
                    fieldConfidence.model,
                    dirtyFields.has("model")
                  )}
                  disabled={isGenerating}
                />
              </div>
            </div>

            {/* Row 3: Trim, ZIP/Postcode, Country */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL_CLASS}>Trim</label>
                <input
                  type="text"
                  value={fields.trim ?? ""}
                  onChange={(e) =>
                    updateField("trim", e.target.value || undefined)
                  }
                  placeholder="XSE"
                  className={getInputClass(
                    fieldConfidence.trim,
                    dirtyFields.has("trim")
                  )}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>ZIP / Postcode</label>
                <input
                  type="text"
                  value={fields.zip_or_postcode ?? ""}
                  onChange={(e) =>
                    updateField("zip_or_postcode", e.target.value || undefined)
                  }
                  placeholder="80202"
                  className={getInputClass(undefined, dirtyFields.has("zip_or_postcode"))}
                  disabled={isGenerating}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Country</label>
                <select
                  value={fields.country ?? ""}
                  onChange={(e) =>
                    updateField(
                      "country",
                      (e.target.value as StructuredListingFields["country"]) ||
                        undefined
                    )
                  }
                  className={getInputClass(undefined, dirtyFields.has("country"))}
                  disabled={isGenerating}
                >
                  <option value="">—</option>
                  <option value="US">US</option>
                  <option value="UK">UK</option>
                  <option value="CA">CA</option>
                  <option value="AU">AU</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            {/* Row 4: Seller Type, Title Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS}>Seller Type</label>
                <select
                  value={fields.seller_type ?? ""}
                  onChange={(e) =>
                    updateField(
                      "seller_type",
                      (e.target.value as StructuredListingFields["seller_type"]) ||
                        undefined
                    )
                  }
                  className={getInputClass(undefined, dirtyFields.has("seller_type"))}
                  disabled={isGenerating}
                >
                  <option value="">—</option>
                  <option value="dealer">Dealer</option>
                  <option value="private">Private</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Title Status</label>
                <select
                  value={fields.title_status ?? ""}
                  onChange={(e) =>
                    updateField(
                      "title_status",
                      (e.target.value as StructuredListingFields["title_status"]) ||
                        undefined
                    )
                  }
                  className={getInputClass(undefined, dirtyFields.has("title_status"))}
                  disabled={isGenerating}
                >
                  <option value="">—</option>
                  <option value="clean">Clean</option>
                  <option value="salvage">Salvage</option>
                  <option value="rebuilt">Rebuilt</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            {/* Additional Details (nested collapsible) */}
            <button
              type="button"
              onClick={() => setOptionalOpen(!optionalOpen)}
              className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white/70 transition-colors"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  optionalOpen ? "rotate-180" : ""
                }`}
              />
              Additional Details
            </button>

            {optionalOpen && (
              <div className="space-y-3 pl-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Accidents Reported</label>
                    <select
                      value={fields.accidents_reported ?? ""}
                      onChange={(e) =>
                        updateField(
                          "accidents_reported",
                          (e.target.value as StructuredListingFields["accidents_reported"]) ||
                            undefined
                        )
                      }
                      className={getInputClass(undefined, dirtyFields.has("accidents_reported"))}
                      disabled={isGenerating}
                    >
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Service History</label>
                    <select
                      value={fields.service_history ?? ""}
                      onChange={(e) =>
                        updateField(
                          "service_history",
                          (e.target.value as StructuredListingFields["service_history"]) ||
                            undefined
                        )
                      }
                      className={getInputClass(undefined, dirtyFields.has("service_history"))}
                      disabled={isGenerating}
                    >
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL_CLASS}>Owners</label>
                    <input
                      type="number"
                      value={fields.owners ?? ""}
                      onChange={(e) =>
                        updateField(
                          "owners",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      placeholder="1"
                      min={1}
                      className={getInputClass(undefined, dirtyFields.has("owners"))}
                      disabled={isGenerating}
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Carfax Available</label>
                    <select
                      value={fields.carfax_available ?? ""}
                      onChange={(e) =>
                        updateField(
                          "carfax_available",
                          (e.target.value as StructuredListingFields["carfax_available"]) ||
                            undefined
                        )
                      }
                      className={getInputClass(undefined, dirtyFields.has("carfax_available"))}
                      disabled={isGenerating}
                    >
                      <option value="">—</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Payment Method</label>
                    <select
                      value={fields.financing_vs_cash ?? ""}
                      onChange={(e) =>
                        updateField(
                          "financing_vs_cash",
                          (e.target.value as StructuredListingFields["financing_vs_cash"]) ||
                            undefined
                        )
                      }
                      className={getInputClass(undefined, dirtyFields.has("financing_vs_cash"))}
                      disabled={isGenerating}
                    >
                      <option value="">—</option>
                      <option value="financing">Financing</option>
                      <option value="cash">Cash</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error from API */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
            canGenerate
              ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090] hover:shadow-lg hover:shadow-[#00d97e]/20"
              : "bg-white/[0.07] text-white/30 cursor-not-allowed"
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {GENERATE_STEPS[generatingStep] || GENERATE_STEPS[0]}
            </>
          ) : blockedByResult ? (
            <>
              <Sparkles className="w-5 h-5" />
              Edit details above to regenerate
            </>
          ) : hasResult && dirtyAfterResult ? (
            <>
              <Sparkles className="w-5 h-5" />
              Regenerate Receipt
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Receipt
            </>
          )}
        </button>

        {/* Missing required fields hint */}
        {!canGenerate && !isGenerating && !isExtracting && missingRequired.length > 0 && (
          <p className="text-center text-xs text-amber-400">
            Fill in: {missingRequired.map((k) => FIELD_LABELS[k] || k).join(", ")}
          </p>
        )}

        {/* Free limit badge */}
        {remainingFree !== null && (
          <p className="text-center text-xs text-white/30">
            {remainingFree > 0
              ? `${remainingFree} free receipt${remainingFree !== 1 ? "s" : ""} remaining today`
              : "Free daily limit reached — resets at midnight UTC"}
          </p>
        )}
      </div>
    </div>
  );
}
