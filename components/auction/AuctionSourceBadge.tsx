"use client";

import { Tag } from "lucide-react";
import type { AuctionSource } from "@/lib/auction/types";

interface AuctionSourceBadgeProps {
  source: AuctionSource;
  lotNumber: string;
}

const SOURCE_CONFIG: Record<AuctionSource, { label: string; className: string }> = {
  copart: {
    label: "COPART",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  iaai: {
    label: "IAAI",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  manheim: {
    label: "MANHEIM",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

export default function AuctionSourceBadge({ source, lotNumber }: AuctionSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.copart;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${config.className}`}
      >
        <Tag className="w-3 h-3" />
        {config.label} · Lot {lotNumber}
      </span>
    </div>
  );
}
