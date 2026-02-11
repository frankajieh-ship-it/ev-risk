/**
 * OFFO Listing Receipt Page
 *
 * /receipt
 * Paste a car listing URL or text, get an AI-powered deal receipt.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Receipt, History, ArrowLeft } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import ReceiptInputCard from "@/components/receipt/ReceiptInputCard";
import ReceiptOutputCard from "@/components/receipt/ReceiptOutputCard";
import ReceiptDetailsAccordion from "@/components/receipt/ReceiptDetailsAccordion";
import ReceiptHistoryDrawer from "@/components/receipt/ReceiptHistoryDrawer";
import type { ListingReceipt, FetchedListingFields, ReceiptHistoryEntry } from "@/types/receipt";
import {
  getReceiptHistory,
  addToReceiptHistory,
} from "@/lib/receipt-history";

// Generate or retrieve receipt token from localStorage
function getOrCreateReceiptToken(): string {
  if (typeof window === "undefined") return "";
  const key = "offo_receipt_token";
  let token = localStorage.getItem(key);
  if (!token) {
    token = `rt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

export default function ReceiptPage() {
  const { trackEvent } = useEventTracking();

  // Core state
  const [receipt, setReceipt] = useState<ListingReceipt | null>(null);
  const [lintPassed, setLintPassed] = useState(true);
  const [lintErrors, setLintErrors] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ReceiptHistoryEntry[]>([]);

  // Receipt token
  const [receiptToken, setReceiptToken] = useState("");

  useEffect(() => {
    setReceiptToken(getOrCreateReceiptToken());
    setHistory(getReceiptHistory());
  }, []);

  // Generate receipt
  const handleGenerate = useCallback(
    async (data: {
      listing_url?: string;
      listing_text?: string;
      fetchedFields?: FetchedListingFields;
    }) => {
      if (!receiptToken) return;

      setIsGenerating(true);
      setError(null);
      setReceipt(null);
      setLintPassed(true);
      setLintErrors([]);

      try {
        const body: Record<string, unknown> = {
          receipt_token: receiptToken,
          mode: "single",
        };

        if (data.listing_url) body.listing_url = data.listing_url;
        if (data.listing_text) body.listing_text = data.listing_text;

        // Merge fetched fields
        if (data.fetchedFields) {
          const f = data.fetchedFields;
          if (f.year) body.year = f.year;
          if (f.make) body.make = f.make;
          if (f.model) body.model = f.model;
          if (f.trim) body.trim = f.trim;
          if (f.mileage) body.mileage = f.mileage;
          if (f.price) body.price = f.price;
          if (f.location) body.location = f.location;
        }

        const res = await fetch("/api/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = await res.json();

        if (!res.ok || !result.success) {
          setError(result.error || "Failed to generate receipt");
          if (typeof result.remaining_free === "number") {
            setRemainingFree(result.remaining_free);
          }
          return;
        }

        setReceipt(result.receipt);
        setLintPassed(result.lint_passed);
        setLintErrors(result.lint_errors || []);
        if (typeof result.remaining_free === "number") {
          setRemainingFree(result.remaining_free);
        }

        // Add to history
        addToReceiptHistory(result.receipt);
        setHistory(getReceiptHistory());

        // Track event
        trackEvent("receipt_generate", {
          verdict: result.receipt.verdict,
          price_label: result.receipt.price_sanity?.label,
          lint_passed: result.lint_passed,
        });
      } catch {
        setError("Network error — please try again");
      } finally {
        setIsGenerating(false);
      }
    },
    [receiptToken, trackEvent]
  );

  // Post receipt event to dedicated endpoint (fire-and-forget)
  const postReceiptEvent = useCallback(
    (eventType: string) => {
      if (!receipt?.receipt_id || !receiptToken) return;
      fetch("/api/receipt/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receipt.receipt_id,
          event_type: eventType,
          receipt_token: receiptToken,
        }),
      }).catch(() => {});
    },
    [receipt, receiptToken]
  );

  // Handle copy
  const handleCopy = useCallback(() => {
    postReceiptEvent("copy");
  }, [postReceiptEvent]);

  // View historical receipt
  const handleHistorySelect = useCallback((entry: ReceiptHistoryEntry) => {
    setReceipt(entry.receipt);
    setLintPassed(true);
    setLintErrors([]);
    setError(null);
    setHistoryOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <a
            href="/"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            EV-Risk
          </a>
          <button
            onClick={() => {
              setHistoryOpen(true);
              trackEvent("receipt_history_viewed");
            }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <History className="w-4 h-4" />
            History
            {history.length > 0 && (
              <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Receipt className="w-6 h-6 text-blue-600" />
            <span className="text-xs font-medium text-blue-600 uppercase tracking-wider">
              by OFFO Lab
            </span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-green-600 bg-clip-text text-transparent mb-2">
            Listing Receipt
          </h1>
          <p className="text-gray-600">
            Paste a car listing. Get a deal verdict in seconds.
          </p>
        </div>

        {/* Input Card */}
        <ReceiptInputCard
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          remainingFree={remainingFree}
          error={error}
        />

        {/* Output */}
        <AnimatePresence>
          {receipt && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mt-6 space-y-4"
            >
              <ReceiptOutputCard
                receipt={receipt}
                lintPassed={lintPassed}
                lintErrors={lintErrors}
                onCopy={handleCopy}
              />

              {/* Details accordion */}
              {receipt.receipt_details && (
                <ReceiptDetailsAccordion
                  details={receipt.receipt_details}
                  operatorNotes={receipt.operator_notes}
                  listingSummary={receipt.listing_summary}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History drawer */}
      <ReceiptHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        onSelect={handleHistorySelect}
        onClear={() => {
          setHistory([]);
        }}
      />
    </div>
  );
}
