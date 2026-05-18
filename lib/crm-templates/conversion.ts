/**
 * Conversion Email Templates
 *
 * Two triggers:
 *   - paywall_dismissed: user hit the paywall but didn't start checkout → 24h follow-up
 *   - checkout_started: user started checkout but didn't complete → 2h follow-up
 */

import { SITE_URL, verdictColor, verdictLabel, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

export interface ConversionContext {
  email: string;
  vehicle?: string;
  receiptId?: string;
  triggerType: "paywall_dismissed" | "checkout_started";
  verdict?: "GREEN" | "YELLOW" | "RED";
}

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

export function buildConversionPaywall(ctx: ConversionContext): { subject: string; html: string } {
  const { email, vehicle, receiptId, verdict } = ctx;
  const vehicleName = vehicle || "your listing";
  const receiptUrl = receiptId ? `${SITE_URL}/receipt?id=${receiptId}` : `${SITE_URL}/receipt`;

  let verdictNote = "";
  if (verdict) {
    const color = verdictColor(verdict);
    const label = verdictLabel(verdict);
    verdictNote = `<div style="margin-bottom:16px;padding:10px 14px;border-radius:8px;border-left:3px solid ${color};background:rgba(0,0,0,0.2);">
      <p style="font-size:13px;color:#c9d1d9;margin:0;">
        Verdict for ${vehicleName}: <strong style="color:${color};">${label}</strong>
      </p>
    </div>`;
  }

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="font-size:21px;color:#e6edf3;margin:0 0 6px;">Finish unlocking your receipt</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicleName}</p>
    </div>
    ${verdictNote}
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">You were about to unlock the full breakdown for <strong style="color:#e6edf3;">${vehicleName}</strong>. Here's what's inside:</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;color:#c9d1d9;">
        <li style="margin-bottom:6px;">Full risk flag analysis with context</li>
        <li style="margin-bottom:6px;">Must-ask questions for the seller</li>
        <li style="margin-bottom:6px;">Negotiation opener based on the listing</li>
        <li style="margin-bottom:6px;">Price verdict vs. market comps</li>
      </ul>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Unlock full receipt →", receiptUrl)}
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:0 0 24px;">
      One-time unlock — no subscription required.
    </p>
    ${emailFooter(email, "conversion")}`;

  return {
    subject: `Your receipt for ${vehicleName} is waiting`,
    html: emailWrapper(body),
  };
}

export function buildConversionCheckout(ctx: ConversionContext): { subject: string; html: string } {
  const { email, vehicle, receiptId } = ctx;
  const vehicleName = vehicle || "your listing";
  const checkoutUrl = receiptId ? `${SITE_URL}/receipt?id=${receiptId}` : `${SITE_URL}/receipt`;

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="font-size:21px;color:#e6edf3;margin:0 0 6px;">Your checkout was interrupted</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicleName}</p>
    </div>
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
        You started unlocking the full receipt for <strong style="color:#e6edf3;">${vehicleName}</strong> but didn't complete the checkout.
      </p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        Your receipt is still ready — pick up where you left off.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Complete checkout →", checkoutUrl)}
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:0 0 24px;">
      Secure checkout via Stripe. No subscription — pay once per receipt.
    </p>
    ${emailFooter(email, "conversion")}`;

  return {
    subject: `Complete your OFFO receipt unlock — ${vehicleName}`,
    html: emailWrapper(body),
  };
}

// ── Auction nurture ───────────────────────────────────────────────────────────

export interface AuctionNurtureContext {
  email: string;
  vehicle?: string;
  resultId?: string;
}

export function buildAuctionNurture(ctx: AuctionNurtureContext): { subject: string; html: string } {
  const { vehicle, resultId } = ctx;
  const vehicleName = vehicle || "the lot you looked up";
  const auditUrl = resultId ? `${SITE_URL}/auction/${resultId}` : `${SITE_URL}/copart`;

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="font-size:21px;color:#e6edf3;margin:0 0 6px;">Your auction numbers are waiting</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicleName}</p>
    </div>
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
        You ran a free salvage analysis for <strong style="color:#e6edf3;">${vehicleName}</strong>. The full Auction Audit adds the numbers you need before bidding:
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
        <tr>
          <td style="padding:10px;text-align:center;background:#0d1117;border-radius:8px;width:33%;border:1px solid #30363d;">
            <div style="font-size:12px;color:#8b949e;margin-bottom:4px;">Market Value</div>
            <div style="font-size:18px;font-weight:700;color:#30363d;filter:blur(4px);user-select:none;">$28,500</div>
          </td>
          <td style="width:2%;"></td>
          <td style="padding:10px;text-align:center;background:#0d1117;border-radius:8px;width:33%;border:1px solid #30363d;">
            <div style="font-size:12px;color:#8b949e;margin-bottom:4px;">Repair Cost</div>
            <div style="font-size:18px;font-weight:700;color:#30363d;filter:blur(4px);user-select:none;">$4,200–$6,800</div>
          </td>
          <td style="width:2%;"></td>
          <td style="padding:10px;text-align:center;background:#0d1117;border-radius:8px;width:33%;border:1px solid #30363d;">
            <div style="font-size:12px;color:#8b949e;margin-bottom:4px;">Max Safe Bid</div>
            <div style="font-size:18px;font-weight:700;color:#30363d;filter:blur(4px);user-select:none;">$21,750</div>
          </td>
        </tr>
      </table>
      <p style="font-size:12px;color:#8b949e;text-align:center;margin:0;">Unlock to see your actual numbers for this lot</p>
    </div>
    <div style="text-align:center;margin-bottom:16px;">
      ${ctaButton("See the Full Audit — $49", auditUrl)}
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:0;">
      One-time · No subscription · Instant access
    </p>
  `;

  return {
    subject: `Your auction numbers for ${vehicleName} — unlock before you bid`,
    html: emailWrapper(body + emailFooter(ctx.email, "conversion")),
  };
}
