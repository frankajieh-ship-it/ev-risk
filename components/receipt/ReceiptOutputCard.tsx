/**
 * ReceiptOutputCard — Displays the AI-generated listing receipt
 *
 * Verdict badge, price sanity, risk flags, must-answer questions,
 * inspect first, negotiation opener, copy button.
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  CheckCircle,
  AlertTriangle,
  Shield,
  MessageSquare,
  Search,
  DollarSign,
  AlertCircle,
  Wrench,
  HelpCircle,
} from "lucide-react";
import type { ListingReceipt } from "@/types/receipt";

interface ReceiptOutputCardProps {
  receipt: ListingReceipt;
  lintPassed: boolean;
  lintErrors: string[];
  onCopy?: () => void;
}

const VERDICT_STYLES = {
  GREEN: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-200",
    label: "Good Deal",
    icon: Shield,
  },
  YELLOW: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-200",
    label: "Proceed with Caution",
    icon: AlertTriangle,
  },
  RED: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-200",
    label: "High Risk",
    icon: AlertCircle,
  },
};

const PRICE_STYLES = {
  UNDERPRICED: { bg: "bg-green-50", text: "text-green-700", label: "Underpriced" },
  FAIR: { bg: "bg-blue-50", text: "text-blue-700", label: "Fair Price" },
  OVERPRICED: { bg: "bg-red-50", text: "text-red-700", label: "Overpriced" },
  UNKNOWN: { bg: "bg-gray-50", text: "text-gray-600", label: "Price Unknown" },
};

export default function ReceiptOutputCard({
  receipt,
  lintPassed,
  lintErrors,
  onCopy,
}: ReceiptOutputCardProps) {
  const [copied, setCopied] = useState(false);

  const verdict = VERDICT_STYLES[receipt.verdict];
  const VerdictIcon = verdict.icon;
  const price = PRICE_STYLES[receipt.price_sanity?.label || "UNKNOWN"];

  const handleCopy = async () => {
    if (!lintPassed) return;

    try {
      await navigator.clipboard.writeText(receipt.receipt_reddit_text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Vehicle description
  const ls = receipt.listing_summary;
  const vehicleDesc = [ls?.year, ls?.make, ls?.model, ls?.trim]
    .filter(Boolean)
    .join(" ");
  const priceStr = ls?.price
    ? `${ls.currency || "$"}${ls.price.toLocaleString()}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
    >
      {/* Verdict banner */}
      <div className={`${verdict.bg} ${verdict.border} border-b px-5 py-4`}>
        <div className="flex items-center gap-3">
          <VerdictIcon className={`w-6 h-6 ${verdict.text}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${verdict.text}`}>
                {receipt.verdict}
              </span>
              <span className={`text-sm font-medium ${verdict.text} opacity-80`}>
                — {verdict.label}
              </span>
            </div>
            {vehicleDesc && (
              <p className="text-sm text-gray-700 mt-0.5">
                {vehicleDesc}
                {priceStr && <span className="font-semibold"> · {priceStr}</span>}
              </p>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700 mt-2">{receipt.verdict_reason}</p>
      </div>

      <div className="p-5 space-y-5">
        {/* Price Sanity */}
        {receipt.price_sanity && (
          <div className={`${price.bg} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className={`w-4 h-4 ${price.text}`} />
              <span className={`text-sm font-semibold ${price.text}`}>
                {price.label}
              </span>
              {receipt.price_sanity.confidence > 0 && (
                <span className="text-xs text-gray-500">
                  ({Math.round(receipt.price_sanity.confidence * 100)}% confidence)
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">
              {receipt.price_sanity.rationale_short}
            </p>
          </div>
        )}

        {/* Risk Flags */}
        <Section
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          title="Risk Flags"
        >
          <ul className="space-y-2">
            {receipt.risk_flags.map((flag, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">!</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Must Answer Questions */}
        <Section
          icon={<HelpCircle className="w-4 h-4 text-blue-500" />}
          title="Must-Ask Questions"
        >
          <ul className="space-y-2">
            {receipt.must_answer_questions.map((q, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-blue-500 font-bold mt-0.5">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Inspect First */}
        <Section
          icon={<Search className="w-4 h-4 text-orange-500" />}
          title="Inspect First"
        >
          <ul className="space-y-2">
            {receipt.inspect_first.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <Wrench className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Negotiation Opener */}
        <Section
          icon={<MessageSquare className="w-4 h-4 text-green-500" />}
          title="Negotiation Opener"
        >
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-gray-800 italic">
              &ldquo;{receipt.negotiation_opener}&rdquo;
            </p>
          </div>
        </Section>

        {/* Follow-up Question */}
        {receipt.one_followup_question && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <span className="font-medium text-gray-700">Follow-up: </span>
            {receipt.one_followup_question}
          </div>
        )}

        {/* Lint warning */}
        {!lintPassed && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Receipt has {lintErrors.length} validation issue{lintErrors.length !== 1 ? "s" : ""} — copy is disabled.
            </span>
          </div>
        )}

        {/* Copy button */}
        <button
          onClick={handleCopy}
          disabled={!lintPassed}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm transition-all ${
            !lintPassed
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : copied
              ? "bg-green-100 text-green-700 border border-green-200"
              : "border-2 border-gray-200 text-gray-700 hover:border-blue-500 hover:bg-blue-50"
          }`}
        >
          {copied ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Copied to clipboard!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Reddit Summary
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// --- Section helper ---

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}
