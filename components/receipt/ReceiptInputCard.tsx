/**
 * ReceiptInputCard — URL + text input form for listing receipt
 *
 * Two-tab toggle: "Paste URL" | "Paste Text"
 * URL tab: text input + "Fetch & Analyze" button
 * Text tab: large textarea
 * Bottom: "Generate Receipt" gradient CTA
 */

"use client";

import { useState } from "react";
import { Link, FileText, Sparkles, Loader2, AlertCircle } from "lucide-react";
import type { FetchedListingFields } from "@/types/receipt";

type InputMode = "url" | "text";

interface ReceiptInputCardProps {
  onGenerate: (data: {
    listing_url?: string;
    listing_text?: string;
    fetchedFields?: FetchedListingFields;
  }) => void;
  isGenerating: boolean;
  remainingFree: number | null;
  error: string | null;
}

export default function ReceiptInputCard({
  onGenerate,
  isGenerating,
  remainingFree,
  error,
}: ReceiptInputCardProps) {
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [listingUrl, setListingUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [fetchedFields, setFetchedFields] = useState<FetchedListingFields | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // URL mode requires successful fetch (fetchedFields populated)
  // Text mode requires at least 20 chars of listing content
  const canGenerate =
    !isGenerating &&
    (inputMode === "url"
      ? fetchedFields !== null
      : listingText.trim().length > 20);

  // Fetch listing data from URL
  const handleFetch = async () => {
    if (!listingUrl.trim()) return;
    setIsFetching(true);
    setFetchError(null);
    setFetchedFields(null);

    try {
      const res = await fetch("/api/receipt/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: listingUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFetchError(data.error || "Failed to fetch listing");
        return;
      }

      setFetchedFields(data.fields);
    } catch {
      setFetchError("Network error — try pasting the listing text instead");
    } finally {
      setIsFetching(false);
    }
  };

  const handleGenerate = () => {
    onGenerate({
      listing_url: inputMode === "url" ? listingUrl.trim() : undefined,
      listing_text: inputMode === "text" ? listingText.trim() : undefined,
      fetchedFields: fetchedFields || undefined,
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
                  setFetchedFields(null);
                  setFetchError(null);
                }}
                placeholder="https://www.autotrader.com/cars-for-sale/..."
                className="flex-1 px-4 py-3 rounded-lg border border-gray-200 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                disabled={isGenerating}
              />
              <button
                onClick={handleFetch}
                disabled={isFetching || !listingUrl.trim() || isGenerating}
                className={`px-4 py-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isFetching || !listingUrl.trim()
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Fetch"
                )}
              </button>
            </div>

            {/* Fetch error + helper to switch tabs */}
            {fetchError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span>{fetchError}</span>
                  <button
                    onClick={() => setInputMode("text")}
                    className="block mt-1 text-blue-600 hover:text-blue-800 underline text-xs font-medium"
                  >
                    Switch to Text tab and paste the listing instead
                  </button>
                </div>
              </div>
            )}

            {/* Fetched fields preview */}
            {fetchedFields && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-medium text-green-800 mb-2">
                  Extracted from listing:
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-green-700">
                  {fetchedFields.year && <span>Year: {fetchedFields.year}</span>}
                  {fetchedFields.make && <span>Make: {fetchedFields.make}</span>}
                  {fetchedFields.model && <span>Model: {fetchedFields.model}</span>}
                  {fetchedFields.trim && <span>Trim: {fetchedFields.trim}</span>}
                  {fetchedFields.mileage && (
                    <span>Mileage: {fetchedFields.mileage.toLocaleString()}</span>
                  )}
                  {fetchedFields.price && (
                    <span>Price: ${fetchedFields.price.toLocaleString()}</span>
                  )}
                  {fetchedFields.location && (
                    <span>Location: {fetchedFields.location}</span>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400">
              Supports AutoTrader, CarGurus, Cars.com, Facebook Marketplace, and more
            </p>
          </div>
        )}

        {/* Text input */}
        {inputMode === "text" && (
          <div className="space-y-2">
            <textarea
              value={listingText}
              onChange={(e) => setListingText(e.target.value)}
              placeholder={`Paste the listing details here...\n\nExample:\n2021 Toyota RAV4 Prime XSE\n45,000 miles\n$32,500\nDenver, CO\nClean title, 1 owner, dealer listing`}
              rows={8}
              maxLength={8000}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm resize-none focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              disabled={isGenerating}
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Include year, make, model, price, mileage, and location if possible</span>
              <span>{listingText.length}/8000</span>
            </div>
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
