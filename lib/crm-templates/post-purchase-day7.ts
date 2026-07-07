/**
 * Post-Purchase Day 7 Email Template
 *
 * Sent 7 days after a paid receipt purchase. Asks the user whether they
 * bought the vehicle. "Yes" triggers owned-EV onboarding via a confirm
 * endpoint. "Still looking" surfaces similar curated deals.
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

export interface SimilarDeal {
  make: string;
  model: string;
  year: number | null;
  priceCents: number | null;
  listingUrl: string | null;
}

export interface PostPurchaseDay7Context {
  email: string;
  userId: string;
  vehicleLabel: string;
  receiptSlug: string;
  garageVehicleId?: string | null;
  confirmToken: string;
  similarDeals: SimilarDeal[];
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function dealCard(d: SimilarDeal): string {
  const label = [d.year, d.make, d.model].filter(Boolean).join(" ");
  const price = d.priceCents ? formatDollars(d.priceCents) : "Price TBD";
  const href = d.listingUrl
    ? `${SITE_URL}/receipt?url=${encodeURIComponent(d.listingUrl)}&src=day7_similar`
    : `${SITE_URL}/receipt`;
  return `
    <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#e6edf3;">${label}</p>
          <p style="margin:0;font-size:13px;color:#8b949e;">${price}</p>
        </div>
        <a href="${href}" style="font-size:12px;font-weight:600;color:#00d97e;text-decoration:none;white-space:nowrap;padding:6px 12px;border:1px solid #00d97e33;border-radius:6px;">
          Check it →
        </a>
      </div>
    </div>`;
}

export function buildPostPurchaseDay7Email(ctx: PostPurchaseDay7Context): { subject: string; html: string } {
  const { email, vehicleLabel, receiptSlug, confirmToken, similarDeals } = ctx;

  const confirmUrl = `${SITE_URL}/api/email/post-purchase-day7/confirm?token=${encodeURIComponent(confirmToken)}`;
  const stillLookingUrl = `${SITE_URL}/r/${receiptSlug}`;

  const dealsSection = similarDeals.length > 0
    ? `
    <div style="margin-top:24px;">
      <p style="font-size:13px;color:#8b949e;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;">Similar vehicles to consider</p>
      ${similarDeals.map(dealCard).join("")}
    </div>`
    : "";

  const body = `
    ${OFFO_HEADER}

    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:rgba(0,217,126,0.1);border:1px solid rgba(0,217,126,0.25);border-radius:20px;padding:4px 16px;margin-bottom:12px;">
        <span style="font-size:13px;font-weight:700;color:#00d97e;">One Week Later</span>
      </div>
      <h1 style="font-size:22px;color:#e6edf3;margin:0 0 8px;">Did you end up buying it?</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">
        It's been a week since you got your OFFO receipt for the <strong style="color:#e6edf3;">${vehicleLabel}</strong>.
      </p>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:28px;flex-direction:column;">
      <div style="text-align:center;">
        ${ctaButton("✅  Yes, I bought it →", confirmUrl)}
      </div>
      <div style="text-align:center;">
        <a href="${stillLookingUrl}" style="display:inline-block;padding:13px 28px;background:transparent;color:#8b949e;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;border:1px solid #30363d;">
          Still looking →
        </a>
      </div>
    </div>

    ${dealsSection}

    <div style="background:rgba(0,217,126,0.06);border-radius:10px;padding:14px 18px;border:1px solid rgba(0,217,126,0.15);margin-top:24px;">
      <p style="font-size:13px;color:#86efac;margin:0;line-height:1.6;">
        If you bought it, we'll track recalls, set up a routine fit, and keep an eye on your vehicle for you.
      </p>
    </div>

    ${emailFooter(email, "post_purchase_day7")}`;

  return {
    subject: `Quick check-in on your ${vehicleLabel} research`,
    html: emailWrapper(body),
  };
}
