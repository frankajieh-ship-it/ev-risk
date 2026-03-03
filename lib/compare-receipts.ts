/**
 * Receipt Comparison — Deterministic Delta Computation
 *
 * Compares two listing receipts and returns human-readable
 * bullet points highlighting key differences.
 */

import type { ListingReceipt } from "@/types/receipt";
import { humanizeFlag } from "@/lib/receipt-rules";

/**
 * Compute delta bullets between two receipts.
 * Returns 0–10 bullets highlighting meaningful differences.
 */
export function computeReceiptDelta(
  receiptA: ListingReceipt,
  receiptB: ListingReceipt
): string[] {
  const bullets: string[] = [];
  const a = receiptA.listing_summary;
  const b = receiptB.listing_summary;

  const nameA = [a.year, a.make, a.model].filter(Boolean).join(" ") || "Listing A";
  const nameB = [b.year, b.make, b.model].filter(Boolean).join(" ") || "Listing B";

  // Price delta
  if (a.price > 0 && b.price > 0) {
    const diff = a.price - b.price;
    const absDiff = Math.abs(diff);
    const pct = Math.round((absDiff / Math.max(a.price, b.price)) * 100);
    if (absDiff >= 500) {
      const cheaper = diff > 0 ? nameB : nameA;
      const currency = a.currency === "GBP" ? "\u00A3" : "$";
      bullets.push(
        `${cheaper} is ${currency}${absDiff.toLocaleString()} cheaper (${pct}% less)`
      );
    }
  }

  // Mileage delta
  if (a.mileage > 0 && b.mileage > 0) {
    const diff = a.mileage - b.mileage;
    const absDiff = Math.abs(diff);
    const unit = a.mileage_unit === "km" ? "km" : "miles";
    if (absDiff >= 5000) {
      const lower = diff > 0 ? nameB : nameA;
      bullets.push(
        `${lower} has ${absDiff.toLocaleString()} fewer ${unit}`
      );
    }
  }

  // Year delta
  if (a.year > 0 && b.year > 0 && a.year !== b.year) {
    const diff = a.year - b.year;
    const newer = diff > 0 ? nameA : nameB;
    bullets.push(
      `${newer} is ${Math.abs(diff)} year${Math.abs(diff) > 1 ? "s" : ""} newer`
    );
  }

  // Verdict comparison
  if (receiptA.verdict !== receiptB.verdict) {
    bullets.push(
      `${nameA} verdict is ${receiptA.verdict}, ${nameB} is ${receiptB.verdict}`
    );
  }

  // Price sanity comparison
  const psA = receiptA.price_sanity.label;
  const psB = receiptB.price_sanity.label;
  if (psA !== psB && psA !== "UNKNOWN" && psB !== "UNKNOWN") {
    bullets.push(
      `${nameA} is rated ${psA}, ${nameB} is rated ${psB}`
    );
  }

  // Risk flags unique to each
  const flagsA = new Set(receiptA.risk_flags);
  const flagsB = new Set(receiptB.risk_flags);
  const uniqueToA = receiptA.risk_flags.filter((f) => !flagsB.has(f));
  const uniqueToB = receiptB.risk_flags.filter((f) => !flagsA.has(f));
  if (uniqueToA.length > 0) {
    bullets.push(
      `${nameA} has a unique risk: "${humanizeFlag(uniqueToA[0])}"`
    );
  }
  if (uniqueToB.length > 0) {
    bullets.push(
      `${nameB} has a unique risk: "${humanizeFlag(uniqueToB[0])}"`
    );
  }

  // Seller type difference
  if (
    a.seller_type !== b.seller_type &&
    a.seller_type !== "unknown" &&
    b.seller_type !== "unknown"
  ) {
    bullets.push(
      `${nameA} is from a ${a.seller_type}, ${nameB} is from a ${b.seller_type}`
    );
  }

  // Title status difference
  if (
    a.title_status !== b.title_status &&
    a.title_status !== "unknown" &&
    b.title_status !== "unknown"
  ) {
    bullets.push(
      `${nameA} has ${a.title_status} title, ${nameB} has ${b.title_status} title`
    );
  }

  return bullets.slice(0, 10);
}
