/**
 * Product Update Email Templates
 *
 * June 2026: Scan the Listing + photo analysis
 * July 2026: AutoTrader & Cars.com URL extraction + VIN history teaser
 * July 2026 (v2): Ownership history now live + two-tier paywall ($3.99 / $9.99)
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

export function buildProductUpdateJuly2026(ctx: ProductUpdateContext): { subject: string; html: string } {
  const { email, firstName } = ctx;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const body = `
    ${OFFO_HEADER}

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">${greeting}</p>

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">
      Two things shipped this week that make OFFO a lot more useful if you're actively shopping.
    </p>

    <!-- Feature 1 -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:14px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">Now live — AutoTrader & Cars.com</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">Paste any listing link. We do the rest.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        AutoTrader and Cars.com links now extract automatically — price, mileage, VIN, and full listing details pulled in under 30 seconds. Combined with CarGurus (already supported), you can now paste listings from any of the three biggest EV marketplaces and get an instant risk verdict.
      </p>
    </div>

    <!-- Feature 2 -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:24px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">Coming next — VIN History Reports</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">Title status, open liens, accident history — all in one place.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        We're integrating VIN history data so you can see ownership history, title checks, and open liens without paying $40 for a separate report. You'll get this as part of the full OFFO analysis. More details soon.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${ctaButton("Scan a listing now →", `${SITE_URL}/receipt?utm_source=email&utm_medium=product_update&utm_campaign=july2026`)}
    </div>

    <div style="background:rgba(0,217,126,0.07);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.18);margin-bottom:8px;">
      <p style="font-size:13px;color:#86efac;margin:0;">
        CarGurus · AutoTrader · Cars.com · Free · No account required
      </p>
    </div>

    <p style="font-size:13px;color:#8b949e;margin:20px 0 0;">
      Reply to this email if you have feedback or a listing you want us to look at. We read every reply.
    </p>

    ${emailFooter(email, "activation")}`;

  return {
    subject: "OFFO: AutoTrader & Cars.com links now work — paste any listing",
    html: emailWrapper(body),
  };
}

export function buildProductUpdateOwnershipHistory(ctx: ProductUpdateContext): { subject: string; html: string } {
  const { email, firstName } = ctx;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const body = `
    ${OFFO_HEADER}

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">${greeting}</p>

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">
      Ownership history is now live in OFFO — the one thing we teased last time is ready.
    </p>

    <!-- Feature 1: Ownership History -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:14px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">Now live — Ownership History</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">Previous owners, title status, accidents, open liens — all per VIN.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
        Part of the full OFFO report ($9.99). We pull:
      </p>
      <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#c9d1d9;line-height:1.8;">
        <li>Number of previous owners</li>
        <li>Title status — clean, salvage, rebuilt, lemon law</li>
        <li>Accident and damage records</li>
        <li>Open lien check</li>
        <li>Odometer rollback and flood title flags</li>
      </ul>
    </div>

    <!-- Feature 2: Two-tier pricing -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:24px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">New — Two-tier pricing</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">Start at $3.99 if you just need the verdict.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        The <strong style="color:#e6edf3;">Starter Report ($3.99)</strong> unlocks your risk verdict color, the full AI summary, and photo angle analysis — everything you need before a test drive.<br><br>
        The <strong style="color:#e6edf3;">Full Report ($9.99)</strong> adds ownership history, negotiation deep dive, market comparables, and the seller question pack. Upgrade any time from the Starter without re-entering anything.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${ctaButton("Run a full report →", `${SITE_URL}/receipt?utm_source=email&utm_medium=product_update&utm_campaign=ownership_history_launch`)}
    </div>

    <div style="background:rgba(0,217,126,0.07);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.18);margin-bottom:8px;">
      <p style="font-size:13px;color:#86efac;margin:0;">
        CarGurus · AutoTrader · Cars.com · Starter $3.99 · Full Report $9.99
      </p>
    </div>

    <p style="font-size:13px;color:#8b949e;margin:20px 0 0;">
      Reply to this email if you have a listing you want a read on, or if anything isn't working. We read every reply.
    </p>

    ${emailFooter(email, "activation")}`;

  return {
    subject: "OFFO: ownership history is now live — title, accidents, open liens per VIN",
    html: emailWrapper(body),
  };
}
