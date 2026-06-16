/**
 * ReceiptInputCard — URL/listing paste as primary entry method
 *
 * Primary flow:
 *   1. Paste listing URL or text → auto-extract fields
 *   2. If VIN not found → amber compel prompt
 *   3. Confirm / fill missing details in manual form
 *   4. Generate Receipt
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  ShieldCheck,
  Link,
  FileText,
  X,
} from "lucide-react";
import type { FetchedListingFields, StructuredListingFields } from "@/types/receipt";
import FbMarketplacePasteModal from "@/components/receipt/FbMarketplacePasteModal";

// ── EV make/model catalog ─────────────────────────────────────────────────────

const EV_CATALOG: Record<string, string[]> = {
  "Tesla":        ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  "Chevrolet":    ["Bolt EV", "Bolt EUV", "Equinox EV", "Blazer EV", "Silverado EV"],
  "Ford":         ["Mustang Mach-E", "F-150 Lightning"],
  "Hyundai":      ["Ioniq 5", "Ioniq 6", "Kona Electric"],
  "Kia":          ["EV6", "EV9", "Niro EV"],
  "Rivian":       ["R1T", "R1S"],
  "Volkswagen":   ["ID.4", "ID.3"],
  "BMW":          ["iX", "i4", "i5", "i7", "i3"],
  "Nissan":       ["Leaf", "Ariya"],
  "Audi":         ["Q4 e-tron", "Q8 e-tron", "e-tron GT", "e-tron"],
  "Mercedes-Benz":["EQS", "EQE", "EQB", "EQA"],
  "Cadillac":     ["Lyriq", "Optiq"],
  "Genesis":      ["GV60", "GV70 Electrified", "G80 Electrified"],
  "Volvo":        ["C40 Recharge", "XC40 Recharge"],
  "Polestar":     ["Polestar 2"],
  "Porsche":      ["Taycan", "Macan"],
  "Lucid":        ["Air"],
  "Jaguar":       ["I-Pace"],
  "Toyota":       ["bZ4X"],
  "Subaru":       ["Solterra"],
  "Mini":         ["Cooper SE", "Countryman"],
  "Other":        [],
};

const EV_MAKES = Object.keys(EV_CATALOG);

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2009 }, (_, i) => CURRENT_YEAR - i);

// ── Types ─────────────────────────────────────────────────────────────────────

type PasteMode = "url" | "text";

type ExtractError = { message: string; isWarning?: boolean };

interface ReceiptInputCardProps {
  onGenerate: (data: {
    listing_url?: string;
    listing_text?: string;
    fields: StructuredListingFields;
    extraction_id?: string;
    input_mode?: string;
    dealer_info?: { id: string; name: string; slug: string; logo_url: string | null } | null;
    inventory_id?: string | null;
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
  prefillVin?: string | null;
  trackEvent?: (eventName: string, eventData?: { [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | unknown[] }) => void | Promise<void>;
  receiptToken?: string;
  hasResult?: boolean;
}

const GENERATE_STEPS = ["Checking risks...", "Analyzing pricing...", "Building your checklist..."];

// ── Extraction helpers (paste mode) ───────────────────────────────────────────

const EXTRACT_STEPS = [
  "Fetching listing page...",
  "Rendering JS — this takes a moment...",
  "Scanning for vehicle data...",
  "Almost there...",
  "Still working — this listing takes extra time...",
  "Hang tight, nearly done...",
];

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
  } catch { return null; }
}

function isCarGurusSearchUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("cargurus.com") && (lower.includes("/cars/") || lower.includes("/shopping/results"));
}

function isFacebookMarketplaceUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("facebook.com/marketplace") || lower.includes("facebook.com/commerce") || lower.includes("fb.com/marketplace");
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  prefillVin,
  trackEvent,
  receiptToken,
  hasResult = false,
}: ReceiptInputCardProps) {
  // ── Core form fields ──────────────────────────────────────────────────────
  const [fields, setFields] = useState<StructuredListingFields>({});
  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [dirtyAfterResult, setDirtyAfterResult] = useState(false);

  // ── VIN lookup ────────────────────────────────────────────────────────────
  const [vinValue, setVinValue] = useState("");
  const [vinStatus, setVinStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [vinError, setVinError] = useState<string | null>(null);
  const [vinFilled, setVinFilled] = useState(false);
  // vinCompelDismissed: user typed in compel prompt or skipped — hide the amber banner
  const [vinCompelDismissed, setVinCompelDismissed] = useState(false);
  const priceInputRef = useRef<HTMLInputElement | null>(null);

  // ── Paste panel (primary — always visible) ───────────────────────────────
  const [pasteMode, setPasteMode] = useState<PasteMode>("url");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<ExtractError | null>(null);
  const [extractStep, setExtractStep] = useState(0);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [extractedRawText, setExtractedRawText] = useState<string | null>(null);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [listingSource, setListingSource] = useState<string | null>(null);
  const [dealerInfoExtracted, setDealerInfoExtracted] = useState<{ id: string; name: string; slug: string; logo_url: string | null } | null>(null);
  const [inventoryIdExtracted, setInventoryIdExtracted] = useState<string | null>(null);
  const [carGurusCleanId, setCarGurusCleanId] = useState<string | null>(null);
  const [showCarGurusBanner, setShowCarGurusBanner] = useState(false);
  const [showFbPasteModal, setShowFbPasteModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const autoExtractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRetryDoneRef = useRef(false);
  const lastAutoExtractedUrl = useRef<string | null>(null);
  const networkErrorCountRef = useRef(0);

  // ── Derived state ─────────────────────────────────────────────────────────
  const modelOptions = selectedMake && EV_CATALOG[selectedMake] ? EV_CATALOG[selectedMake] : [];
  const isOtherMake = selectedMake === "Other";

  const allFields: StructuredListingFields = {
    ...fields,
    make: selectedMake === "Other" ? (fields.make || undefined) : (selectedMake || undefined),
    model: selectedMake === "Other" ? (fields.model || undefined) : (selectedModel || undefined),
  };

  const hasYear = !!allFields.year;
  const hasMake = !!(allFields.make && allFields.make.trim());
  const hasModel = !!(allFields.model && allFields.model.trim());
  const hasMileage = allFields.mileage !== undefined && allFields.mileage !== null;
  const fieldsComplete = hasYear && hasMake && hasModel && hasMileage;

  const blockedByResult = hasResult && !dirtyAfterResult;
  const canGenerate = !isGenerating && !isExtracting && fieldsComplete && !blockedByResult;

  // ── Sync make/model into fields when dropdowns change ─────────────────────
  useEffect(() => {
    if (hasResult) setDirtyAfterResult(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMake, selectedModel, fields.year, fields.mileage]);

  // ── Reset dirty on new result ──────────────────────────────────────────────
  useEffect(() => {
    if (hasResult) setDirtyAfterResult(false);
  }, [hasResult]);

  // ── Extract step animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isExtracting) { setExtractStep(0); return; }
    const timers = [
      setTimeout(() => setExtractStep(1), 3000),
      setTimeout(() => setExtractStep(2), 12000),
      setTimeout(() => setExtractStep(3), 22000),
      setTimeout(() => setExtractStep(4), 32000),
      setTimeout(() => setExtractStep(5), 40000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [isExtracting]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => { if (autoExtractTimerRef.current) clearTimeout(autoExtractTimerRef.current); };
  }, []);

  // ── Prefill from external sources ─────────────────────────────────────────
  useEffect(() => {
    if (prefillText) {
      setPasteMode("text");
      setListingText(prefillText);
    }
  }, [prefillText]);

  const prefillUrlHandled = useRef(false);
  useEffect(() => {
    if (prefillUrl && !prefillUrlHandled.current) {
      prefillUrlHandled.current = true;
      setPasteMode("url");
      setListingUrl(prefillUrl);
      autoExtractTimerRef.current = setTimeout(() => handleExtract(prefillUrl), 800);
    }
  }, [prefillUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prefillVin && !vinValue) {
      setVinValue(prefillVin);
      setVinFilled(true);
    }
  }, [prefillVin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Field helpers ──────────────────────────────────────────────────────────
  const updateField = <K extends keyof StructuredListingFields>(key: K, value: StructuredListingFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (hasResult) setDirtyAfterResult(true);
  };

  const applyExtractedFields = (f: Partial<StructuredListingFields>) => {
    // Apply make to dropdown if it matches a known make
    if (f.make) {
      const knownMake = EV_MAKES.find((m) => m.toLowerCase() === f.make!.toLowerCase());
      if (knownMake) {
        setSelectedMake(knownMake);
        if (f.model) {
          const knownModel = EV_CATALOG[knownMake]?.find(
            (m) => m.toLowerCase() === f.model!.toLowerCase()
          );
          setSelectedModel(knownModel || f.model);
        }
      } else {
        setSelectedMake("Other");
        setFields((prev) => ({ ...prev, make: f.make }));
        if (f.model) setFields((prev) => ({ ...prev, model: f.model }));
      }
    }
    if (f.year) setFields((prev) => ({ ...prev, year: f.year }));
    if (f.mileage !== undefined) setFields((prev) => ({ ...prev, mileage: f.mileage }));
    if (f.price !== undefined) setFields((prev) => ({ ...prev, price: f.price }));
    if (f.vin) { setVinValue(f.vin); setFields((prev) => ({ ...prev, vin: f.vin })); setVinFilled(true); }
    if (f.trim) setFields((prev) => ({ ...prev, trim: f.trim }));
    if (f.location) setFields((prev) => ({ ...prev, location: f.location }));
    if (f.title_status) setFields((prev) => ({ ...prev, title_status: f.title_status }));
    if (f.accidents_reported) setFields((prev) => ({ ...prev, accidents_reported: f.accidents_reported }));
  };

  // ── VIN lookup ─────────────────────────────────────────────────────────────
  const handleVinLookupWithVin = async (vin: string) => {
    setVinStatus("loading");
    setVinError(null);
    try {
      const res = await fetch("/api/receipt/vin-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const data = await res.json();
      if (!data.success) {
        setVinStatus("error");
        setVinError(data.error || "VIN not recognised — check and try again.");
        return;
      }
      applyExtractedFields({ ...data.fields, vin });
      setVinStatus("success");
      setVinFilled(true);
      setExtractError(null);
      trackEvent?.("vin_lookup_success", { vin, anon_id: receiptToken });
      setTimeout(() => priceInputRef.current?.focus(), 150);
    } catch {
      setVinStatus("error");
      setVinError("Network error — check your connection and try again.");
    }
  };

  const handleVinLookup = () => {
    const vin = vinValue.trim().toUpperCase();
    if (vin.length !== 17) { setVinError("Please enter the full 17-character VIN."); return; }
    handleVinLookupWithVin(vin);
  };

  // ── VIN detection helper ────────────────────────────────────────────────────
  const isVinLike = (s: string) => /^[A-HJ-NPR-Z0-9]{17}$/i.test(s.trim());

  // ── URL paste handler ──────────────────────────────────────────────────────
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    // If user pastes a VIN into the URL field, route it to VIN lookup instead
    if (isVinLike(pasted)) {
      e.preventDefault();
      setVinValue(pasted.toUpperCase());
      setTimeout(() => handleVinLookupWithVin(pasted.toUpperCase()), 100);
      return;
    }
    if (!/^https?:\/\/.+/.test(pasted)) return;
    if (isExtracting || pasted === lastAutoExtractedUrl.current) return;
    setListingUrl(pasted);
    lastAutoExtractedUrl.current = pasted;
    setExtractError(null);
    if (isFacebookMarketplaceUrl(pasted)) { setShowFbPasteModal(true); return; }
    if (isCarGurusSearchUrl(pasted)) {
      setCarGurusCleanId(extractCarGurusListingId(pasted));
      setShowCarGurusBanner(true);
      return;
    }
    setShowCarGurusBanner(false);
    autoRetryDoneRef.current = false;
    if (autoExtractTimerRef.current) clearTimeout(autoExtractTimerRef.current);
    autoExtractTimerRef.current = setTimeout(() => handleExtract(pasted), 300);
  };

  // ── Extraction ─────────────────────────────────────────────────────────────
  const handleExtract = useCallback(async (urlOverride?: string) => {
    const urlToCheck = urlOverride ?? (pasteMode === "url" ? listingUrl.trim() : "");

    // If user entered a VIN in the URL field, redirect to VIN lookup silently
    if (urlToCheck && isVinLike(urlToCheck)) {
      const vin = urlToCheck.trim().toUpperCase();
      setListingUrl("");
      setVinValue(vin);
      handleVinLookupWithVin(vin);
      return;
    }

    if (urlToCheck && isFacebookMarketplaceUrl(urlToCheck)) {
      setShowFbPasteModal(true);
      return;
    }
    trackEvent?.("receipt_extract_clicked", { input_mode: pasteMode, anon_id: receiptToken });
    setIsExtracting(true);
    setExtractError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      const bodyPayload: Record<string, string> = {};
      if (urlOverride || pasteMode === "url") {
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
        if (data.partial_fields) applyExtractedFields(data.partial_fields);
        const _activeUrl = urlOverride ?? listingUrl.trim();
        const _domain = (() => { try { return new URL(_activeUrl).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })();
        const _trackFail = (reason: string) => trackEvent?.("receipt_extract_failed", { reason, input_mode: pasteMode, anon_id: receiptToken, domain: _domain });
        if (data.unsupported_domain) {
          setExtractError({ message: "Only CarGurus and AutoTrader links are supported. For other sites, switch to the \"Paste Text\" tab and copy the listing details." });
          setPasteMode("text");
        } else if (data.diagnostics?.botProtectionDetected) {
          const msg = "CarGurus blocked auto-fetch. Copy the year, make, model, price, and mileage from the listing and paste them in the text tab below — takes 30 seconds.";
          setExtractError({ message: msg });
          _trackFail("bot_protection");
        } else if (data.diagnostics?.failureReason === "timeout") {
          if (!autoRetryDoneRef.current && (urlOverride || pasteMode === "url")) {
            autoRetryDoneRef.current = true;
            setExtractError({ message: "Taking a moment — retrying automatically..." });
            autoExtractTimerRef.current = setTimeout(() => handleExtract(_activeUrl), 1500);
          } else {
            setExtractError({ message: "Timed out — fill in the details below." });
            _trackFail("timeout");
          }
        } else if (data.diagnostics?.failureReason === "listing_sold") {
          setExtractError({ message: "This listing has sold or been removed." });
          _trackFail("listing_sold");
        } else if (data.diagnostics?.failureReason === "search_page") {
          const id = extractCarGurusListingId(_activeUrl);
          if (id) { setCarGurusCleanId(id); setShowCarGurusBanner(true); setExtractError(null); }
          else {
            setExtractError({ message: "That looks like a search page — open a specific listing." });
            _trackFail("search_page");
          }
        } else {
          if (!autoRetryDoneRef.current && (urlOverride || pasteMode === "url")) {
            autoRetryDoneRef.current = true;
            setExtractError({ message: "Taking a moment — retrying automatically..." });
            autoExtractTimerRef.current = setTimeout(() => handleExtract(_activeUrl), 1500);
          } else {
            setExtractError({ message: "Couldn't extract listing details — fill in the year, make, model, price, and mileage below." });
            _trackFail(data.diagnostics?.failureReason || "unknown");
          }
        }
        return;
      }

      const f: FetchedListingFields = data.fields;
      applyExtractedFields(f);
      setHasExtracted(true);
      setVinCompelDismissed(false);
      setExtractionId(data.extraction_id || null);
      setExtractedRawText(data.raw_text || null);
      setListingSource(data.listing_source || null);
      setDealerInfoExtracted(data.dealer_info ?? null);
      setInventoryIdExtracted(data.inventory_id ?? null);
      setExtractError(null);

      trackEvent?.("receipt_extract_succeeded", {
        input_mode: pasteMode, anon_id: receiptToken,
        fields_extracted: data.extractedFields?.length ?? 0,
        listing_source: data.listing_source || null,
      });

      const summary = [f.year, f.make, f.model].filter(Boolean).join(" ");
      onExtractionSuccess?.(summary || "your vehicle");
      onExtractionFields?.({ year: f.year, make: f.make, model: f.model, trim: f.trim, mileage: f.mileage });
      if (data.photo_urls?.length) onPhotosExtracted?.(data.photo_urls);
    } catch (err) {
      const _domain = (() => { try { return new URL((urlOverride ?? listingUrl).trim()).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })();
      if (err instanceof Error && err.name === "AbortError") {
        setExtractError({ message: "Extraction timed out — fill in the details below." });
        trackEvent?.("receipt_extract_failed", { reason: "abort_timeout", input_mode: pasteMode, anon_id: receiptToken, domain: _domain });
      } else {
        networkErrorCountRef.current += 1;
        const msg = networkErrorCountRef.current >= 2
          ? "Connection seems unstable. Fill in the year, make, model, price, and mileage below to continue."
          : "Network error — tap again or fill in the details below.";
        setExtractError({ message: msg });
        trackEvent?.("receipt_extract_failed", { reason: "network_error", input_mode: pasteMode, anon_id: receiptToken, domain: _domain, attempt: networkErrorCountRef.current });
      }
    } finally {
      clearTimeout(timeoutId);
      setIsExtracting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteMode, listingUrl, listingText, receiptToken]);

  // ── Generate ───────────────────────────────────────────────────────────────
  const lastGenerateRef = useRef(0);
  const handleGenerate = () => {
    const now = Date.now();
    if (now - lastGenerateRef.current < 1000) return;
    if (isGenerating || isExtracting) return;
    lastGenerateRef.current = now;

    const submitFields: StructuredListingFields = { ...allFields };

    trackEvent?.("vehicle_facts_form_submitted", {
      input_mode: hasExtracted ? "extracted" : "manual",
      anon_id: receiptToken,
      fields_filled: Object.values(submitFields).filter(Boolean).length,
      listing_source: listingSource || "manual",
    });

    onGenerate({
      listing_url: pasteMode === "url" ? listingUrl.trim() || undefined : undefined,
      listing_text: pasteMode === "text" ? listingText.trim() || undefined : (extractedRawText || undefined),
      fields: submitFields,
      extraction_id: extractionId || undefined,
      input_mode: hasExtracted ? "extracted" : prefillVin ? "vin" : "manual",
      dealer_info: dealerInfoExtracted ?? undefined,
      inventory_id: inventoryIdExtracted ?? undefined,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="dark-inputs bg-white/[0.05] rounded-2xl border border-white/10 shadow-sm overflow-hidden">
      {/* Facebook Marketplace paste modal */}
      {showFbPasteModal && (
        <FbMarketplacePasteModal
          onAnalyze={(text) => {
            setShowFbPasteModal(false);
            setPasteMode("text");
            setListingText(text);
            setTimeout(() => handleExtract(), 50);
          }}
          onClose={() => setShowFbPasteModal(false)}
        />
      )}

      <div className="p-5 space-y-4">

        {/* ── PRIMARY: Listing URL / text paste (always visible) ──────── */}
        <div>
          <p className="text-sm font-semibold text-white mb-3">Start with your listing</p>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1 mb-3">
            <button
              onClick={() => setPasteMode("url")}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                pasteMode === "url" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              <Link className="w-3.5 h-3.5" /> Paste URL
            </button>
            <button
              onClick={() => setPasteMode("text")}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                pasteMode === "text" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Paste Text
            </button>
          </div>

          {/* URL mode */}
          {pasteMode === "url" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  ref={urlInputRef}
                  type="url"
                  value={listingUrl}
                  onChange={(e) => { setListingUrl(e.target.value); setExtractError(null); }}
                  onPaste={handleUrlPaste}
                  placeholder="Paste a CarGurus listing URL…"
                  className="form-input flex-1 text-sm"
                  disabled={isGenerating || isExtracting}
                  autoFocus
                />
                <button
                  onClick={() => handleExtract()}
                  disabled={!listingUrl.trim() || isExtracting || isGenerating}
                  className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extract"}
                </button>
              </div>

              {/* Supported sites hint */}
              {!listingUrl && !isExtracting && (
                <p className="text-[11px] text-white/30 px-0.5">
                  Supports <span className="text-white/50">CarGurus</span> and <span className="text-white/50">AutoTrader</span> listing pages. For other sites, use the &ldquo;Paste Text&rdquo; tab.
                </p>
              )}

              {/* CarGurus search URL banner */}
              {showCarGurusBanner && !isExtracting && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <div className="flex-1">
                    {carGurusCleanId ? (
                      <>
                        <span className="text-amber-300">Search page detected.</span>
                        <button
                          onClick={() => {
                            const cleanUrl = `https://www.cargurus.com/details/${carGurusCleanId}`;
                            setListingUrl(cleanUrl);
                            setShowCarGurusBanner(false);
                            handleExtract(cleanUrl);
                          }}
                          className="ml-2 font-semibold text-amber-400 underline hover:text-amber-300"
                        >
                          Clean &amp; Extract
                        </button>
                      </>
                    ) : (
                      <span className="text-amber-300">Open a specific listing and copy that URL.</span>
                    )}
                  </div>
                  <button onClick={() => setShowCarGurusBanner(false)} className="text-amber-400/70 hover:text-amber-400">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {isExtracting && (
                <div className="flex items-center gap-2 text-xs text-[#00d97e] bg-[#00d97e]/10 p-2.5 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                  <span>{EXTRACT_STEPS[extractStep] || EXTRACT_STEPS[0]}</span>
                </div>
              )}
            </div>
          )}

          {/* Text mode */}
          {pasteMode === "text" && (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={listingText}
                onChange={(e) => setListingText(e.target.value)}
                placeholder={`Paste listing text here...\n\nExample:\n2022 Tesla Model 3 Long Range AWD\n28,000 miles · $38,500\nDenver, CO · Clean title`}
                rows={5}
                maxLength={8000}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.06] border border-white/10 text-white text-sm placeholder-white/25 resize-none focus:border-[#00d97e]/50 focus:outline-none focus:ring-1 focus:ring-[#00d97e]/30"
                disabled={isGenerating || isExtracting}
              />
              <button
                onClick={() => handleExtract()}
                disabled={listingText.trim().length < 20 || isExtracting || isGenerating}
                className="w-full py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isExtracting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {EXTRACT_STEPS[extractStep] || EXTRACT_STEPS[0]}
                  </span>
                ) : "Extract Details"}
              </button>
            </div>
          )}

          {/* Extract error — suppressed once VIN filled or all required fields complete */}
          {extractError && !isExtracting && !vinFilled && !fieldsComplete && (
            <div className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 mt-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{extractError.message}</span>
            </div>
          )}
        </div>

        {/* ── Extraction success banner ────────────────────────────────── */}
        <AnimatePresence>
          {hasExtracted && (
            <motion.div
              key="extract-success"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 bg-[#00d97e]/10 border border-[#00d97e]/20 rounded-lg px-3 py-2 text-sm text-[#00d97e]"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span className="flex-1">
                Details filled from listing
                {listingSource ? ` (${listingSource})` : ""} — review and confirm below
              </span>
              {vinFilled && fields.vin && (
                <span className="text-[11px] text-[#00d97e]/60 whitespace-nowrap shrink-0">
                  VIN ···{fields.vin.slice(-6)}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Post-extraction VIN compel ───────────────────────────────── */}
        <AnimatePresence>
          {hasExtracted && !vinFilled && !vinCompelDismissed && (
            <motion.div
              key="vin-compel"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-300">VIN not found in listing</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Adding your VIN unlocks NMVTIS accident history, open recalls, and a more accurate battery estimate.
                </p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    maxLength={17}
                    placeholder="17-character VIN"
                    value={vinValue}
                    onChange={(e) => { setVinValue(e.target.value.toUpperCase()); setVinError(null); setVinStatus("idle"); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && vinValue.length === 17) handleVinLookup(); }}
                    className="flex-1 px-3 py-2 text-sm font-mono bg-white/[0.06] border border-amber-500/30 text-white rounded-lg focus:ring-2 focus:ring-amber-400/40 outline-none uppercase tracking-wider placeholder-white/25"
                  />
                  <button
                    onClick={handleVinLookup}
                    disabled={vinValue.length !== 17 || vinStatus === "loading"}
                    className="px-3 py-2 text-sm font-semibold rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-colors whitespace-nowrap flex items-center gap-1.5"
                  >
                    {vinStatus === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add VIN"}
                  </button>
                </div>
                {vinError && <p className="text-xs text-red-400 mt-1">{vinError}</p>}
                <button
                  onClick={() => { setVinCompelDismissed(true); }}
                  className="text-xs text-white/30 hover:text-white/50 mt-1.5 transition-colors"
                >
                  Skip — continue without VIN
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Divider: manual form ─────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-xs text-white/30 shrink-0">
            {hasExtracted ? "Confirm details" : "Or enter manually"}
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        {/* ── VIN section (shown only when NOT in post-extraction compel) */}
        {!(hasExtracted && !vinFilled && !vinCompelDismissed) && (
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">
              VIN{" "}
              <span className="font-normal text-white/35">(optional — autofills make, model & year)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={17}
                placeholder="17-character VIN"
                value={vinValue}
                onChange={(e) => {
                  setVinValue(e.target.value.toUpperCase());
                  setVinError(null);
                  setVinStatus("idle");
                  if (hasResult) setDirtyAfterResult(true);
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && vinValue.length === 17) handleVinLookup(); }}
                className="flex-1 px-3 py-2 text-sm font-mono bg-white/[0.06] border border-white/10 text-white rounded-lg focus:ring-2 focus:ring-[#00d97e]/40 focus:border-[#00d97e]/50 outline-none uppercase tracking-wider placeholder-white/25"
                disabled={vinStatus === "loading" || isGenerating}
              />
              <button
                onClick={handleVinLookup}
                disabled={vinValue.length !== 17 || vinStatus === "loading" || isGenerating}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                {vinStatus === "loading" ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Looking up…</>
                ) : vinStatus === "success" ? (
                  <><Check className="w-3.5 h-3.5 text-[#00d97e]" /> Autofilled</>
                ) : (
                  <><ShieldCheck className="w-3.5 h-3.5" /> Autofill</>
                )}
              </button>
            </div>
            {vinError && <p className="text-xs text-red-400 mt-1">{vinError}</p>}
            {vinFilled && (
              <p className="text-xs text-[#00d97e]/80 mt-1">
                Make, model &amp; year filled from VIN — confirm below and add price/mileage
              </p>
            )}
          </div>
        )}

        {/* ── Make + Model ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">
              Make <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedMake}
              onChange={(e) => {
                setSelectedMake(e.target.value);
                setSelectedModel("");
                if (hasResult) setDirtyAfterResult(true);
              }}
              className="form-input-sm"
              disabled={isGenerating}
            >
              <option value="">— Select make</option>
              {EV_MAKES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">
              Model <span className="text-red-400">*</span>
            </label>
            {isOtherMake ? (
              <input
                type="text"
                value={fields.model ?? ""}
                onChange={(e) => updateField("model", e.target.value || undefined)}
                placeholder="e.g. RAV4 Prime"
                className="form-input-sm"
                disabled={isGenerating}
              />
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  if (hasResult) setDirtyAfterResult(true);
                }}
                className="form-input-sm"
                disabled={isGenerating || !selectedMake}
              >
                <option value="">— Select model</option>
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Year + Mileage ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">
              Year <span className="text-red-400">*</span>
            </label>
            <select
              value={fields.year ?? ""}
              onChange={(e) => updateField("year", e.target.value ? Number(e.target.value) : undefined)}
              className="form-input-sm"
              disabled={isGenerating}
            >
              <option value="">— Select year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">
              Mileage <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={fields.mileage ?? ""}
              onChange={(e) => updateField("mileage", e.target.value ? Math.max(0, Number(e.target.value)) : undefined)}
              placeholder="45,000"
              min="0"
              className="form-input-sm"
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* ── Price + Trim ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">
              Price ($)
            </label>
            <input
              ref={priceInputRef}
              type="number"
              value={fields.price ?? ""}
              onChange={(e) => updateField("price", e.target.value ? Math.max(0, Number(e.target.value)) : undefined)}
              placeholder="32,500"
              min="0"
              className="form-input-sm"
              disabled={isGenerating}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/60 mb-1 block">Trim</label>
            <input
              type="text"
              value={fields.trim ?? ""}
              onChange={(e) => updateField("trim", e.target.value || undefined)}
              placeholder="e.g. Long Range AWD"
              className="form-input-sm"
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* ── API error ────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Generate button ──────────────────────────────────────────── */}
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
            <><Loader2 className="w-5 h-5 animate-spin" />{GENERATE_STEPS[generatingStep] || GENERATE_STEPS[0]}</>
          ) : blockedByResult ? (
            <><Sparkles className="w-5 h-5" />Edit details above to regenerate</>
          ) : hasResult && dirtyAfterResult ? (
            <><Sparkles className="w-5 h-5" />Regenerate Receipt</>
          ) : (
            <><Sparkles className="w-5 h-5" />Generate Receipt</>
          )}
        </button>

        {/* Missing fields hint */}
        {!canGenerate && !isGenerating && !isExtracting && (
          <p className="text-center text-xs text-white/40">
            {blockedByResult
              ? "Change any field above to regenerate"
              : `Required: ${[
                  !hasYear && "Year",
                  !hasMake && "Make",
                  !hasModel && "Model",
                  !hasMileage && "Mileage",
                ].filter(Boolean).join(", ")}`
            }
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
