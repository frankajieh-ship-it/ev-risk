/**
 * ReceiptOutputCard — Displays the AI-generated listing receipt
 *
 * Verdict badge, price sanity, risk flags, must-answer questions,
 * inspect first, negotiation opener, copy button.
 */

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
  FileText,
} from "lucide-react";
import type { ListingReceipt, LintError } from "@/types/receipt";
import { renderRedditDraft, type RedditDraftStyle } from "@/lib/reddit-draft-renderer";

interface ReceiptOutputCardProps {
  receipt: ListingReceipt;
  lintPassed: boolean;
  lintErrors: LintError[];
  onCopy?: () => void;
  onTrackCopy?: (copyType: string) => void;
  onAutoFix?: () => void;
  isFixing?: boolean;
  isFallback?: boolean;
  onRegenerate?: () => void;
  onTrackLintFallback?: () => void;
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
  onTrackCopy,
  onAutoFix,
  isFixing,
  isFallback,
  onRegenerate,
  onTrackLintFallback,
}: ReceiptOutputCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [draftStyle, setDraftStyle] = useState<RedditDraftStyle>("short_paragraph");
  const fallbackFiredRef = useRef(false);

  useEffect(() => {
    if (!lintPassed && receipt && !fallbackFiredRef.current) {
      fallbackFiredRef.current = true;
      onTrackLintFallback?.();
    }
  }, [lintPassed, receipt, onTrackLintFallback]);

  const copySection = async (text: string, sectionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionId);
      onTrackCopy?.(sectionId);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const displayText = useMemo(() => {
    if (receipt.reddit_draft) {
      try {
        return renderRedditDraft(
          receipt.reddit_draft as Parameters<typeof renderRedditDraft>[0],
          draftStyle
        );
      } catch {
        return receipt.receipt_reddit_text;
      }
    }
    return receipt.receipt_reddit_text;
  }, [receipt.reddit_draft, receipt.receipt_reddit_text, draftStyle]);

  const verdict = VERDICT_STYLES[receipt.verdict];
  const VerdictIcon = verdict.icon;
  const price = PRICE_STYLES[receipt.price_sanity?.label || "UNKNOWN"];

  const handleCopy = async () => {
    if (!lintPassed) return;

    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      onCopy?.();
      onTrackCopy?.("reddit_draft");
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
      {/* Fallback banner */}
      {isFallback && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            Quick receipt — AI analysis timed out. Tap Regenerate for a full analysis.
          </p>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-sm font-medium text-amber-700 hover:text-amber-900 underline whitespace-nowrap ml-3"
            >
              Regenerate
            </button>
          )}
        </div>
      )}

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

      {/* Prominent Copy Checklist — above the fold */}
      <div className="px-5 pt-4">
        <button
          onClick={() =>
            copySection(
              receipt.must_answer_questions
                .map((q, i) => `${i + 1}. ${q}`)
                .join("\n"),
              "must-ask"
            )
          }
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${
            copiedSection === "must-ask"
              ? "bg-blue-100 text-blue-700 border border-blue-200"
              : "border-2 border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          {copiedSection === "must-ask" ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Checklist copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Pre-Visit Checklist ({receipt.must_answer_questions.length} questions)
            </>
          )}
        </button>
      </div>

      {/* Lint Fallback: Quick Checklist */}
      {!lintPassed && (
        <div className="mx-5 mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">
              Quick Checklist
            </h3>
            <span className="text-xs text-gray-500">(Reddit copy pending lint fix)</span>
          </div>

          {/* Risk flags (up to 3) */}
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Flags</p>
            <ul className="space-y-1">
              {receipt.risk_flags.slice(0, 3).map((flag, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">!</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* First must-ask question */}
          {receipt.must_answer_questions.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Ask the seller</p>
              <p className="text-sm text-gray-700">
                <span className="text-blue-500 font-bold">1.</span>{" "}
                {receipt.must_answer_questions[0]}
              </p>
            </div>
          )}

          {/* Copy Quick Checklist — works even when lint fails */}
          <button
            onClick={() => {
              const lines: string[] = [];
              lines.push(`Verdict: ${receipt.verdict}`);
              receipt.risk_flags.slice(0, 3).forEach((f) => lines.push(`! ${f}`));
              if (receipt.must_answer_questions[0]) {
                lines.push(`Ask: ${receipt.must_answer_questions[0]}`);
              }
              copySection(lines.join("\n"), "quick_checklist");
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all ${
              copiedSection === "quick_checklist"
                ? "bg-blue-100 text-blue-700 border border-blue-200"
                : "border-2 border-blue-300 text-blue-700 hover:bg-blue-100"
            }`}
          >
            {copiedSection === "quick_checklist" ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Quick Checklist
              </>
            )}
          </button>
        </div>
      )}

      {/* What would change the verdict */}
      {receipt.operator_notes?.what_would_change_verdict &&
        receipt.operator_notes.what_would_change_verdict.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              This becomes a different verdict if:
            </p>
            <ul className="space-y-1">
              {receipt.operator_notes.what_would_change_verdict.map(
                (item: string, i: number) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 flex items-start gap-2"
                  >
                    <span className="text-gray-400 mt-0.5">→</span>
                    <span>{item}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

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
          onCopy={() =>
            copySection(
              receipt.must_answer_questions
                .map((q, i) => `${i + 1}. ${q}`)
                .join("\n"),
              "must-ask"
            )
          }
          copied={copiedSection === "must-ask"}
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
          onCopy={() =>
            copySection(receipt.negotiation_opener, "opener")
          }
          copied={copiedSection === "opener"}
        >
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-gray-800">
              {receipt.negotiation_opener}
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

        {/* Reddit Post Draft Preview */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reddit Post Draft Preview
              </h3>
            </div>
            <span className="text-xs text-gray-400">
              {displayText.length}/900 chars
            </span>
          </div>
          {receipt.reddit_draft && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-3">
              {(["short_paragraph", "standard", "bullets"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setDraftStyle(style)}
                  className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                    draftStyle === style
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {style === "short_paragraph"
                    ? "Short"
                    : style === "standard"
                    ? "Standard"
                    : "Bullets"}
                </button>
              ))}
            </div>
          )}
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {displayText}
          </pre>
        </div>

        {/* Lint errors — itemized list + auto-fix */}
        {!lintPassed && lintErrors.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">
                {lintErrors.length} lint issue{lintErrors.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ul className="space-y-1">
              {lintErrors.map((err, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                  <span className="text-amber-400 mt-0.5">·</span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
            {onAutoFix && (
              <button
                onClick={onAutoFix}
                disabled={isFixing}
                className="mt-3 w-full py-2 text-sm font-medium rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-all disabled:opacity-50"
              >
                {isFixing ? "Fixing..." : "Auto-fix lint issues"}
              </button>
            )}
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
              Copy Reddit Post Draft
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
  onCopy,
  copied,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {onCopy && (
          <button
            onClick={onCopy}
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
            title={`Copy ${title}`}
          >
            {copied ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
