"use client";

import type { ListingAISummary } from "@/lib/receipt-sections";

interface ReceiptSummaryCardProps {
  receiptId: string;
  isUpgrading: boolean;
  generationStatus: string;
  initialSummary?: ListingAISummary | null;
  initialStatus?: string;
  verdict: "GREEN" | "YELLOW" | "RED";
  vin?: string | null;
}

export default function ReceiptSummaryCard(_props: ReceiptSummaryCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#161b22] px-5 py-4 flex items-center justify-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00d97e] animate-pulse" />
      <p className="text-sm font-medium text-white/60">Summary <span className="text-[#00d97e]">coming soon</span></p>
    </div>
  );
}
