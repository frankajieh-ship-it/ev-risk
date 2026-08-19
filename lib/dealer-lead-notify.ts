/**
 * Dealer Lead Notification
 *
 * When a buyer runs OFFO on a VIN linked to a dealership in our DB,
 * fire a real-time notification email to that dealer.
 *
 * Matching: listing URL domain → dealerships.website domain.
 * Gate: dealer must have contact_email AND (status='active' OR status='prospect').
 * Cooldown: one notification per dealer per VIN per 24h (idempotency key).
 * No buyer PII is sent — only vehicle info and the fact someone researched it.
 */

import { getSupabaseAdmin } from "@/lib/api-auth";
import { emailWrapper, emailFooter } from "@/lib/crm-email";
import { sendChecklistEmail } from "@/lib/resend";

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function buildNotificationEmail(params: {
  dealerName: string;
  vehicleLabel: string;
  vin: string | null;
  price: number | null;
  mileage: number | null;
  dealerEmail: string;
}): string {
  const { dealerName, vehicleLabel, vin, price, mileage, dealerEmail } = params;
  const footer = emailFooter(dealerEmail, "lead_notification");

  const priceStr = price ? `$${price.toLocaleString()}` : null;
  const mileageStr = mileage ? `${mileage.toLocaleString()} mi` : null;
  const detailLine = [priceStr, mileageStr].filter(Boolean).join(" · ");

  const body = `
    <h2 style="font-size:19px;font-weight:700;color:#ffffff;margin:0 0 14px;line-height:1.3;">
      A buyer just researched one of your vehicles on OFFO
    </h2>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 18px;">
      Hi ${dealerName || "there"},
    </p>

    <div style="background:#00d97e14;border:1px solid #00d97e33;border-radius:10px;padding:18px 22px;margin:0 0 22px;">
      <p style="font-size:13px;color:#00d97e;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;">Vehicle researched</p>
      <p style="font-size:16px;font-weight:700;color:#ffffff;margin:0 0 4px;">${vehicleLabel}</p>
      ${detailLine ? `<p style="font-size:13px;color:#8b949e;margin:0 0 4px;">${detailLine}</p>` : ""}
      ${vin ? `<p style="font-size:12px;color:#8b949e;font-family:monospace;margin:0;">VIN: ${vin}</p>` : ""}
    </div>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 18px;">
      An OFFO buyer ran a full AI analysis on this listing — checking battery health, risk flags, price vs. market,
      and negotiation leverage. They're actively evaluating this vehicle.
    </p>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0 0 24px;">
      Buyers who use OFFO typically show up more informed and more ready to buy. If you'd like to receive
      these alerts in real time and see what buyers are asking about your inventory, reply to this email
      and I'll set up your dealer account.
    </p>

    <p style="font-size:15px;color:#c9d1d9;line-height:1.7;margin:0;">
      — Frank<br/>
      <span style="color:#8b949e;font-size:13px;">Founder, OFFO · <a href="mailto:dealers@offolab.com" style="color:#8b949e;">dealers@offolab.com</a></span>
    </p>

    ${footer}
  `;

  return emailWrapper(body);
}

export async function notifyDealerOfLead(params: {
  listingUrl: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  receiptId: string;
}): Promise<void> {
  const { listingUrl, vin, make, model, year, price, mileage, receiptId } = params;

  if (!listingUrl && !vin) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  // Path 1: match via dealership_id on the curated_deals row (covers third-party platform URLs)
  let matched: Array<{ id: string; name: string; contact_email: string; status: string; website: string | null }> = [];

  if (listingUrl) {
    const { data: deal } = await supabase
      .from("curated_deals")
      .select("dealership_id")
      .eq("listing_url", listingUrl)
      .eq("is_active", true)
      .not("dealership_id", "is", null)
      .maybeSingle();

    if (deal?.dealership_id) {
      const { data: dealer } = await supabase
        .from("dealerships")
        .select("id, name, contact_email, status, website")
        .eq("id", deal.dealership_id)
        .in("status", ["active", "prospect"])
        .not("contact_email", "is", null)
        .maybeSingle();

      if (dealer) matched = [dealer];
    }
  }

  // Path 2: fallback — match by listing URL domain against dealerships.website
  if (!matched.length && listingUrl) {
    const urlDomain = extractDomain(listingUrl);
    if (urlDomain) {
      const { data: dealersWithWebsite } = await supabase
        .from("dealerships")
        .select("id, name, contact_email, status, website")
        .in("status", ["active", "prospect"])
        .not("contact_email", "is", null)
        .limit(100);

      matched = (dealersWithWebsite ?? []).filter((d) => {
        if (!d.website) return false;
        const dealerDomain = extractDomain(d.website);
        return dealerDomain && (
          dealerDomain === urlDomain ||
          urlDomain.endsWith(`.${dealerDomain}`) ||
          dealerDomain.endsWith(`.${urlDomain}`)
        );
      });
    }
  }

  if (!matched.length) return;

  const vehicleLabel = [year, make, model].filter(Boolean).join(" ") || "EV listing";
  const idempotencyDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const dealer of matched) {
    const idempotencyKey = `dealer_lead:${dealer.id}:${vin || receiptId}:${idempotencyDate}`;

    // Check if already notified today for this VIN/dealer combo
    const { count } = await supabase
      .from("crm_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotencyKey);

    if ((count ?? 0) > 0) continue;

    const html = buildNotificationEmail({
      dealerName: dealer.name,
      vehicleLabel,
      vin: vin || null,
      price,
      mileage,
      dealerEmail: dealer.contact_email,
    });

    const subject = `Buyer just researched your ${vehicleLabel} on OFFO`;
    const result = await sendChecklistEmail(dealer.contact_email, subject, html);

    // Log the send
    await supabase.from("crm_email_sends").insert({
      email: dealer.contact_email,
      sequence_type: "lead_notification",
      sequence_step: "dealer_lead_alert",
      subject,
      resend_message_id: result.messageId || null,
      status: result.error ? "failed" : "sent",
      idempotency_key: idempotencyKey,
      metadata: {
        dealer_id: dealer.id,
        receipt_id: receiptId,
        vin: vin || null,
        listing_url: listingUrl,
      },
    }).then(() => {}, () => {});

    // Update dealer's last_notified_at (column may not exist yet — error is harmless)
    supabase
      .from("dealerships")
      .update({ last_notified_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", dealer.id)
      .then(() => {}, () => {});
  }
}
