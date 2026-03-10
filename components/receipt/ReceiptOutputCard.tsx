/**
 * ReceiptOutputCard — Displays the generated listing receipt
 *
 * Verdict badge, price sanity, risk flags, must-answer questions,
 * inspect first, negotiation opener, copy button.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  CheckCircle,
  AlertTriangle,
  Shield,
  Search,
  DollarSign,
  AlertCircle,
  HelpCircle,
  FileSearch,
  Lock,
} from "lucide-react";
import type { ListingReceipt, LintError } from "@/types/receipt";
import type { Region } from "@/lib/region";
import { formatPrice } from "@/lib/region";
import { humanizeFlag } from "@/lib/receipt-rules";

interface ReceiptOutputCardProps {
  receipt: ListingReceipt;
  lintPassed: boolean;
  lintErrors: LintError[];
  onCopy?: () => void;
  onTrackCopy?: (copyType: string) => void;
  onAutoFix?: () => void;
  isFixing?: boolean;
  isFallback?: boolean;
  isSimilarityMatch?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  onTrackLintFallback?: () => void;
  region?: Region;
  sellerPackUnlocked?: boolean;
  onSellerPackUpgrade?: () => void;
  isUpgrading?: boolean;
  upgradeFailed?: boolean;
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

const EVIDENCE_STYLES: Record<string, { bg: string; text: string }> = {
  STRONG: { bg: "bg-blue-100", text: "text-blue-700" },
  PARTIAL: { bg: "bg-gray-100", text: "text-gray-600" },
  MISSING: { bg: "bg-orange-100", text: "text-orange-700" },
};

const REASON_CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  routine_friction: { bg: "bg-blue-50", text: "text-blue-600", label: "Routine" },
  listing_risk: { bg: "bg-red-50", text: "text-red-600", label: "Risk" },
  missing_proof: { bg: "bg-orange-50", text: "text-orange-600", label: "Proof" },
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
  isSimilarityMatch,
  onRegenerate,
  isRegenerating,
  onTrackLintFallback,
  region = "US",
  sellerPackUnlocked,
  onSellerPackUpgrade,
  isUpgrading,
  upgradeFailed,
}: ReceiptOutputCardProps) {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
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

  const verdict = VERDICT_STYLES[receipt.verdict];
  const VerdictIcon = verdict.icon;
  const price = PRICE_STYLES[receipt.price_sanity?.label || "UNKNOWN"];

  // Vehicle description
  const ls = receipt.listing_summary;
  const vehicleDesc = [ls?.year, ls?.make, ls?.model, ls?.trim]
    .filter(Boolean)
    .join(" ");
  const priceStr = ls?.price
    ? formatPrice(ls.price, region)
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
        <div className={`${isSimilarityMatch ? "bg-blue-50 border-b border-blue-200" : "bg-amber-50 border-b border-amber-200"} px-5 py-3 flex items-center justify-between`}>
          <p className={`text-sm ${isSimilarityMatch ? "text-blue-800" : "text-amber-800"}`}>
            {isSimilarityMatch
              ? "Based on a similar vehicle — Tap Regenerate for vehicle-specific analysis."
              : "Quick receipt — analysis timed out. Tap Regenerate for a full analysis."}
          </p>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className={`text-sm font-medium underline whitespace-nowrap ml-3 ${isRegenerating ? "opacity-50 cursor-not-allowed" : ""} ${isSimilarityMatch ? "text-blue-700 hover:text-blue-900" : "text-amber-700 hover:text-amber-900"}`}
            >
              {isRegenerating ? "Generating..." : "Regenerate"}
            </button>
          )}
        </div>
      )}

      {/* Full analysis in progress indicator */}
      {isUpgrading && (
        <div className="bg-blue-50 border-b border-blue-200 px-5 py-2.5 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-sm text-blue-700">
            Detailed analysis in progress — your receipt will auto-update with deeper insights.
          </p>
        </div>
      )}

      {/* Upgrade failed - reassurance banner */}
      {upgradeFailed && !isUpgrading && (
        <div className="bg-green-50 border-b border-green-200 px-5 py-3">
          <p className="text-sm text-green-800">
            ✓ Your receipt is complete with {receipt.listing_signals?.length || 0}+ data points analyzed.
            All key risk factors and pricing insights are included.
          </p>
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
              {receipt.evidence_label && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVIDENCE_STYLES[receipt.evidence_label]?.bg || "bg-gray-100"} ${EVIDENCE_STYLES[receipt.evidence_label]?.text || "text-gray-600"}`}>
                  {receipt.evidence_label} Evidence
                </span>
              )}
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
        {region === "UK" && (
          <p className="text-xs text-gray-500 mt-1.5">UK Mode (beta) — prices in pounds, UK wording</p>
        )}
        {typeof receipt.fit_score === "number" && typeof receipt.evidence_score === "number" && (
          <div className="flex gap-4 mt-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>Fit</span>
                <span>{receipt.fit_score}/100</span>
              </div>
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  receipt.fit_score >= 75 ? "bg-green-500" : receipt.fit_score >= 45 ? "bg-yellow-500" : "bg-red-500"
                }`} style={{ width: `${receipt.fit_score}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>Evidence</span>
                <span>{receipt.evidence_score}/100</span>
              </div>
              <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${
                  receipt.evidence_score >= 75 ? "bg-blue-500" : receipt.evidence_score >= 45 ? "bg-gray-400" : "bg-orange-500"
                }`} style={{ width: `${receipt.evidence_score}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Why not GREEN? */}
      {receipt.why_not_green && receipt.why_not_green.length > 0 && receipt.verdict !== "GREEN" && (
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Why not GREEN?
          </p>
          <ul className="space-y-1">
            {receipt.why_not_green.map((reason: { signal_id: string; category: string; points: number; label: string }, i: number) => {
              const catStyle = REASON_CATEGORY_STYLES[reason.category] || REASON_CATEGORY_STYLES.listing_risk;
              return (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${catStyle.bg} ${catStyle.text}`}>
                    {catStyle.label}
                  </span>
                  <span className="flex-1">{reason.label}</span>
                  {reason.points !== 0 && (
                    <span className="text-xs text-gray-400 whitespace-nowrap">{reason.points}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Prominent Copy Checklist — above the fold */}
      <div className="px-5 pt-4">
        <button
          onClick={() => {
            if (sellerPackUnlocked === false && receipt.must_answer_questions.length > 2) {
              onSellerPackUpgrade?.();
              return;
            }
            copySection(
              receipt.must_answer_questions
                .map((q, i) => `${i + 1}. ${q}`)
                .join("\n"),
              "must-ask"
            );
          }}
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
                  <span>{humanizeFlag(flag)}</span>
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
              receipt.risk_flags.slice(0, 3).forEach((f) => lines.push(`! ${humanizeFlag(f)}`));
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

        {/* Risk Flags (reframed for GREEN verdicts) */}
        {(() => {
          const isGreen = receipt.verdict === "GREEN";
          return (
            <Section
              icon={isGreen
                ? <Search className="w-4 h-4 text-amber-500" />
                : <AlertTriangle className="w-4 h-4 text-red-500" />}
              title={isGreen ? "What to Verify" : "Risk Flags"}
            >
              <ul className="space-y-2">
                {receipt.risk_flags.map((flag, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    {isGreen
                      ? <span className="text-amber-400 font-bold mt-0.5">{i + 1}.</span>
                      : <span className="text-red-400 mt-0.5">!</span>}
                    <span>{humanizeFlag(flag)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })()}

        {/* Must Answer Questions */}
        {(() => {
          const questions = receipt.must_answer_questions;
          const showAll = sellerPackUnlocked !== false || questions.length <= 2;
          const visibleQuestions = showAll ? questions : questions.slice(0, 2);
          const lockedCount = showAll ? 0 : questions.length - 2;

          return (
            <Section
              icon={<HelpCircle className="w-4 h-4 text-blue-500" />}
              title="Must-Ask Questions"
              onCopy={showAll ? () =>
                copySection(
                  questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
                  "must-ask"
                ) : undefined
              }
              copied={copiedSection === "must-ask"}
            >
              <ul className="space-y-2">
                {visibleQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">{i + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
                {lockedCount > 0 && (
                  <>
                    {questions.slice(2).map((_, i) => (
                      <li key={`locked-${i}`} className="text-sm flex items-start gap-2 select-none">
                        <span className="text-gray-300 font-bold mt-0.5">{i + 3}.</span>
                        <span className="text-gray-300 blur-[5px]">This question is locked — unlock to see</span>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={onSellerPackUpgrade}
                        className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors mt-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Unlock all {questions.length} questions
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </Section>
          );
        })()}

        {/* Verify Before Visit */}
        {receipt.verify_before_visit && receipt.verify_before_visit.length > 0 && (
          <Section
            icon={<FileSearch className="w-4 h-4 text-purple-500" />}
            title="Verify Before Visit"
          >
            <ul className="space-y-2">
              {receipt.verify_before_visit.map((item: string, i: number) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-purple-400 font-bold mt-0.5">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}


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

      {/* Regenerate button — always visible for non-fallback receipts */}
      {!isFallback && onRegenerate && (
        <div className="px-5 pb-4">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="w-full py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegenerating ? "Generating fresh analysis..." : "Regenerate analysis"}
          </button>
        </div>
      )}

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
