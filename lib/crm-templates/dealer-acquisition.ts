/**
 * Dealer Acquisition Email Templates
 *
 * Targets buyers who have sent dealer inquiries but haven't signed up as a dealer.
 * This is a B2B outreach sequence — separate from all shopper-facing CRM sequences.
 *
 * intro:    Fires after buyer sends first inquiry. Introduces the OFFO dealer program.
 * followup: Fires 7 days later if no dealer signup. Social proof + features.
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
    <p style="margin:6px 0 0;font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">For Dealers</p>
  </div>`;

const SIGNUP_URL = `${SITE_URL}/dealers/join`;

// ── Intro email ───────────────────────────────────────────────────────────────

export interface DealerAcquisitionContext {
  email: string;
  inquiryCount?: number;
}

export function buildDealerAcquisitionIntro(ctx: DealerAcquisitionContext): { subject: string; html: string } {
  const { email } = ctx;

  const body = `
    ${OFFO_HEADER}

    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 8px;font-weight:700;">Sell EVs? Get found by buyers already researching on OFFO.</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">Buyers are already using OFFO to research EVs — including yours.</p>
    </div>

    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 14px;">OFFO is where serious EV buyers do their homework before they ever walk into a dealership. They run battery health reports, check prices, and look for dealers they can trust.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">A verified OFFO dealer profile puts your inventory in front of buyers at exactly the right moment — when they're ready to contact someone.</p>
    </div>

    <div style="background:rgba(0,217,126,0.06);border-radius:10px;padding:16px 18px;border:1px solid rgba(0,217,126,0.15);margin-bottom:20px;">
      <p style="font-size:13px;color:#86efac;margin:0 0 10px;font-weight:600;">What OFFO dealers get:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#86efac;line-height:1.8;">
        <li>Verified badge — buyers trust dealers who stand behind transparency</li>
        <li>Direct buyer inquiries — serious shoppers contact you through OFFO</li>
        <li>Deal Watch leads — we surface your inventory to buyers tracking matching models</li>
        <li>Dashboard — see views, inquiries, and engagement in one place</li>
      </ul>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Learn more about OFFO for Dealers →", SIGNUP_URL)}
    </div>

    <p style="font-size:12px;color:#8b949e;text-align:center;margin:0 0 8px;">Takes 2 minutes to apply. No commitment required.</p>

    ${emailFooter(email, "dealer_acquisition")}`;

  return {
    subject: "Sell EVs? Get found by buyers already researching on OFFO",
    html: emailWrapper(body),
  };
}

// ── Followup email ────────────────────────────────────────────────────────────

export function buildDealerAcquisitionFollowup(ctx: DealerAcquisitionContext): { subject: string; html: string } {
  const { email } = ctx;

  const body = `
    ${OFFO_HEADER}

    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:21px;color:#e6edf3;margin:0 0 8px;font-weight:700;">Still thinking about it?</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">Here's exactly what verified OFFO dealers get.</p>
    </div>

    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #30363d;">
      <p style="font-size:13px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">How it works</p>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <span style="flex-shrink:0;width:22px;height:22px;background:#00d97e;color:#0d1117;border-radius:50%;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:22px;text-align:center;">1</span>
          <div>
            <p style="font-size:14px;color:#e6edf3;margin:0 0 2px;font-weight:600;">Apply for a free profile</p>
            <p style="font-size:13px;color:#8b949e;margin:0;">Takes 2 minutes. Our team reviews and approves within 1 business day.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <span style="flex-shrink:0;width:22px;height:22px;background:#00d97e;color:#0d1117;border-radius:50%;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:22px;text-align:center;">2</span>
          <div>
            <p style="font-size:14px;color:#e6edf3;margin:0 0 2px;font-weight:600;">Get the OFFO Verified badge</p>
            <p style="font-size:13px;color:#8b949e;margin:0;">Displayed on your profile and on every matching receipt a buyer runs for your inventory.</p>
          </div>
        </div>
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <span style="flex-shrink:0;width:22px;height:22px;background:#00d97e;color:#0d1117;border-radius:50%;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:22px;text-align:center;">3</span>
          <div>
            <p style="font-size:14px;color:#e6edf3;margin:0 0 2px;font-weight:600;">Receive buyer inquiries directly</p>
            <p style="font-size:13px;color:#8b949e;margin:0;">Buyers contact you through OFFO — you get an email notification and manage replies in your dashboard.</p>
          </div>
        </div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Claim your free dealer profile →", SIGNUP_URL)}
    </div>

    <p style="font-size:12px;color:#8b949e;text-align:center;margin:0 0 8px;">Questions? Reply to this email — we read every one.</p>

    ${emailFooter(email, "dealer_acquisition")}`;

  return {
    subject: "Still thinking about it? Here's what OFFO Verified dealers get",
    html: emailWrapper(body),
  };
}
