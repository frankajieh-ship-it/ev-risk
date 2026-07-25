/**
 * News Alert Email Templates
 *
 * Two variants:
 *   buildRecallAlert()   — standalone, safety-critical, red header
 *   buildNewsDigest()    — batched daily digest, amber/green header, 1-3 articles
 *
 * Both use the same OFFO dark-mode email shell.
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";
import type { NewsArticleMatch } from "@/lib/crm-queries";

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    recall: "Safety Recall",
    routine_impact: "EV News",
    used_market: "Market Update",
    charging_network: "Charging Update",
  };
  return map[category] ?? "EV News";
}

function categoryColor(category: string): string {
  const map: Record<string, string> = {
    recall: "#da3633",
    used_market: "#1f6feb",
    charging_network: "#1f6feb",
    routine_impact: "#e3a537",
  };
  return map[category] ?? "#e3a537";
}

function articleBlock(article: NewsArticleMatch): string {
  const color = categoryColor(article.category);
  const label = categoryLabel(article.category);
  return `
    <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px;margin-bottom:12px;">
      <div style="margin-bottom:8px;">
        <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${color};background:${color}1a;">${label}</span>
        <span style="font-size:11px;color:#8b949e;margin-left:8px;">${article.matchedVehicle}</span>
      </div>
      <p style="font-size:14px;font-weight:600;color:#e6edf3;margin:0 0 6px;line-height:1.4;">${article.title}</p>
      ${article.aiSummary ? `<p style="font-size:13px;color:#8b949e;margin:0 0 10px;line-height:1.5;">${article.aiSummary}</p>` : ""}
      <a href="${article.url}" style="font-size:13px;color:#00d97e;text-decoration:none;">Read more → ${article.source ? `<span style="color:#8b949e;">(${article.source})</span>` : ""}</a>
    </div>`;
}

// ── Standalone recall alert ───────────────────────────────────────────────────

export function buildRecallAlert(
  email: string,
  vehicle: string,
  recalls: NewsArticleMatch[]
): { subject: string; html: string } {
  const receiptUrl = `${SITE_URL}/receipt`;
  const recallBlocks = recalls.slice(0, 3).map(articleBlock).join("");
  const count = recalls.length;

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#f59e0b1a;border:1px solid #f59e0b33;border-radius:20px;padding:4px 16px;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:700;color:#f59e0b;">Open Recall${count > 1 ? "s" : ""} — Pre-Purchase Checklist</span>
      </div>
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 6px;">${count === 1 ? "1 open recall" : `${count} open recalls`} on your saved listing</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicle}</p>
    </div>
    <div style="background:#0d2818;border:1px solid #00d97e33;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <p style="font-size:14px;color:#c9d1d9;margin:0;line-height:1.6;">
        <strong style="color:#00d97e;">This is a heads-up, not a dealbreaker.</strong> Open recalls are repaired by dealers at no cost to you — and a remedied recall means the issue is already fixed.
        Before you sign, confirm each recall below has been completed on this VIN at
        <a href="https://www.nhtsa.gov/vehicle/recalls" style="color:#00d97e;text-decoration:none;">nhtsa.gov</a>
        or ask the dealer to show you the repair order.
      </p>
    </div>
    ${recallBlocks}
    <div style="background:#161b22;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #30363d;">
      <p style="font-size:13px;color:#8b949e;margin:0;line-height:1.6;">
        <strong style="color:#e6edf3;">What to ask:</strong> &ldquo;Has recall [campaign number] been completed on this VIN?&rdquo; Get it in writing on the buyers order before you purchase.
      </p>
    </div>
    <div style="text-align:center;margin:20px 0 16px;">
      ${ctaButton("Check my OFFO report →", receiptUrl)}
    </div>
    ${emailFooter(email, "recall")}`;

  const subjectPrefix = count > 1 ? `${count} open recalls` : "1 open recall";
  return {
    subject: `${subjectPrefix} on your ${vehicle} — confirm before you buy`,
    html: emailWrapper(body),
  };
}

// ── Daily news digest (non-recall impact articles) ────────────────────────────

export function buildNewsDigest(
  email: string,
  articles: NewsArticleMatch[]
): { subject: string; html: string } {
  // Show up to 3 articles; most-impactful first (already sorted by caller)
  const shown = articles.slice(0, 3);
  const vehicles = [...new Set(shown.map((a) => a.matchedVehicle))].join(", ");
  const receiptUrl = `${SITE_URL}/receipt`;

  const articleBlocks = shown.map(articleBlock).join("");

  // Pick subject based on dominant category
  const hasMarket = shown.some((a) => a.category === "used_market");
  const hasCharging = shown.some((a) => a.category === "charging_network");
  const subjectSuffix = hasMarket
    ? "may affect your listing&apos;s value"
    : hasCharging
    ? "affects charging near your listing"
    : "could affect your listing";

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="font-size:21px;color:#e6edf3;margin:0 0 6px;">News that affects your listings</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicles}</p>
    </div>
    <p style="font-size:14px;color:#c9d1d9;margin:0 0 18px;line-height:1.6;">
      ${shown.length === 1 ? "A new article" : `${shown.length} new articles`} matched your saved listings in the last 24 hours.
    </p>
    ${articleBlocks}
    <div style="text-align:center;margin:24px 0 16px;">
      ${ctaButton("Check my OFFO report →", receiptUrl)}
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:0 0 24px;">
      You&apos;re receiving this because you saved a listing on OFFO Lab.
    </p>
    ${emailFooter(email, "recall")}`;

  return {
    subject: `EV news that ${subjectSuffix} — ${vehicles}`,
    html: emailWrapper(body),
  };
}
