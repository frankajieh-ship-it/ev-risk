/**
 * ReceiptInputCard — Extract-first UX
 *
 * Two-phase flow:
 * 1. Extract: Paste URL or text → "Extract Details" → fields auto-fill with confidence
 * 2. Generate: Review/edit fields → "Generate Receipt" → report renders, fields persist
 *
 * Features:
 * - Dirty-field tracking (re-extract skips user-edited fields)
 * - Per-field confidence borders (green = extracted, blue = user-edited)
 * - Extraction result chips (found vs missing)
 * - Required-fields gating (year, make, model, price, mileage)
 * - Compare mode placeholder (Pro-gated)
 */

"use client";

import { useState, useEffect } from "react";
import {
  Link,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronDown,
  Crown,
  Check,
  X,
} from "lucide-react";
import type { FetchedListingFields, StructuredListingFields } from "@/types/receipt";

type InputMode = "url" | "text";

interface ReceiptInputCardProps {
  onGenerate: (data: {
    listing_url?: string;
    listing_text?: string;
    fields: StructuredListingFields;
    extraction_id?: string;
  }) => void;
  isGenerating: boolean;
  remainingFree: number | null;
  error: string | null;
  isPro?: boolean;
  prefillText?: string | null;
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

const LABEL_CLASS = "text-xs font-medium text-gray-600 mb-1";

function getInputClass(confidence?: string, isDirty?: boolean): string {
  const base =
    "w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-1 disabled:bg-gray-50 disabled:text-gray-400";
  if (isDirty) {
    return `${base} border-blue-300 focus:border-blue-600 focus:ring-blue-600`;
  }
  if (confidence === "extracted") {
    return `${base} border-green-300 focus:border-green-600 focus:ring-green-600`;
  }
  return `${base} border-gray-200 focus:border-blue-600 focus:ring-blue-600`;
}

export default function ReceiptInputCard({
  onGenerate,
  isGenerating,
  remainingFree,
  error,
  isPro = false,
  prefillText,
}: ReceiptInputCardProps) {
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Structured fields
  const [fields, setFields] = useState<StructuredListingFields>({});
  const [optionalOpen, setOptionalOpen] = useState(false);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);

  // Extraction state
  const [hasExtracted, setHasExtracted] = useState(false);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, string>>({});
  const [extractedFieldNames, setExtractedFieldNames] = useState<string[]>([]);
  const [missingFieldNames, setMissingFieldNames] = useState<string[]>([]);
  const [listingSource, setListingSource] = useState<string | null>(null);

  // Dirty tracking
  const [dirtyFields, setDirtyFields] = useState<Set<keyof StructuredListingFields>>(new Set());

  // Prefill from SEO page
  useEffect(() => {
    if (prefillText) {
      setInputMode("text");
      setListingText(prefillText);
    }
  }, [prefillText]);

  const updateField = <K extends keyof StructuredListingFields>(
    key: K,
    value: StructuredListingFields[K]
  ) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    if (hasExtracted) {
      setDirtyFields((prev) => new Set(prev).add(key));
    }
  };

  // Required fields validation
  const filledRequired = REQUIRED_FIELDS.filter(
    (k) => fields[k] !== undefined && fields[k] !== null && fields[k] !== ""
  );
  const missingRequired = REQUIRED_FIELDS.filter(
    (k) => !filledRequired.includes(k)
  );
  const canGenerate = !isGenerating && filledRequired.length === REQUIRED_FIELDS.length;

  // Can extract?
  const canExtractUrl = inputMode === "url" && listingUrl.trim().length > 0;
  const canExtractText = inputMode === "text" && listingText.trim().length >= 20;
  const canExtract = !isExtracting && !isGenerating && (canExtractUrl || canExtractText);

  // Unified extract handler for both URL and text modes
  const handleExtract = async () => {
    setIsExtracting(true);
    setExtractError(null);

    try {
      const bodyPayload: Record<string, string> = {};
      if (inputMode === "url") {
        bodyPayload.url = listingUrl.trim();
      } else {
        bodyPayload.text = listingText.trim();
      }

      const res = await fetch("/api/receipt/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setExtractError(data.error || "Failed to extract listing details");
        return;
      }

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
      setFieldConfidence(data.field_confidence || {});
      setExtractedFieldNames(data.extractedFields || []);
      setMissingFieldNames(data.missingFields || []);
      setListingSource(data.listing_source || null);
    } catch {
      setExtractError("Network error — try again or paste the listing text");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleGenerate = () => {
    onGenerate({
      listing_url: inputMode === "url" ? listingUrl.trim() : undefined,
      listing_text: inputMode === "text" ? listingText.trim() : undefined,
      fields,
      extraction_id: extractionId || undefined,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab toggle */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setInputMode("url")}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            inputMode === "url"
              ? "text-blue-700 bg-blue-50 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Link className="w-4 h-4" /> Paste URL
        </button>
        <button
          onClick={() => setInputMode("text")}
          className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            inputMode === "text"
              ? "text-blue-700 bg-blue-50 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <FileText className="w-4 h-4" /> Paste Text
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
                }}
                placeholder="https://www.autotrader.com/cars-for-sale/..."
                className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                disabled={isGenerating}
              />
              <button
                onClick={handleExtract}
                disabled={!canExtractUrl || isExtracting || isGenerating}
                className={`px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  !canExtractUrl || isExtracting
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {isExtracting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : hasExtracted ? (
                  "Re-extract"
                ) : (
                  "Extract Details"
                )}
              </button>
            </div>

            {/* Extract error */}
            {extractError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span>{extractError}</span>
                  <button
                    onClick={() => setInputMode("text")}
                    className="block mt-1 text-blue-600 hover:text-blue-800 underline text-xs font-medium"
                  >
                    Switch to Text tab and paste the listing instead
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">
              Supports AutoTrader, CarGurus, Cars.com, Facebook Marketplace, and
              more
            </p>
          </div>
        )}

        {/* Text input */}
        {inputMode === "text" && (
          <div className="space-y-3">
            <textarea
              value={listingText}
              onChange={(e) => setListingText(e.target.value)}
              placeholder={`Paste the listing details here...\n\nExample:\n2021 Toyota RAV4 Prime XSE\n45,000 miles\n$32,500\nDenver, CO\nClean title, 1 owner, dealer listing`}
              rows={8}
              maxLength={8000}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm resize-none focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              disabled={isGenerating}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                Paste the listing text. We&apos;ll extract year, price, mileage, location.
              </span>
              <span className="text-xs text-gray-400">
                {listingText.length}/8000
              </span>
            </div>

            {/* Extract button for text mode */}
            <button
              onClick={handleExtract}
              disabled={!canExtractText || isExtracting || isGenerating}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !canExtractText || isExtracting
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {isExtracting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting...
                </span>
              ) : hasExtracted ? (
                "Re-extract Details"
              ) : (
                "Extract Details"
              )}
            </button>

            {/* Extract error */}
            {extractError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{extractError}</span>
              </div>
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"
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
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200"
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
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200"
                  >
                    {FIELD_LABELS[f] || f}
                  </span>
                ))}
            </div>
            {listingSource && listingSource !== "text_paste" && (
              <p className="text-xs text-gray-400">
                Source: {listingSource}
              </p>
            )}
          </div>
        )}

        {/* Structured Fields Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Vehicle Details
            </h3>
            <span className="text-xs text-gray-400">
              {hasExtracted
                ? "(review and edit as needed)"
                : "(auto-filled after extraction)"}
            </span>
          </div>

          {/* Row 1: Price, Mileage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>
                Price ($) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={fields.price ?? ""}
                onChange={(e) =>
                  updateField(
                    "price",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="32500"
                className={getInputClass(
                  fieldConfidence.price,
                  dirtyFields.has("price")
                )}
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
                onChange={(e) =>
                  updateField(
                    "mileage",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="45000"
                className={getInputClass(
                  fieldConfidence.mileage,
                  dirtyFields.has("mileage")
                )}
                disabled={isGenerating}
              />
            </div>
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

          {/* Additional Details (collapsible) */}
          <button
            type="button"
            onClick={() => setOptionalOpen(!optionalOpen)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
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

        {/* Compare Mode */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="compare-mode"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
            disabled={!isPro || isGenerating}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          <label
            htmlFor="compare-mode"
            className={`text-sm ${!isPro ? "text-gray-400" : "text-gray-700"}`}
          >
            Compare two listings
          </label>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700">
            <Crown className="w-3 h-3" />
            PRO
          </span>
        </div>

        {compareMode && !isPro && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
            Compare mode — coming with Pro
          </div>
        )}

        {/* Error from API */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
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
              ? "bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg hover:shadow-blue-200"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing listing...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Receipt
            </>
          )}
        </button>

        {/* Missing required fields hint */}
        {!canGenerate && !isGenerating && missingRequired.length > 0 && (
          <p className="text-center text-xs text-amber-600">
            Fill in: {missingRequired.map((k) => FIELD_LABELS[k] || k).join(", ")}
          </p>
        )}

        {/* Free limit badge */}
        {remainingFree !== null && (
          <p className="text-center text-xs text-gray-400">
            {remainingFree > 0
              ? `${remainingFree} free receipt${remainingFree !== 1 ? "s" : ""} remaining today`
              : "Free daily limit reached — resets at midnight UTC"}
          </p>
        )}
      </div>
    </div>
  );
}
