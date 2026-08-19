/**
 * Product Update Email Templates
 *
 * June 2026: Scan the Listing + photo analysis
 * July 2026: AutoTrader & Cars.com URL extraction + VIN history teaser
 * July 2026 (v2): Ownership history now live + two-tier paywall ($3.99 / $9.99)
 * July 2026 (v3): Report upgrade — At a Glance grid, warranty coverage, photo analysis live
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

export function buildProductUpdateReportUpgrade(ctx: ProductUpdateContext): { subject: string; html: string } {
  const { email, firstName } = ctx;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const body = `
    ${OFFO_HEADER}

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">${greeting}</p>

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">
      We upgraded the OFFO report this week — here's what's new and why it matters before your next test drive.
    </p>

    <!-- Feature 1: At a Glance grid -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:14px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">New — Vehicle History at a Glance</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">9 checks. One view. Know what you're buying in under 30 seconds.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0 0 12px;">
        Every report now opens with a structured grid — the same checks that Experian AutoCheck sells for $25, built into your OFFO report:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#c9d1d9;">
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #21262d;">State Title Brand</td>
          <td style="padding:6px 0;border-bottom:1px solid #21262d;">Accident History</td>
          <td style="padding:6px 0;border-bottom:1px solid #21262d;">Open Recalls</td>
        </tr>
        <tr>
          <td style="padding:6px 0;border-bottom:1px solid #21262d;">Theft Record</td>
          <td style="padding:6px 0;border-bottom:1px solid #21262d;">Salvage / Total Loss</td>
          <td style="padding:6px 0;border-bottom:1px solid #21262d;">Odometer Check</td>
        </tr>
        <tr>
          <td style="padding:6px 0;">Open Lien</td>
          <td style="padding:6px 0;">Service Records</td>
          <td style="padding:6px 0;">Owners</td>
        </tr>
      </table>
      <p style="font-size:13px;color:#8b949e;margin:12px 0 0;">Title, recalls, and service records are free. Theft, salvage, lien, and odometer unlock with the full report.</p>
    </div>

    <!-- Feature 2: Warranty Coverage -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:14px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">New — Warranty Coverage (free)</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">How much warranty is left on the battery? Now shown automatically.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        Every report now shows remaining warranty by coverage type — Basic, Powertrain, EV Battery, and Corrosion — calculated from the vehicle year and mileage. For EVs, the federally-mandated 8yr/100k battery warranty is tracked separately so you always know exactly where you stand. No manual lookup required.
      </p>
    </div>

    <!-- Feature 3: Photo analysis -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:24px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">Improved — Photo Analysis</p>
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">We fixed it. Photo analysis now runs reliably on every listing.</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        We had a pipeline issue that was causing photo analysis to stall on some listings. That's resolved — damage detection and angle coverage now run automatically when you add photos. The undercarriage shot that's missing from a listing is almost never missing by accident.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${ctaButton("Run a report on your listing →", `${SITE_URL}/receipt?utm_source=email&utm_medium=product_update&utm_campaign=report_upgrade_july16`)}
    </div>

    <!-- Real example teaser -->
    <div style="background:rgba(210,153,34,0.08);border-radius:10px;padding:16px 18px;border:1px solid rgba(210,153,34,0.25);margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;color:#d29922;margin:0 0 6px;">Real example from this week</p>
      <p style="font-size:13px;color:#c9d1d9;margin:0;">
        A dealer listed a 2022 Porsche Taycan for $51,800 with "0 accidents" on the front page. OFFO found 1 accident on record, 12 open recall campaigns, and a powertrain warranty expiring in 6 months. Our target price: $47,500. The dealer's 30-day swap policy doesn't help if you don't know to ask.
      </p>
    </div>

    <div style="background:rgba(0,217,126,0.07);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.18);margin-bottom:8px;">
      <p style="font-size:13px;color:#86efac;margin:0;">
        Starter Report $3.99 · Full Report $9.99 · CarGurus · AutoTrader · Cars.com
      </p>
    </div>

    <p style="font-size:13px;color:#8b949e;margin:20px 0 0;">
      Reply to this email with a listing you want us to look at. We read every reply.
    </p>

    ${emailFooter(email, "product_update")}`;

  return {
    subject: "OFFO: new — warranty coverage, 9-check history grid, and photo analysis fixed",
    html: emailWrapper(body),
  };
}

export function buildProductUpdateFreeAugust2026(ctx: ProductUpdateContext): { subject: string; html: string } {
  const { email, firstName } = ctx;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const body = `
    ${OFFO_HEADER}

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">${greeting}</p>

    <p style="font-size:15px;color:#c9d1d9;margin:0 0 20px;">
      We removed the paywall. Everything on OFFO is free right now — no account, no credit card, no catch.
    </p>

    <!-- What's free -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:14px;border:1px solid #30363d;">
      <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#e6edf3;">Everything. Free.</p>
      <table style="width:100%;border-collapse:collapse;">
        ${[
          "Full AI risk verdict — GREEN / YELLOW / RED",
          "Battery health assessment",
          "Deal quality score + price vs. market",
          "Open NHTSA recall check",
          "Negotiation insights & seller questions",
          "Ownership & accident history (when VIN available)",
          "Deep dive analysis",
          "EV Routine Fit — personalized match to how you drive",
        ].map(f => `
        <tr>
          <td style="padding:5px 0;vertical-align:top;width:18px;">
            <span style="color:#00d97e;font-size:14px;font-weight:700;">✓</span>
          </td>
          <td style="padding:5px 0;font-size:14px;color:#c9d1d9;">${f}</td>
        </tr>`).join("")}
      </table>
    </div>

    <!-- Why -->
    <div style="background:#161b22;border-radius:12px;padding:20px 22px;margin-bottom:24px;border:1px solid #30363d;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.08em;">Why free?</p>
      <p style="font-size:14px;color:#c9d1d9;margin:0;">
        We're building the next major version — full ownership history integration and deeper battery verification. While that's in progress, we'd rather have buyers using the tool than sitting behind a paywall. Free until the next update ships.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:28px;">
      ${ctaButton("Run a free analysis →", `${SITE_URL}/receipt?utm_source=email&utm_medium=product_update&utm_campaign=free_aug2026`)}
    </div>

    <div style="background:rgba(0,217,126,0.07);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.18);margin-bottom:8px;">
      <p style="font-size:13px;color:#86efac;margin:0;">
        Paste any CarGurus, AutoTrader, or Cars.com listing — results in under 30 seconds.
      </p>
    </div>

    <p style="font-size:13px;color:#8b949e;margin:20px 0 0;">
      Reply to this email with a listing you're considering. We read every reply.
    </p>

    ${emailFooter(email, "product_update")}`;

  return {
    subject: "OFFO is now fully free — no paywall, no account needed",
    html: emailWrapper(body),
  };
}
