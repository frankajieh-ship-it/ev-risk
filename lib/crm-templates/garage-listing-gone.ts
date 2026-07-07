/**
 * Garage Listing-Gone Email Template
 *
 * Sent when a saved garage vehicle's listing appears to have been removed
 * from the market. Includes up to 3 similar vehicles as alternatives.
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

export interface SimilarVehicle {
  make: string;
  model: string;
  year: number | null;
  priceCents: number | null;
  listingUrl: string | null;
}

export interface GarageListingGoneContext {
  email: string;
  vehicle: string;
  listingUrl: string;
  garageVehicleId: string;
  similarVehicles: SimilarVehicle[];
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function buildSimilarVehicleCard(v: SimilarVehicle): string {
  const label = [v.year, v.make, v.model].filter(Boolean).join(" ");
  const price = v.priceCents ? formatDollars(v.priceCents) : "Price TBD";
  const href = v.listingUrl
    ? `${SITE_URL}/receipt?url=${encodeURIComponent(v.listingUrl)}&src=listing_gone_similar`
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

export function buildGarageListingGoneEmail(ctx: GarageListingGoneContext): { subject: string; html: string } {
  const { email, vehicle, similarVehicles } = ctx;

  const subject = `${vehicle} is no longer listed — ${similarVehicles.length > 0 ? `${similarVehicles.length} similar EVs to consider` : "see alternatives"}`;

  const similarSection = similarVehicles.length > 0
    ? `
    <div style="background:#0d1117;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:0.05em;">Similar EVs available now</p>
      ${similarVehicles.map(buildSimilarVehicleCard).join("")}
    </div>`
    : `
    <div style="background:#0d1117;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#8b949e;">Check our Deal Watch feed for similar vehicles in your area.</p>
    </div>`;

  const body = `
    ${OFFO_HEADER}

    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;background:#f59e0b22;color:#f59e0b;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 12px;border-radius:20px;border:1px solid #f59e0b33;">
        Listing Removed
      </span>
    </div>

    <h2 style="font-size:20px;font-weight:700;color:#e6edf3;text-align:center;margin:0 0 8px;">
      This listing appears to be gone
    </h2>
    <p style="font-size:14px;color:#8b949e;text-align:center;margin:0 0 24px;">
      The <strong style="color:#e6edf3;">${vehicle}</strong> you saved to your garage has been removed or sold.
      Here are some alternatives to keep your search moving.
    </p>

    ${similarSection}

    <div style="text-align:center;margin-bottom:24px;">
      ${ctaButton("Browse your garage", `${SITE_URL}/workspace/garage`)}
    </div>

    <div style="background:#161b22;border-radius:10px;padding:14px 16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.5;">
        <strong style="color:#e6edf3;">Tip:</strong> Listings for popular EVs can go fast.
        Save multiple vehicles to your garage to keep backup options ready.
      </p>
    </div>`;

  return {
    subject,
    html: emailWrapper(body + emailFooter(email, "listing_gone")),
  };
}
