/**
 * NegotiatorSection — Seller Strategy assembled from existing receipt data
 *
 * Always visible on every receipt. Combines negotiation_opener, risk_flags,
 * must_answer_questions, walk_away_triggers, and price_sanity into a
 * ready-to-use negotiation package. Generated from the existing receipt.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Copy,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Search,
  XCircle,
  DollarSign,
  ArrowUpCircle,
  Lock,
} from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { humanizeFlag } from "@/lib/receipt-rules";
import { formatPrice, type Region } from "@/lib/region";
import { getDisplayPriceForRegion } from "@/lib/price-assignment";
import type { ListingReceipt } from "@/types/receipt";

interface NegotiatorSectionProps {
  receipt: ListingReceipt;
  isUnlocked: boolean;
  onUpgradeClick: () => void;
  freeMode?: boolean;
  region?: Region;
  sellerPackUnlocked?: boolean;
  onSellerPackUpgrade?: () => void;
}

type CopiedKey = "opener" | "talking" | "questions" | "inspect" | "walkaway" | "offer" | "all" | null;

export default function NegotiatorSection({
  receipt,
  isUnlocked,
  onUpgradeClick,
  freeMode = false,
  region = "US",
  sellerPackUnlocked,
  onSellerPackUpgrade,
}: NegotiatorSectionProps) {
  const { trackEvent } = useEventTracking();
  const [copied, setCopied] = useState<CopiedKey>(null);

  // Track shown on mount
  useEffect(() => {
    trackEvent("negotiator_shown", { receipt_id: receipt.receipt_id });
  }, [receipt.receipt_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const copyText = useCallback(
    async (text: string, key: CopiedKey) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        trackEvent("negotiator_copy_clicked", {
          receipt_id: receipt.receipt_id,
          section: key,
        });
        setTimeout(() => setCopied(null), 2000);
      } catch {
        // Silently fail
      }
    },
    [receipt.receipt_id, trackEvent]
  );

  // Build suggested offer range from price_sanity
  const price = receipt.listing_summary?.price;
  const priceSanity = receipt.price_sanity;
  let offerRange: { low: string; high: string; rationale: string } | null = null;

  if (price && priceSanity) {
    if (priceSanity.label === "OVERPRICED") {
      const low = Math.round(price * 0.82);
      const high = Math.round(price * 0.9);
      offerRange = {
        low: formatPrice(low, region),
        high: formatPrice(high, region),
        rationale: "This listing appears overpriced. Start 10-18% below asking.",
      };
    } else if (priceSanity.label === "FAIR") {
      const low = Math.round(price * 0.93);
      offerRange = {
        low: formatPrice(low, region),
        high: formatPrice(price, region),
        rationale: "Price is fair. You have room to negotiate 5-7% below.",
      };
    } else if (priceSanity.label === "UNDERPRICED") {
      offerRange = {
        low: formatPrice(price, region),
        high: formatPrice(price, region),
        rationale: "This looks underpriced — offer at or near asking before someone else does.",
      };
    }
  }

  const walkAwayTriggers = receipt.receipt_details?.walk_away_triggers ?? [];

  // Build full text for "Copy All" button
  const buildFullText = () => {
    const lines: string[] = [];
    lines.push("=== SELLER STRATEGY ===\n");

    lines.push("OPENING LINE:");
    lines.push(receipt.negotiation_opener);
    lines.push("");

    lines.push("TALKING POINTS (from risk flags):");
    receipt.risk_flags.forEach((f, i) => lines.push(`${i + 1}. ${humanizeFlag(f)}`));
    lines.push("");

    lines.push("MUST-ASK QUESTIONS:");
    receipt.must_answer_questions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
    lines.push("");

    if (receipt.inspect_first && receipt.inspect_first.length > 0) {
      lines.push("INSPECT FIRST:");
      receipt.inspect_first.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
      lines.push("");
    }

    if (walkAwayTriggers.length > 0) {
      lines.push("WALK-AWAY TRIGGERS:");
      walkAwayTriggers.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
      lines.push("");
    }

    if (offerRange) {
      lines.push("SUGGESTED OFFER:");
      lines.push(`${offerRange.low} – ${offerRange.high}`);
      lines.push(offerRange.rationale);
    }

    return lines.join("\n");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-green-600" />
          <h2 className="text-base font-bold text-gray-900">Seller Strategy</h2>
        </div>
        <CopyButton
          onClick={() => copyText(buildFullText(), "all")}
          copied={copied === "all"}
          label="Copy all"
        />
      </div>

      <div className="p-5 space-y-4">
        {/* Opening Line */}
        <StrategyBlock
          icon={<MessageSquare className="w-4 h-4 text-green-500" />}
          title="Opening Line"
          onCopy={() => copyText(receipt.negotiation_opener, "opener")}
          copied={copied === "opener"}
        >
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-gray-800 italic">
              &ldquo;{receipt.negotiation_opener}&rdquo;
            </p>
          </div>
        </StrategyBlock>

        {/* Talking Points (from risk flags) */}
        <StrategyBlock
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          title="Talking Points"
          subtitle="Leverage these in your negotiation"
          onCopy={() =>
            copyText(
              receipt.risk_flags.map((f, i) => `${i + 1}. ${humanizeFlag(f)}`).join("\n"),
              "talking"
            )
          }
          copied={copied === "talking"}
        >
          <ol className="space-y-1.5">
            {receipt.risk_flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-red-400 font-bold flex-shrink-0 w-5 text-right">
                  {i + 1}.
                </span>
                <span>{humanizeFlag(flag)}</span>
              </li>
            ))}
          </ol>
        </StrategyBlock>

        {/* Must-Ask Questions */}
        {(() => {
          const questions = receipt.must_answer_questions;
          const showAll = sellerPackUnlocked !== false || questions.length <= 2;
          const visibleQuestions = showAll ? questions : questions.slice(0, 2);
          const lockedCount = showAll ? 0 : questions.length - 2;

          return (
            <StrategyBlock
              icon={<HelpCircle className="w-4 h-4 text-blue-500" />}
              title="Must-Ask Questions"
              subtitle="Don't leave without answers"
              onCopy={showAll ? () =>
                copyText(
                  questions.map((q, i) => `${i + 1}. ${q}`).join("\n"),
                  "questions"
                ) : undefined
              }
              copied={copied === "questions"}
            >
              <ol className="space-y-1.5">
                {visibleQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 font-bold flex-shrink-0 w-5 text-right">
                      {i + 1}.
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
                {lockedCount > 0 && (
                  <>
                    {questions.slice(2).map((_, i) => (
                      <li key={`locked-${i}`} className="flex items-start gap-2 text-sm select-none">
                        <span className="text-gray-300 font-bold flex-shrink-0 w-5 text-right">
                          {i + 3}.
                        </span>
                        <span className="text-gray-300 blur-[5px]">This question is locked — unlock to see</span>
                      </li>
                    ))}
                    <li className="mt-1">
                      <button
                        onClick={onSellerPackUpgrade}
                        className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Unlock all {questions.length} questions
                      </button>
                    </li>
                  </>
                )}
              </ol>
            </StrategyBlock>
          );
        })()}

        {/* Inspect First */}
        {receipt.inspect_first && receipt.inspect_first.length > 0 && (
          <StrategyBlock
            icon={<Search className="w-4 h-4 text-orange-500" />}
            title="Inspect First"
            subtitle="Check these before discussing price"
            onCopy={() =>
              copyText(
                receipt.inspect_first.map((item, i) => `${i + 1}. ${item}`).join("\n"),
                "inspect"
              )
            }
            copied={copied === "inspect"}
          >
            <ol className="space-y-1.5">
              {receipt.inspect_first.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-orange-400 font-bold flex-shrink-0 w-5 text-right">
                    {i + 1}.
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </StrategyBlock>
        )}

        {/* Walk-Away Triggers */}
        {walkAwayTriggers.length > 0 && (
          <StrategyBlock
            icon={<XCircle className="w-4 h-4 text-orange-500" />}
            title="Walk-Away Triggers"
            subtitle="Leave if any of these come up"
            onCopy={() =>
              copyText(
                walkAwayTriggers.map((t, i) => `${i + 1}. ${t}`).join("\n"),
                "walkaway"
              )
            }
            copied={copied === "walkaway"}
          >
            <ol className="space-y-1.5">
              {walkAwayTriggers.map((trigger, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-orange-500 font-bold flex-shrink-0 w-5 text-right">
                    {i + 1}.
                  </span>
                  <span>{trigger}</span>
                </li>
              ))}
            </ol>
          </StrategyBlock>
        )}

        {/* Suggested Offer Range */}
        {offerRange && (
          <StrategyBlock
            icon={<DollarSign className="w-4 h-4 text-green-600" />}
            title="Suggested Offer"
            onCopy={() =>
              copyText(
                `Offer range: ${offerRange!.low} – ${offerRange!.high}\n${offerRange!.rationale}`,
                "offer"
              )
            }
            copied={copied === "offer"}
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-bold text-gray-900">
                  {offerRange.low} – {offerRange.high}
                </span>
              </div>
              <p className="text-xs text-gray-600">{offerRange.rationale}</p>
            </div>
          </StrategyBlock>
        )}

        {/* Upsell CTA for paid negotiation scripts (hidden in free mode) */}
        {!isUnlocked && !freeMode && (
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Want detailed negotiation scripts for 3 scenarios?
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Full scripts with opening lines, body text, and responses to common pushback.
                </p>
              </div>
              <button
                onClick={() => {
                  trackEvent("negotiator_upsell_clicked", {
                    receipt_id: receipt.receipt_id,
                  });
                  onUpgradeClick();
                }}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                Get Buyer Pass — {getDisplayPriceForRegion("999", region)}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- Helper Components ---

function StrategyBlock({
  icon,
  title,
  subtitle,
  onCopy,
  copied,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onCopy?: () => void;
  copied: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <span className="text-xs text-gray-400 hidden sm:inline">— {subtitle}</span>
          )}
        </div>
        {onCopy && <CopyButton onClick={onCopy} copied={copied} />}
      </div>
      {children}
    </div>
  );
}

function CopyButton({
  onClick,
  copied,
  label,
}: {
  onClick: () => void;
  copied: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
    >
      {copied ? (
        <>
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-green-600">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
}
