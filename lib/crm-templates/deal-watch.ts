/**
 * Deal Watch / Price Drop Email Templates
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

export interface GaragePriceDropContext {
  email: string;
  vehicle: string;
  savedPriceCents: number;
  currentPriceCents: number;
  dropCents: number;
  listingUrl: string;
  garageVehicleId: string;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function buildGaragePriceDropEmail(ctx: GaragePriceDropContext): { subject: string; html: string } {
  const { email, vehicle, savedPriceCents, currentPriceCents, dropCents, listingUrl } = ctx;
  const savedPrice = formatDollars(savedPriceCents);
  const currentPrice = formatDollars(currentPriceCents);
  const dropAmount = formatDollars(dropCents);
  const dropPct = Math.round((dropCents / savedPriceCents) * 100);
  const receiptUrl = `${SITE_URL}/workspace`;

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:rgba(0,217,126,0.12);border:1px solid rgba(0,217,126,0.3);border-radius:20px;padding:4px 16px;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:700;color:#00d97e;">Price Drop Alert</span>
      </div>
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 6px;">Down ${dropAmount} since you saved it</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicle}</p>
    </div>

    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:20px;border:1px solid #30363d;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="text-align:center;flex:1;">
          <p style="font-size:12px;color:#8b949e;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;">When you saved</p>
          <p style="font-size:20px;font-weight:700;color:#8b949e;margin:0;text-decoration:line-through;">${savedPrice}</p>
        </div>
        <div style="font-size:20px;color:#00d97e;font-weight:700;padding:0 12px;">→</div>
        <div style="text-align:center;flex:1;">
          <p style="font-size:12px;color:#8b949e;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.06em;">Now listed</p>
          <p style="font-size:24px;font-weight:800;color:#00d97e;margin:0;">${currentPrice}</p>
        </div>
      </div>
      <div style="background:rgba(0,217,126,0.08);border-radius:8px;padding:10px 14px;text-align:center;border:1px solid rgba(0,217,126,0.2);">
        <p style="font-size:14px;color:#86efac;margin:0;font-weight:600;">
          ${dropAmount} lower (${dropPct}% drop) — this listing is moving
        </p>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:20px;">
      ${ctaButton("View listing →", listingUrl)}
    </div>

    <div style="background:rgba(56,189,248,0.08);border-radius:10px;padding:14px 18px;border:1px solid rgba(56,189,248,0.2);margin-bottom:8px;">
      <p style="font-size:13px;color:#7dd3fc;margin:0;">
        <strong>Tip:</strong> A price drop this size suggests motivated seller or fading interest.
        If your OFFO receipt was GREEN or YELLOW, now is a good time to act.
        <a href="${receiptUrl}" style="color:#38bdf8;">Open My Garage →</a>
      </p>
    </div>

    ${emailFooter(email, "deal_watch")}`;

  return {
    subject: `Price drop: ${vehicle} is now ${currentPrice} (was ${savedPrice})`,
    html: emailWrapper(body),
  };
}
