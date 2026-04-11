/**
 * Win-Back Email Templates (30-day and 60-day)
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

export interface WinBackContext {
  email: string;
  vehicle?: string;
  daysSilent: 30 | 60;
  receiptsGenerated: number;
}

export function buildWinBack30(ctx: WinBackContext): { subject: string; html: string } {
  const { email, vehicle, receiptsGenerated } = ctx;
  const vehicleName = vehicle || "an EV";
  const receiptNote = receiptsGenerated > 1
    ? `You've run ${receiptsGenerated} OFFO receipts so far.`
    : "You ran an OFFO receipt a while back.";

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:21px;color:#1e293b;margin:0 0 8px;">Still shopping for an EV?</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">${receiptNote}</p>
    </div>
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#374151;margin:0 0 12px;">
        Last time you checked <strong>${vehicleName}</strong>. The used EV market moves fast —
        prices shift weekly and new listings appear daily.
      </p>
      <p style="font-size:14px;color:#374151;margin:0;">
        If you're still in the market, paste a listing URL and get an updated receipt in under 30 seconds.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Check a new listing →", `${SITE_URL}/receipt`)}
    </div>
    <div style="background:#f0fdf4;border-radius:10px;padding:14px 18px;border:1px solid #bbf7d0;">
      <p style="font-size:13px;color:#166534;margin:0;">
        <strong>Deal Watch:</strong> Set up a saved search and we'll email you when a matching EV drops in price.
        <a href="${SITE_URL}/workspace/deal-watch" style="color:#166534;">Set up alert →</a>
      </p>
    </div>
    ${emailFooter(email, "win_back")}`;

  return {
    subject: `Still looking for an EV? Your search picks back up here`,
    html: emailWrapper(body),
  };
}

export function buildWinBack60(ctx: WinBackContext): { subject: string; html: string } {
  const { email, vehicle } = ctx;
  const vehicleName = vehicle || "an EV";

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:21px;color:#1e293b;margin:0 0 8px;">It's been a while</h1>
      <p style="font-size:14px;color:#64748b;margin:0;">We haven't seen you in about two months</p>
    </div>
    <div style="background:white;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #e5e7eb;">
      <p style="font-size:14px;color:#374151;margin:0 0 12px;">
        Whether you found your EV or put the search on hold — we hope the OFFO receipt for
        <strong>${vehicleName}</strong> was useful.
      </p>
      <p style="font-size:14px;color:#374151;margin:0;">
        If you're back in the market, we're here. OFFO is still free to use for receipt checks and
        deal watch alerts.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Back to OFFO →", SITE_URL)}
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0 0 8px;">
      This is the last email we'll send. If you found your EV, congrats — hope it's treating you well.
    </p>
    ${emailFooter(email, "win_back")}`;

  return {
    subject: `Last check-in from OFFO`,
    html: emailWrapper(body),
  };
}
