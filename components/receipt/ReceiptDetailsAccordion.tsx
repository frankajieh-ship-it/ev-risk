/**
 * ReceiptDetailsAccordion — Expandable sections for fee estimates,
 * listing tricks, walk-away triggers, and operator notes.
 */

"use client";

import { useState } from "react";
import { ChevronDown, DollarSign, Eye, Ban, Brain } from "lucide-react";
import { formatPrice, type Region } from "@/lib/region";
import type { ReceiptDetails, OperatorNotes, ListingSummary } from "@/types/receipt";

interface ReceiptDetailsAccordionProps {
  details: ReceiptDetails;
  operatorNotes?: OperatorNotes;
  listingSummary?: ListingSummary;
  region?: Region;
}

type SectionId = "fees" | "tricks" | "walkaway" | "operator" | "listing";

export default function ReceiptDetailsAccordion({
  details,
  operatorNotes,
  listingSummary,
  region = "US",
}: ReceiptDetailsAccordionProps) {
  const [open, setOpen] = useState<SectionId | null>(null);

  const toggle = (id: SectionId) => {
    setOpen(open === id ? null : id);
  };

  return (
    <div className="bg-[#161b22] rounded-2xl border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06]">
      {/* Fee Estimates */}
      {details.fee_estimates && (
        <AccordionItem
          id="fees"
          isOpen={open === "fees"}
          onToggle={() => toggle("fees")}
          icon={<DollarSign className="w-4 h-4 text-green-600" />}
          title="Fee Estimates"
        >
          <div className="space-y-2 text-sm text-white/70">
            {details.fee_estimates.tax_estimate_range && (
              <div className="flex justify-between">
                <span>{region === "UK" ? "VAT estimate:" : "Tax estimate:"}</span>
                <span className="font-medium text-white">
                  {formatPrice(details.fee_estimates.tax_estimate_range.low, region)} –
                  {formatPrice(details.fee_estimates.tax_estimate_range.high, region)}
                </span>
              </div>
            )}
            {details.fee_estimates.doc_fee_estimate_range && (
              <div className="flex justify-between">
                <span>{region === "UK" ? "Admin fee estimate:" : "Doc fee estimate:"}</span>
                <span className="font-medium text-white">
                  {formatPrice(details.fee_estimates.doc_fee_estimate_range.low, region)} –
                  {formatPrice(details.fee_estimates.doc_fee_estimate_range.high, region)}
                </span>
              </div>
            )}
            {details.fee_estimates.notes && (
              <p className="text-xs text-white/40 mt-1">{details.fee_estimates.notes}</p>
            )}
          </div>
        </AccordionItem>
      )}

      {/* Common Listing Tricks */}
      {Array.isArray(details.common_listing_tricks) && details.common_listing_tricks.length > 0 && (
        <AccordionItem
          id="tricks"
          isOpen={open === "tricks"}
          onToggle={() => toggle("tricks")}
          icon={<Eye className="w-4 h-4 text-yellow-600" />}
          title="Common Listing Tricks"
        >
          <ul className="space-y-1.5">
            {details.common_listing_tricks.map((trick, i) => (
              <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">*</span>
                <span>{trick}</span>
              </li>
            ))}
          </ul>
        </AccordionItem>
      )}

      {/* Walk-Away Triggers */}
      {Array.isArray(details.walk_away_triggers) && details.walk_away_triggers.length > 0 && (
        <AccordionItem
          id="walkaway"
          isOpen={open === "walkaway"}
          onToggle={() => toggle("walkaway")}
          icon={<Ban className="w-4 h-4 text-red-500" />}
          title="Walk-Away Triggers"
        >
          <ul className="space-y-1.5">
            {details.walk_away_triggers.map((trigger, i) => (
              <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                <span className="text-red-400 mt-0.5">x</span>
                <span>{trigger}</span>
              </li>
            ))}
          </ul>
        </AccordionItem>
      )}

      {/* Operator Notes */}
      {operatorNotes && (
        <AccordionItem
          id="operator"
          isOpen={open === "operator"}
          onToggle={() => toggle("operator")}
          icon={<Brain className="w-4 h-4 text-purple-500" />}
          title="How summary was made"
        >
          <div className="space-y-3 text-sm">
            <p className="text-white/70">{operatorNotes.rationale}</p>
            {(operatorNotes.assumptions?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-white/40 uppercase mb-1">
                  Assumptions
                </p>
                <ul className="space-y-1">
                  {operatorNotes.assumptions?.map((a, i) => (
                    <li key={i} className="text-white/50 text-xs">
                      - {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(operatorNotes.what_would_change_verdict?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-white/40 uppercase mb-1">
                  What would change the verdict
                </p>
                <ul className="space-y-1">
                  {operatorNotes.what_would_change_verdict?.map((w, i) => (
                    <li key={i} className="text-white/50 text-xs">
                      - {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AccordionItem>
      )}

      {/* Listing Summary */}
      {listingSummary && (
        <AccordionItem
          id="listing"
          isOpen={open === "listing"}
          onToggle={() => toggle("listing")}
          icon={<Eye className="w-4 h-4 text-blue-500" />}
          title="Listing Details"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {listingSummary.seller_type && listingSummary.seller_type !== "unknown" && (
              <Detail label="Seller" value={listingSummary.seller_type} />
            )}
            {listingSummary.title_status && listingSummary.title_status !== "unknown" && (
              <Detail label="Title" value={listingSummary.title_status} />
            )}
            {listingSummary.accidents_reported && listingSummary.accidents_reported !== "unknown" && (
              <Detail label="Accidents" value={listingSummary.accidents_reported} />
            )}
            {listingSummary.service_history && listingSummary.service_history !== "unknown" && (
              <Detail label="Service history" value={listingSummary.service_history} />
            )}
            {listingSummary.owners && (
              <Detail label="Owners" value={String(listingSummary.owners)} />
            )}
            {listingSummary.carfax_available && listingSummary.carfax_available !== "unknown" && (
              <Detail label="Carfax" value={listingSummary.carfax_available} />
            )}
            {listingSummary.country && (
              <Detail label="Country" value={listingSummary.country} />
            )}
            {listingSummary.zip_or_postcode && (
              <Detail label="ZIP" value={listingSummary.zip_or_postcode} />
            )}
          </div>
        </AccordionItem>
      )}
    </div>
  );
}

// --- Accordion Item ---

function AccordionItem({
  id,
  isOpen,
  onToggle,
  icon,
  title,
  children,
}: {
  id: string;
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`accordion-${id}`}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-white/80">{title}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/30 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && <div id={`accordion-${id}`} className="px-5 pb-4">{children}</div>}
    </div>
  );
}

// --- Detail helper ---

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-white/40 text-xs">{label}</span>
      <p className="text-white/80 font-medium capitalize">{value}</p>
    </div>
  );
}
