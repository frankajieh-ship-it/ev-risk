/**
 * Share Snapshot — Extract public-safe fields from a receipt
 *
 * Used when creating a QR share link. Only includes fields
 * safe for public display — no email, no routine data, no
 * internal scoring fields.
 */

import type { ShareSnapshot, PriceSanityLabel } from "@/types/receipt";

export function createShareSnapshot(receipt: Record<string, unknown>): ShareSnapshot {
  const ls = (receipt.listing_summary || {}) as Record<string, unknown>;
  const ps = (receipt.price_sanity || {}) as Record<string, unknown>;

  return {
    verdict: (receipt.verdict as ShareSnapshot["verdict"]) || "YELLOW",
    verdict_reason: (receipt.verdict_reason as string) || "",
    risk_flags: Array.isArray(receipt.risk_flags)
      ? (receipt.risk_flags as string[]).slice(0, 3)
      : [],
    must_answer_questions: Array.isArray(receipt.must_answer_questions)
      ? (receipt.must_answer_questions as string[]).slice(0, 3)
      : [],
    price_sanity_label: (ps.label as PriceSanityLabel) || "UNKNOWN",
    listing_summary: {
      year: (ls.year as number) ?? null,
      make: (ls.make as string) ?? null,
      model: (ls.model as string) ?? null,
      price: (ls.price as number) ?? null,
      mileage: (ls.mileage as number) ?? null,
      seller_type: (ls.seller_type as string) ?? null,
    },
    timestamp: new Date().toISOString(),
  };
}
