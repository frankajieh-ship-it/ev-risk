/**
 * Dealer Cold Outreach Email Templates
 *
 * Targets dealers identified from listing sites (CarGurus, Cars.com, AutoTrader)
 * whose inventory OFFO has already analyzed. Emails reference their actual listings
 * by name, verdict, and risk flags — making them highly personalized without scraping.
 *
 * intro:    First touch — "we analyzed your listings, here's what buyers see"
 * followup: 7-day follow-up — concrete offer, lower friction ask
 */

import { SITE_URL, ctaButton } from "./shared";
import { emailFooter, emailWrapper } from "@/lib/crm-email";

const SIGNUP_URL = `${SITE_URL}/dealers/join`;

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
    <p style="margin:6px 0 0;font-size:11px;color:#8b949e;text-transform:uppercase;letter-spacing:0.08em;">EV Buyer Intelligence</p>
  </div>`;

export interface DealerInventorySnippet {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  price?: number | null;
  mileage?: number | null;
  verdict: string; // GREEN | YELLOW | RED
  risk_flags?: string[] | null;
  listing_url?: string | null;
}

export interface DealerColdOutreachContext {
  email: string;
  dealerName: string;
  contactName?: string | null;
  city?: string | null;
  state?: string | null;
  listingSource?: string | null; // 'cargurus' | 'carscom' | 'autotrader'
  analyzedCount: number; // total curated_deals rows for this dealer
  inventory: DealerInventorySnippet[]; // up to 3 listings to show inline
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function verdictBadge(verdict: string): string {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    GREEN: { bg: "rgba(0,217,126,0.12)", color: "#00d97e", label: "Strong Buy" },
    YELLOW: { bg: "rgba(234,179,8,0.12)", color: "#eab308", label: "Proceed with Caution" },
    RED: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "High Risk" },
  };
  const s = map[verdict?.toUpperCase()] ?? map["YELLOW"];
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${s.bg};color:${s.color};font-size:11px;font-weight:700;">${s.label}</span>`;
}

function formatPrice(cents?: number | null): string {
  if (!cents) return "";
  return ` · $${(cents / 100).toLocaleString("en-US")}`;
}

function inventoryCard(v: DealerInventorySnippet): string {
  const label = `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
  const sub = [
    v.mileage ? `${v.mileage.toLocaleString("en-US")} mi` : null,
    v.price ? `$${v.price.toLocaleString("en-US")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const flags =
    v.risk_flags && v.risk_flags.length > 0
      ? `<p style="font-size:12px;color:#8b949e;margin:6px 0 0;">⚠ ${v.risk_flags.slice(0, 2).join(", ")}</p>`
      : "";

  return `
    <div style="background:#161b22;border-radius:10px;padding:14px 16px;border:1px solid #30363d;margin-bottom:10px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div>
          <p style="font-size:14px;font-weight:600;color:#e6edf3;margin:0 0 2px;">${label}</p>
          ${sub ? `<p style="font-size:12px;color:#8b949e;margin:0;">${sub}</p>` : ""}
          ${flags}
        </div>
        <div style="flex-shrink:0;">${verdictBadge(v.verdict)}</div>
      </div>
    </div>`;
}

function sourceLabel(src?: string | null): string {
  const map: Record<string, string> = {
    cargurus: "CarGurus",
    carscom: "Cars.com",
    autotrader: "AutoTrader",
  };
  return (src && map[src]) || "a listing site";
}

// ── Intro email ───────────────────────────────────────────────────────────────

export function buildDealerColdOutreachIntro(
  ctx: DealerColdOutreachContext
): { subject: string; html: string } {
  const { email, dealerName, contactName, city, state, analyzedCount, inventory, listingSource } = ctx;

  const greeting = contactName ? `Hi ${contactName},` : `Hi there,`;
  const locationStr = city && state ? ` in ${city}, ${state}` : "";
  const source = sourceLabel(listingSource);
  const inventoryHtml = inventory.slice(0, 3).map(inventoryCard).join("");

  const body = `
    ${OFFO_HEADER}

    <p style="font-size:14px;color:#c9d1d9;margin:0 0 20px;">${greeting}</p>

    <p style="font-size:14px;color:#c9d1d9;margin:0 0 16px;">
      I'm reaching out from OFFO — we're an EV buyer intelligence platform. We've been
      analyzing used EV listings on ${source}, and we ran reports on
      <strong style="color:#e6edf3;">${analyzedCount} vehicle${analyzedCount !== 1 ? "s" : ""} from ${dealerName}${locationStr}</strong>.
    </p>

    <p style="font-size:14px;color:#c9d1d9;margin:0 0 20px;">
      Here's a snapshot of what buyers researching your inventory are seeing right now:
    </p>

    ${inventoryHtml}

    <div style="background:rgba(0,217,126,0.06);border-radius:10px;padding:16px 18px;border:1px solid rgba(0,217,126,0.15);margin:20px 0;">
      <p style="font-size:13px;color:#86efac;margin:0 0 10px;font-weight:600;">Why dealers partner with OFFO:</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;color:#86efac;line-height:1.9;">
        <li>Buyers researching your vehicles see your dealership as a <strong>verified, trusted source</strong></li>
        <li>You get a <strong>direct inquiry</strong> when a buyer is ready — no cold lead lists</li>
        <li>Real-time buyer intent data — see who's actively comparing your inventory</li>
        <li>OFFO Verified badge on every receipt that touches your stock</li>
      </ul>
    </div>

    <div style="text-align:center;margin:24px 0;">
      ${ctaButton("Claim your free dealer profile →", SIGNUP_URL)}
    </div>

    <p style="font-size:13px;color:#8b949e;margin:0 0 4px;">
      Takes 2 minutes to apply. No credit card required. Our team reviews and approves within 1 business day.
    </p>
    <p style="font-size:13px;color:#8b949e;margin:0 0 20px;">
      If this isn't the right person, feel free to forward — I'm happy to answer any questions.
    </p>

    ${emailFooter(email, "dealer_acquisition")}`;

  return {
    subject: `OFFO analyzed ${analyzedCount} of your EV listing${analyzedCount !== 1 ? "s" : ""} — here's what buyers see`,
    html: emailWrapper(body),
  };
}

// ── Follow-up email ───────────────────────────────────────────────────────────

export function buildDealerColdOutreachFollowup(
  ctx: DealerColdOutreachContext
): { subject: string; html: string } {
  const { email, dealerName, analyzedCount, inventory } = ctx;

  const inventoryHtml = inventory.slice(0, 2).map(inventoryCard).join("");

  const body = `
    ${OFFO_HEADER}

    <p style="font-size:14px;color:#c9d1d9;margin:0 0 16px;">
      Following up on my note from last week about ${dealerName}'s listings on OFFO.
    </p>

    <p style="font-size:14px;color:#c9d1d9;margin:0 0 20px;">
      We still have <strong style="color:#e6edf3;">${analyzedCount} of your vehicles</strong> in our buyer research database.
      Every week, EV shoppers run receipts on listings like these — and right now, your dealership
      isn't showing up as a verified partner when they do.
    </p>

    ${inventoryHtml}

    <div style="background:#161b22;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #30363d;">
      <p style="font-size:13px;font-weight:700;color:#00d97e;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 14px;">What happens when you join</p>
      <div style="font-size:13px;color:#c9d1d9;line-height:1.8;">
        <p style="margin:0 0 8px;">✓ &nbsp;Your dealership shows as <strong style="color:#e6edf3;">OFFO Verified</strong> on every receipt for your stock</p>
        <p style="margin:0 0 8px;">✓ &nbsp;Buyers who ran a GREEN receipt on your car can contact you <strong style="color:#e6edf3;">directly through OFFO</strong></p>
        <p style="margin:0;">✓ &nbsp;You see intent signals — make, model, budget — before they even reach out</p>
      </div>
    </div>

    <div style="text-align:center;margin:24px 0;">
      ${ctaButton("Claim your free profile →", SIGNUP_URL)}
    </div>

    <p style="font-size:13px;color:#8b949e;margin:0 0 20px;">
      Questions? Just reply — I'll get back to you directly.
    </p>

    ${emailFooter(email, "dealer_acquisition")}`;

  return {
    subject: `Still have ${analyzedCount} of your listings — quick follow-up`,
    html: emailWrapper(body),
  };
}
