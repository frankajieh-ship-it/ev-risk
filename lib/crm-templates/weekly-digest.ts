/**
 * Weekly Digest Email Template
 *
 * Sent every Monday to auth users with deal watches or saved scenarios.
 * Market snapshot is computed once per run (not per-user).
 */

import { SITE_URL, ctaButton, verdictBadge } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";
import type { MarketSnapshot, NewsDigestArticle } from "@/lib/crm-queries";

export interface WeeklyDigestContext {
  email: string;
  userId?: string;
  dealWatchMatches: number;
  receiptsThisWeek: number;
  marketSnapshot: MarketSnapshot;
  lastVehicle?: string;
  lastVerdict?: string;
  topNews: NewsDigestArticle[];
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  recall:           { label: "🔴 Recall",      color: "#dc2626" },
  used_market:      { label: "💲 Used Market",  color: "#ca8a04" },
  charging_network: { label: "⚡ Charging",     color: "#2563eb" },
  routine_impact:   { label: "📡 Routine",      color: "#6b7280" },
};

export function buildWeeklyDigest(ctx: WeeklyDigestContext): { subject: string; html: string } {
  const { email, dealWatchMatches, receiptsThisWeek, marketSnapshot, lastVehicle, lastVerdict, topNews } = ctx;

  const dealWatchSection = dealWatchMatches > 0
    ? `<div style="background:#f0fdf4;border-radius:10px;padding:16px 18px;margin-bottom:12px;border:1px solid #bbf7d0;">
        <p style="font-size:14px;font-weight:700;color:#166534;margin:0 0 6px;">
          📉 ${dealWatchMatches} price drop${dealWatchMatches !== 1 ? "s" : ""} on your saved searches
        </p>
        <p style="font-size:13px;color:#166534;margin:0 0 10px;">
          Matching vehicles dropped in price since your last check.
        </p>
        ${ctaButton("View deal watch →", `${SITE_URL}/workspace/deal-watch`, "#16a34a")}
      </div>`
    : `<div style="background:#f9fafb;border-radius:10px;padding:14px 18px;margin-bottom:12px;border:1px solid #e5e7eb;">
        <p style="font-size:13px;color:#6b7280;margin:0;">No price drops this week on your saved searches.</p>
      </div>`;

  const receiptsSection = receiptsThisWeek > 0
    ? `<div style="background:#eff6ff;border-radius:10px;padding:14px 18px;margin-bottom:12px;border:1px solid #bfdbfe;">
        <p style="font-size:13px;color:#1e40af;margin:0;">
          You ran <strong>${receiptsThisWeek} receipt${receiptsThisWeek !== 1 ? "s" : ""}</strong> this week.
          <a href="${SITE_URL}/workspace" style="color:#1e40af;margin-left:4px;">View history →</a>
        </p>
      </div>`
    : "";

  const lastReceiptSection = lastVehicle
    ? `<div style="background:white;border-radius:10px;padding:16px 18px;margin-bottom:12px;border:1px solid #e5e7eb;">
        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">Your last receipt</p>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
          <span style="font-size:14px;color:#111827;font-weight:600;">${lastVehicle}</span>
          ${lastVerdict ? verdictBadge(lastVerdict as "GREEN" | "YELLOW" | "RED") : ""}
        </div>
        ${ctaButton("View in workspace →", `${SITE_URL}/workspace`, "#111827")}
      </div>`
    : "";

  const marketSection = marketSnapshot.totalReceipts > 0
    ? `<div style="background:white;border-radius:10px;padding:16px 18px;margin-bottom:12px;border:1px solid #e5e7eb;">
        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">Market this week</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#374151;">Avg listing price</td>
            <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:600;text-align:right;">
              ${marketSnapshot.avgPrice > 0 ? `$${marketSnapshot.avgPrice.toLocaleString()}` : "—"}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#374151;">Clean deals (GREEN)</td>
            <td style="padding:4px 0;font-size:13px;color:#16a34a;font-weight:600;text-align:right;">${marketSnapshot.greenPct}%</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#374151;">Needs review (YELLOW)</td>
            <td style="padding:4px 0;font-size:13px;color:#ca8a04;font-weight:600;text-align:right;">${marketSnapshot.yellowPct}%</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#374151;">High risk (RED)</td>
            <td style="padding:4px 0;font-size:13px;color:#dc2626;font-weight:600;text-align:right;">${marketSnapshot.redPct}%</td>
          </tr>
        </table>
        <p style="font-size:11px;color:#9ca3af;margin:8px 0 0;">Based on ${marketSnapshot.totalReceipts} OFFO receipts this week</p>
      </div>`
    : "";

  const newsSection = topNews.length > 0
    ? `<div style="margin-bottom:12px;">
        <p style="font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">This week in EV news</p>
        ${topNews.map(article => {
          const cat = CATEGORY_LABELS[article.category] ?? CATEGORY_LABELS["routine_impact"];
          return `<div style="padding:12px 14px;border-radius:10px;border:1px solid #e5e7eb;background:white;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:600;color:${cat.color};">${cat.label}</span>
            <p style="font-size:13px;font-weight:600;color:#111827;margin:4px 0 4px;">
              <a href="${article.url}" style="color:#111827;text-decoration:none;">${article.title}</a>
            </p>
            ${article.ai_summary ? `<p style="font-size:12px;color:#6b7280;margin:0;">${article.ai_summary}</p>` : ""}
          </div>`;
        }).join("")}
        <p style="font-size:12px;margin:8px 0 0;text-align:center;">
          <a href="${SITE_URL}/news" style="color:#00d97e;text-decoration:none;font-weight:600;">See all EV news →</a>
        </p>
      </div>`
    : "";

  const hasRecall = topNews.some(a => a.category === "recall");
  const subject = hasRecall
    ? `OFFO weekly — ${dealWatchMatches > 0 ? `${dealWatchMatches} price drop${dealWatchMatches !== 1 ? "s" : ""}, ` : ""}recall alert + market recap`
    : `Your OFFO weekly digest — ${dealWatchMatches > 0 ? `${dealWatchMatches} price drop${dealWatchMatches !== 1 ? "s" : ""} found` : "market recap"}`;

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <p style="font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">Weekly Digest</p>
      <h1 style="font-size:22px;color:#1e293b;margin:0;">This week at OFFO</h1>
    </div>
    ${dealWatchSection}
    ${receiptsSection}
    ${lastReceiptSection}
    ${marketSection}
    ${newsSection}
    <div style="text-align:center;margin-top:20px;margin-bottom:24px;">
      ${ctaButton("Check a new listing →", `${SITE_URL}/receipt`)}
    </div>
    ${emailFooter(email, "weekly_digest")}`;

  return { subject, html: emailWrapper(body) };
}
