import { humanizeFlag } from "@/lib/receipt-rules";
import type { ListingReceipt } from "@/types/receipt";

export function buildTweetText(receipt: ListingReceipt, shareSlug: string, baseUrl = "https://offolab.com"): string {
  const year = receipt.listing_summary?.year ?? "";
  const make = receipt.listing_summary?.make ?? "";
  const model = receipt.listing_summary?.model ?? "";
  const verdict = receipt.verdict ?? "YELLOW";
  const verdictEmoji = verdict === "GREEN" ? "🟢" : verdict === "RED" ? "🔴" : "🟡";

  let context = "";
  const priceSanityLabel = receipt.price_sanity?.label;
  if (priceSanityLabel && priceSanityLabel !== "UNKNOWN") {
    const label =
      priceSanityLabel === "OVERPRICED" ? "overpriced"
      : priceSanityLabel === "UNDERPRICED" ? "underpriced"
      : "fair price";
    context = `\n${label} vs. comparables`;
  } else if (receipt.risk_flags?.[0]) {
    context = `\n${humanizeFlag(receipt.risk_flags[0]).slice(0, 60)}`;
  }

  const url = `${baseUrl}/r/${shareSlug}?utm_source=twitter&utm_medium=share&utm_campaign=receipt_share`;
  return `Just checked a ${year} ${make} ${model} on @offolab — ${verdictEmoji} ${verdict} verdict${context}\nFree check → ${url} #UsedEV #EVBuying`;
}

export function buildTweetUrl(receipt: ListingReceipt, shareSlug: string): string {
  const text = buildTweetText(receipt, shareSlug);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
