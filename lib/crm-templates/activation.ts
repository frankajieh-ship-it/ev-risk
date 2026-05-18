/**
 * Activation Email Templates (Day 1 / Day 3 / Day 7)
 *
 * Personalized by vehicle, verdict, and top risk flag extracted from
 * receipts.output_json via the trigger_id in email_sequences.metadata.
 */

import { SITE_URL, verdictColor, verdictLabel, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

export interface ActivationContext {
  email: string;
  vehicle: string;
  verdict?: "GREEN" | "YELLOW" | "RED";
  topRiskFlag?: string;
  fitScore?: number;
  receiptId?: string;
  triggerEvent: "receipt_generated" | "evfit_completed";
}

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

// ── Day 1 ────────────────────────────────────────────────────────────────────

export function buildActivationDay1(ctx: ActivationContext): { subject: string; html: string } {
  const { email, vehicle, verdict, topRiskFlag, receiptId } = ctx;
  const receiptUrl = receiptId ? `${SITE_URL}/receipt?id=${receiptId}` : `${SITE_URL}/receipt`;

  let headlineHtml: string;
  let bodyHtml: string;
  let badgeHtml = "";

  if (verdict === "GREEN") {
    headlineHtml = `Your receipt looks clean`;
    badgeHtml = `<div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;padding:4px 16px;border-radius:20px;font-size:13px;font-weight:700;color:#fff;background:${verdictColor("GREEN")};">
        ${verdictLabel("GREEN")}
      </span>
    </div>`;
    bodyHtml = `<p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
      Good news — OFFO flagged no major red flags on <strong style="color:#e6edf3;">${vehicle}</strong>.
      The listing signals check out and the price looks fair.
    </p>
    <p style="font-size:14px;color:#c9d1d9;margin:0;">
      Before you visit, grab the must-ask questions from your receipt to make sure nothing's been missed.
    </p>`;
  } else if (verdict === "RED") {
    headlineHtml = `Your receipt has red flags`;
    badgeHtml = `<div style="text-align:center;margin-bottom:20px;">
      <span style="display:inline-block;padding:4px 16px;border-radius:20px;font-size:13px;font-weight:700;color:#fff;background:${verdictColor("RED")};">
        ${verdictLabel("RED")}
      </span>
    </div>`;
    const flagText = topRiskFlag ? `Key flag: <strong>${topRiskFlag}</strong>` : "Multiple risk flags were detected.";
    bodyHtml = `<p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
      OFFO flagged issues with <strong style="color:#e6edf3;">${vehicle}</strong> that are worth investigating before you proceed.
    </p>
    <div style="background:rgba(218,54,51,0.12);border-radius:8px;padding:12px 16px;border-left:3px solid #da3633;margin-bottom:12px;">
      <p style="font-size:13px;color:#fca5a5;margin:0;">${flagText}</p>
    </div>
    <p style="font-size:14px;color:#c9d1d9;margin:0;">
      Review your full receipt for the complete breakdown and negotiation angles.
    </p>`;
  } else {
    // YELLOW or unknown
    headlineHtml = `Your receipt is ready`;
    if (verdict === "YELLOW") {
      badgeHtml = `<div style="text-align:center;margin-bottom:20px;">
        <span style="display:inline-block;padding:4px 16px;border-radius:20px;font-size:13px;font-weight:700;color:#fff;background:${verdictColor("YELLOW")};">
          ${verdictLabel("YELLOW")}
        </span>
      </div>`;
    }
    bodyHtml = `<p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
      Your OFFO receipt for <strong style="color:#e6edf3;">${vehicle}</strong> is ready — including risk flags,
      must-ask questions, and a price verdict.
    </p>
    <p style="font-size:14px;color:#c9d1d9;margin:0;">
      Review your full receipt to see what to watch out for before you visit the seller.
    </p>`;
  }

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 6px;">${headlineHtml}</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicle}</p>
    </div>
    ${badgeHtml}
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #30363d;">
      ${bodyHtml}
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("View my receipt →", receiptUrl)}
    </div>
    <div style="background:rgba(0,217,126,0.08);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.2);">
      <p style="font-size:13px;color:#86efac;margin:0;">
        <strong>Tip:</strong> Save your receipt to My Garage to track the listing price over time.
        <a href="${SITE_URL}/workspace" style="color:#00d97e;">Open garage →</a>
      </p>
    </div>
    ${emailFooter(email, "activation")}`;

  return {
    subject: `Your ${vehicle} receipt is ready — here's what we found`,
    html: emailWrapper(body),
  };
}

// ── Day 3 ────────────────────────────────────────────────────────────────────

export function buildActivationDay3(ctx: ActivationContext): { subject: string; html: string } {
  const { email, vehicle } = ctx;

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 6px;">Compare a second option?</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">Most serious buyers check 2–3 vehicles before deciding</p>
    </div>
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 10px;">
        You already have an OFFO receipt for <strong style="color:#e6edf3;">${vehicle}</strong>.
      </p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        Paste another listing to get a side-by-side comparison — risk flags, price verdict, and
        fit score for each — so you can see which one is the smarter buy before you spend a dollar.
      </p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Check another listing →", `${SITE_URL}/receipt`)}
    </div>
    <div style="background:rgba(56,189,248,0.08);border-radius:10px;padding:14px 18px;border:1px solid rgba(56,189,248,0.2);">
      <p style="font-size:13px;color:#7dd3fc;margin:0;">
        <strong>Did you know?</strong> OFFO can analyze Copart and auction listings too —
        not just private seller ads.
        <a href="${SITE_URL}/copart" style="color:#38bdf8;">Try auction analysis →</a>
      </p>
    </div>
    ${emailFooter(email, "activation")}`;

  return {
    subject: `Compare ${vehicle} against another option`,
    html: emailWrapper(body),
  };
}

// ── Day 7 ────────────────────────────────────────────────────────────────────

export function buildActivationDay7(ctx: ActivationContext): { subject: string; html: string } {
  const { email, vehicle, receiptId } = ctx;
  const receiptUrl = receiptId ? `${SITE_URL}/receipt?id=${receiptId}` : `${SITE_URL}/workspace`;

  const body = `
    ${OFFO_HEADER}
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 6px;">Save your receipt before it expires</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicle}</p>
    </div>
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 10px;">
        Your OFFO receipt results are stored temporarily. Saving them to <strong style="color:#e6edf3;">My Garage</strong> gives you:
      </p>
      <ul style="margin:0;padding-left:18px;font-size:14px;color:#c9d1d9;">
        <li style="margin-bottom:6px;">Permanent access to your receipt and risk breakdown</li>
        <li style="margin-bottom:6px;">Price tracking — get alerted if the listing price drops</li>
        <li style="margin-bottom:6px;">History across all your receipts for easy comparison</li>
      </ul>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Save to My Garage →", receiptUrl)}
    </div>
    <div style="background:rgba(210,153,34,0.1);border-radius:10px;padding:14px 18px;border:1px solid rgba(210,153,34,0.25);">
      <p style="font-size:13px;color:#fcd34d;margin:0;">
        <strong>Still deciding?</strong> Set up a Deal Watch on your saved search and we'll alert you
        when a matching EV drops in price.
        <a href="${SITE_URL}/workspace/deal-watch" style="color:#fbbf24;">Set up alert →</a>
      </p>
    </div>
    ${emailFooter(email, "activation")}`;

  return {
    subject: `Your OFFO receipt for ${vehicle} — still have questions?`,
    html: emailWrapper(body),
  };
}
