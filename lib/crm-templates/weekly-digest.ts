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
  recall:           { label: "🔴 Recall",      color: "#f87171" },
  used_market:      { label: "💲 Used Market",  color: "#d29922" },
  charging_network: { label: "⚡ Charging",     color: "#38bdf8" },
  routine_impact:   { label: "📡 Routine",      color: "#8b949e" },
};

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

export function buildWeeklyDigest(ctx: WeeklyDigestContext): { subject: string; html: string } {
  const { email, dealWatchMatches, receiptsThisWeek, marketSnapshot, lastVehicle, lastVerdict, topNews } = ctx;

  const dealWatchSection = dealWatchMatches > 0
    ? `<div style="background:rgba(0,217,126,0.08);border-radius:10px;padding:16px 18px;margin-bottom:12px;border:1px solid rgba(0,217,126,0.2);">
        <p style="font-size:14px;font-weight:700;color:#86efac;margin:0 0 6px;">
          📉 ${dealWatchMatches} price drop${dealWatchMatches !== 1 ? "s" : ""} on your saved searches
        </p>
        <p style="font-size:13px;color:#86efac;margin:0 0 10px;">
          Matching vehicles dropped in price since your last check.
        </p>
        ${ctaButton("View deal watch →", `${SITE_URL}/workspace/deal-watch`)}
      </div>`
    : `<div style="background:#161b22;border-radius:10px;padding:14px 18px;margin-bottom:12px;border:1px solid #30363d;">
        <p style="font-size:13px;color:#8b949e;margin:0;">No price drops this week on your saved searches.</p>
      </div>`;

  const receiptsSection = receiptsThisWeek > 0
    ? `<div style="background:rgba(56,189,248,0.08);border-radius:10px;padding:14px 18px;margin-bottom:12px;border:1px solid rgba(56,189,248,0.2);">
        <p style="font-size:13px;color:#7dd3fc;margin:0;">
          You ran <strong>${receiptsThisWeek} receipt${receiptsThisWeek !== 1 ? "s" : ""}</strong> this week.
          <a href="${SITE_URL}/workspace" style="color:#38bdf8;margin-left:4px;">View history →</a>
        </p>
      </div>`
    : "";

  const lastReceiptSection = lastVehicle
    ? `<div style="background:#161b22;border-radius:10px;padding:16px 18px;margin-bottom:12px;border:1px solid #30363d;">
        <p style="font-size:12px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">Your last receipt</p>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
          <span style="font-size:14px;color:#e6edf3;font-weight:600;">${lastVehicle}</span>
          ${lastVerdict ? verdictBadge(lastVerdict as "GREEN" | "YELLOW" | "RED") : ""}
        </div>
        ${ctaButton("View in workspace →", `${SITE_URL}/workspace`)}
      </div>`
    : "";

  const marketSection = marketSnapshot.totalReceipts > 0
    ? `<div style="background:#161b22;border-radius:10px;padding:16px 18px;margin-bottom:12px;border:1px solid #30363d;">
        <p style="font-size:12px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">Market this week</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#c9d1d9;">Avg listing price</td>
            <td style="padding:4px 0;font-size:13px;color:#e6edf3;font-weight:600;text-align:right;">
              ${marketSnapshot.avgPrice > 0 ? `$${marketSnapshot.avgPrice.toLocaleString()}` : "—"}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#c9d1d9;">Clean deals (GREEN)</td>
            <td style="padding:4px 0;font-size:13px;color:#238636;font-weight:600;text-align:right;">${marketSnapshot.greenPct}%</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#c9d1d9;">Needs review (YELLOW)</td>
            <td style="padding:4px 0;font-size:13px;color:#d29922;font-weight:600;text-align:right;">${marketSnapshot.yellowPct}%</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#c9d1d9;">High risk (RED)</td>
            <td style="padding:4px 0;font-size:13px;color:#da3633;font-weight:600;text-align:right;">${marketSnapshot.redPct}%</td>
          </tr>
        </table>
        <p style="font-size:11px;color:#8b949e;margin:8px 0 0;">Based on ${marketSnapshot.totalReceipts} OFFO receipts this week</p>
      </div>`
    : "";

  const newsSection = topNews.length > 0
    ? `<div style="margin-bottom:12px;">
        <p style="font-size:12px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 10px;">This week in EV news</p>
        ${topNews.map(article => {
          const cat = CATEGORY_LABELS[article.category] ?? CATEGORY_LABELS["routine_impact"];
          return `<div style="padding:12px 14px;border-radius:10px;border:1px solid #30363d;background:#161b22;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:600;color:${cat.color};">${cat.label}</span>
            <p style="font-size:13px;font-weight:600;color:#e6edf3;margin:4px 0 4px;">
              <a href="${article.url}" style="color:#e6edf3;text-decoration:none;">${article.title}</a>
            </p>
            ${article.ai_summary ? `<p style="font-size:12px;color:#8b949e;margin:0;">${article.ai_summary}</p>` : ""}
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
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:24px;">
      <p style="font-size:12px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 4px;">Weekly Digest</p>
      <h1 style="font-size:22px;color:#e6edf3;margin:0;">This week at OFFO</h1>
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
