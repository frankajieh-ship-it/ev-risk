/**
 * CompareView — Side-by-side receipt comparison display
 *
 * Shows two receipt cards with vehicle info, verdict, price sanity,
 * risk flags, and a computed delta section highlighting differences.
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  GitCompare,
  Shield,
  AlertTriangle,
  AlertCircle,
  Copy,
  CheckCircle,
} from "lucide-react";
import { computeReceiptDelta } from "@/lib/compare-receipts";
import { humanizeFlag } from "@/lib/receipt-rules";
import { formatPrice, type Region } from "@/lib/region";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { ListingReceipt } from "@/types/receipt";

type Verdict = "GREEN" | "YELLOW" | "RED";

interface CompareViewProps {
  receiptA: ListingReceipt;
  receiptB: ListingReceipt;
  region?: Region;
}

const VERDICT_STYLE: Record<
  Verdict,
  { bg: string; text: string; icon: typeof Shield }
> = {
  GREEN: { bg: "bg-green-100", text: "text-green-700", icon: Shield },
  YELLOW: { bg: "bg-yellow-100", text: "text-yellow-700", icon: AlertTriangle },
  RED: { bg: "bg-red-100", text: "text-red-700", icon: AlertCircle },
};

function ReceiptCard({ receipt, label }: { receipt: ListingReceipt; label: string }) {
  const s = receipt.listing_summary;
  const vehicle = [s.year, s.make, s.model, s.trim].filter(Boolean).join(" ");
  const riskFlags = Array.isArray(receipt.risk_flags) ? receipt.risk_flags : [];
  const mustAnswerQuestions = Array.isArray(receipt.must_answer_questions) ? receipt.must_answer_questions : [];
  const verdict = VERDICT_STYLE[receipt.verdict];
  const VerdictIcon = verdict.icon;
  const currency = s.currency === "GBP" ? "\u00A3" : "$";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Label */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </p>

      {/* Vehicle + Verdict */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 leading-tight">
          {vehicle || "Unknown Vehicle"}
        </h3>
        <div
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${verdict.bg} ${verdict.text}`}
        >
          <VerdictIcon className="w-3 h-3" />
          {receipt.verdict}
        </div>
      </div>

      {/* Price + Mileage */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-gray-900">
          {currency}{s.price.toLocaleString()}
        </span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-600">
          {s.mileage.toLocaleString()} {s.mileage_unit === "km" ? "km" : "mi"}
        </span>
      </div>

      {/* Price Sanity */}
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            receipt.price_sanity.label === "FAIR"
              ? "bg-green-50 text-green-700"
              : receipt.price_sanity.label === "UNDERPRICED"
              ? "bg-blue-50 text-blue-700"
              : receipt.price_sanity.label === "OVERPRICED"
              ? "bg-red-50 text-red-700"
              : "bg-gray-50 text-gray-500"
          }`}
        >
          {receipt.price_sanity.label}
        </span>
        <span className="text-xs text-gray-400">
          {Math.round(receipt.price_sanity.confidence * 100)}% confidence
        </span>
      </div>

      {/* Risk Flags */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase mb-1">
          Risk Flags
        </p>
        <ul className="space-y-1">
          {riskFlags.slice(0, 3).map((flag, i) => (
            <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
              <span className="text-red-400 mt-0.5">!</span>
              <span>{humanizeFlag(flag)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Must-Ask Questions */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase mb-1">
          Must-Ask Questions
        </p>
        <ol className="space-y-1 list-decimal list-inside">
          {mustAnswerQuestions.slice(0, 3).map((q, i) => (
            <li key={i} className="text-xs text-gray-700">
              {q}
            </li>
          ))}
        </ol>
      </div>

      {/* Negotiation Opener */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase mb-1">
          Opener
        </p>
        <p className="text-xs text-gray-600 italic">
          &ldquo;{receipt.negotiation_opener}&rdquo;
        </p>
      </div>
    </div>
  );
}

export default function CompareView({ receiptA, receiptB, region = "US" }: CompareViewProps) {
  const { trackEvent } = useEventTracking();
  const [copied, setCopied] = useState(false);

  const deltaHits = computeReceiptDelta(receiptA, receiptB);

  const nameA = [
    receiptA.listing_summary.year,
    receiptA.listing_summary.make,
    receiptA.listing_summary.model,
  ]
    .filter(Boolean)
    .join(" ");
  const nameB = [
    receiptB.listing_summary.year,
    receiptB.listing_summary.make,
    receiptB.listing_summary.model,
  ]
    .filter(Boolean)
    .join(" ");

  const handleCopy = async () => {
    const lines = [
      `Comparing ${nameA || "Listing A"} vs ${nameB || "Listing B"}:`,
      "",
      `${nameA || "A"}: ${receiptA.verdict} verdict, ${formatPrice(receiptA.listing_summary.price, region)}`,
      `${nameB || "B"}: ${receiptB.verdict} verdict, ${formatPrice(receiptB.listing_summary.price, region)}`,
      "",
      "Key Differences:",
      ...deltaHits.map((b) => `  \u2192 ${b}`),
      "",
      "Both listings have trade-offs. Use the details above to decide which risks you're more comfortable managing.",
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent("compare_summary_copied", {
        receipt_a: receiptA.receipt_id,
        receipt_b: receiptB.receipt_id,
      });
    } catch {
      // Clipboard not available
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-blue-600" />
        <h2 className="text-base font-bold text-gray-900">
          Receipt Comparison
        </h2>
      </div>

      {/* Side-by-side cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <ReceiptCard receipt={receiptA} label="Current" />
        <ReceiptCard receipt={receiptB} label="Compare" />
      </div>

      {/* Delta section */}
      {deltaHits.length > 0 && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-blue-600" />
            Key Differences
          </h3>
          <ul className="space-y-2.5">
            {deltaHits.map((bullet, idx) => (
              <li
                key={idx}
                className="text-sm text-gray-700 flex items-start gap-2"
              >
                <span className="text-blue-600 mt-0.5 font-bold">
                  &rarr;
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Neutral closer */}
      <div className="text-center py-3 border-t border-gray-200">
        <p className="text-sm text-gray-600 italic">
          Both listings have trade-offs. Use the details above to decide which
          risks you&apos;re more comfortable managing.
        </p>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-blue-300 transition-all"
      >
        {copied ? (
          <>
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-green-600">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy comparison summary
          </>
        )}
      </button>
    </motion.div>
  );
}
