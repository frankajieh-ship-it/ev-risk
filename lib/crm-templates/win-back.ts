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

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

export function buildWinBack30(ctx: WinBackContext): { subject: string; html: string } {
  const { email, vehicle, receiptsGenerated } = ctx;
  const vehicleName = vehicle || "an EV";
  const receiptNote = receiptsGenerated > 1
    ? `You've run ${receiptsGenerated} OFFO receipts so far.`
    : "You ran an OFFO receipt a while back.";

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:21px;color:#e6edf3;margin:0 0 8px;">Still shopping for an EV?</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${receiptNote}</p>
    </div>
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
        Last time you checked <strong style="color:#e6edf3;">${vehicleName}</strong>. The used EV market moves fast —
        prices shift weekly and new listings appear daily.
      </p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        If you're still in the market, paste a listing URL and get an updated receipt in seconds.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Check a new listing →", `${SITE_URL}/receipt`)}
    </div>
    <div style="background:rgba(0,217,126,0.08);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.2);">
      <p style="font-size:13px;color:#86efac;margin:0;">
        <strong>Deal Watch:</strong> Set up a saved search and we'll email you when a matching EV drops in price.
        <a href="${SITE_URL}/workspace/deal-watch" style="color:#00d97e;">Set up alert →</a>
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
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:21px;color:#e6edf3;margin:0 0 8px;">It's been a while</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">We haven't seen you in about two months</p>
    </div>
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
        Whether you found your EV or put the search on hold — we hope the OFFO receipt for
        <strong style="color:#e6edf3;">${vehicleName}</strong> was useful.
      </p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        If you're back in the market, we're here. OFFO is still free to use for receipt checks and
        deal watch alerts.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Back to OFFO →", SITE_URL)}
    </div>
    <p style="font-size:12px;color:#8b949e;text-align:center;margin:0 0 8px;">
      This is the last email we'll send. If you found your EV, congrats — hope it's treating you well.
    </p>
    ${emailFooter(email, "win_back")}`;

  return {
    subject: `Last check-in from OFFO`,
    html: emailWrapper(body),
  };
}
