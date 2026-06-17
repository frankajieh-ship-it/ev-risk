/**
 * Product Update Email Template — June 2026
 *
 * One-time broadcast to all opted-in registered users announcing
 * the Scan the Listing + photo analysis feature.
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

export interface ProductUpdateContext {
  email: string;
  firstName?: string;
}

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

export function buildProductUpdateJune2026(ctx: ProductUpdateContext): { subject: string; html: string } {
  const { email, firstName } = ctx;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const body = `
    ${OFFO_HEADER}

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">${greeting}</p>

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">
      We just shipped something we've been working on for a while — and we think it'll change how you evaluate listings before a test drive.
    </p>

    <!-- Feature 1 -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:14px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">New — Scan the Listing</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">Paste a URL. We read the listing for you.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        Paste any CarGurus, AutoTrader, or Cars.com listing link → OFFO automatically extracts the price, mileage, VIN, and listing details, then checks it against market data and flags red flags in the description. No copy-pasting. No manual entry.
      </p>
    </div>

    <!-- Feature 2 -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:24px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">New — Photo Analysis</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">We scan the listing photos so you don't have to guess.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        Drag the listing photos into OFFO and we check every one — which angles are present, which are missing, and whether anything visible looks like damage worth asking about. The undercarriage shot that's missing is almost never missing by accident.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${ctaButton("Scan a listing now →", `${SITE_URL}/receipt?utm_source=email&utm_medium=product_update&utm_campaign=june2026`)}
    </div>

    <div style="background:rgba(0,217,126,0.07);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.18);margin-bottom:8px;">
      <p style="font-size:13px;color:#86efac;margin:0;">
        Free · No account required to scan · Results in under 60 seconds
      </p>
    </div>

    <p style="font-size:13px;color:#8b949e;margin:20px 0 0;">
      More coming soon — VIN history reports are next. Reply to this email if you have questions or feedback. We read every reply.
    </p>

    ${emailFooter(email, "activation")}`;

  return {
    subject: "OFFO update: paste a listing URL and we'll read it for you",
    html: emailWrapper(body),
  };
}
