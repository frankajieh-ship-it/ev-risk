/**
 * POST /api/email/dealer-cold-outreach/send
 *
 * Sends personalized cold emails to dealer prospects (status='prospect').
 * Each email references up to 3 of the dealer's actual listings from curated_deals,
 * showing the OFFO verdict and any risk flags — making outreach hyper-relevant.
 *
 * Two-step sequence per dealer:
 *   intro:    First email — sent immediately (within next daily run)
 *   followup: Sent 7+ days after intro if no reply / no signup
 *
 * A dealer stops receiving emails when they:
 *   - Sign up (status changes to 'pending' or 'approved')
 *   - Unsubscribe (suppressed in crm_email_preferences)
 *   - Have already received both intro + followup
 *
 * Protected by ADMIN_API_KEY. Designed to run daily via scheduled function.
 * All sends go through safeSend() for suppression, daily cap, and idempotency.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import {
  buildDealerColdOutreachIntro,
  buildDealerColdOutreachFollowup,
  type DealerInventorySnippet,
} from "@/lib/crm-templates/dealer-cold-outreach";

const FOLLOWUP_DELAY_DAYS = 7;
const MAX_PROSPECTS_PER_RUN = 50; // keep daily send volume manageable

interface ProspectRow {
  id: string;
  name: string;
  contact_email: string;
  contact_name: string | null;
  city: string | null;
  state: string | null;
  prospect_source: string | null;
}

interface CuratedDealRow {
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  verdict: string;
  risk_flags: string[] | null;
  listing_url: string | null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!isResendConfigured()) return NextResponse.json({ error: "Email service not configured" }, { status: 503 });

  const results = { intro_sent: 0, followup_sent: 0, skipped: 0, errors: 0 };

  // Fetch prospect dealers (not yet approved/rejected)
  const { data: prospects, error: prospectError } = await supabase
    .from("dealerships")
    .select("id, name, contact_email, contact_name, city, state, prospect_source")
    .eq("status", "prospect")
    .not("contact_email", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_PROSPECTS_PER_RUN);

  if (prospectError || !prospects || prospects.length === 0) {
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      message: prospectError ? `Query error: ${prospectError.message}` : "No prospects found",
      results,
    });
  }

  const sevenDaysAgo = new Date(Date.now() - FOLLOWUP_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const prospect of prospects as ProspectRow[]) {
    try {
      const introKey = `dealer_cold:${prospect.id}:intro`;
      const followupKey = `dealer_cold:${prospect.id}:followup`;

      // Check what has already been sent
      const { data: sentRows } = await supabase
        .from("dealer_outreach")
        .select("step, sent_at")
        .eq("dealership_id", prospect.id)
        .in("step", ["intro", "followup"]);

      const sentSteps = new Map((sentRows ?? []).map((r) => [r.step, r.sent_at]));
      const introSentAt = sentSteps.get("intro") ?? null;

      // If both already sent, skip
      if (sentSteps.has("intro") && sentSteps.has("followup")) {
        results.skipped++;
        continue;
      }

      // Pull their curated_deals inventory (up to 3, prefer GREEN then YELLOW then RED)
      const { data: deals } = await supabase
        .from("curated_deals")
        .select("year, make, model, trim, price, mileage, verdict, risk_flags, listing_url")
        .eq("dealership_id", prospect.id)
        .eq("is_active", true)
        .order("verdict", { ascending: true }) // GREEN < RED alphabetically — use score instead below
        .limit(10);

      // Sort: GREEN first, then YELLOW, then RED
      const verdictOrder: Record<string, number> = { GREEN: 0, YELLOW: 1, RED: 2 };
      const sortedDeals = (deals ?? []).sort(
        (a, b) => (verdictOrder[a.verdict] ?? 1) - (verdictOrder[b.verdict] ?? 1)
      );
      const topDeals: DealerInventorySnippet[] = sortedDeals.slice(0, 3).map((d: CuratedDealRow) => ({
        year: d.year,
        make: d.make,
        model: d.model,
        trim: d.trim,
        price: d.price,
        mileage: d.mileage,
        verdict: d.verdict,
        risk_flags: d.risk_flags,
        listing_url: d.listing_url,
      }));

      const analyzedCount = deals?.length ?? 0;
      if (analyzedCount === 0) {
        // No linked inventory — skip until deals are linked via import
        results.skipped++;
        continue;
      }

      const ctx = {
        email: prospect.contact_email,
        dealerName: prospect.name,
        contactName: prospect.contact_name,
        city: prospect.city,
        state: prospect.state,
        listingSource: prospect.prospect_source,
        analyzedCount,
        inventory: topDeals,
      };

      if (!sentSteps.has("intro")) {
        // Send intro
        const { subject, html } = buildDealerColdOutreachIntro(ctx);
        const r = await safeSend({
          email: prospect.contact_email,
          sequenceType: "dealer_acquisition", // reuses existing suppression/preference column
          sequenceStep: "cold_intro",
          subject,
          html,
          idempotencyKey: introKey,
          metadata: { dealership_id: prospect.id, analyzed_count: analyzedCount },
        });

        if (r.sent) {
          results.intro_sent++;
          // Log to dealer_outreach table for tracking
          await supabase.from("dealer_outreach").insert({
            dealership_id: prospect.id,
            step: "intro",
            idempotency_key: introKey,
            metadata: { analyzed_count: analyzedCount },
          });
          await supabase
            .from("dealerships")
            .update({ outreach_step: "intro", outreach_sent_at: new Date().toISOString() })
            .eq("id", prospect.id);
        } else if (r.skipped) {
          results.skipped++;
        } else {
          results.errors++;
        }
      } else if (!sentSteps.has("followup") && introSentAt && introSentAt < sevenDaysAgo) {
        // Send followup
        const { subject, html } = buildDealerColdOutreachFollowup(ctx);
        const r = await safeSend({
          email: prospect.contact_email,
          sequenceType: "dealer_acquisition",
          sequenceStep: "cold_followup",
          subject,
          html,
          idempotencyKey: followupKey,
          metadata: { dealership_id: prospect.id, analyzed_count: analyzedCount },
        });

        if (r.sent) {
          results.followup_sent++;
          await supabase.from("dealer_outreach").insert({
            dealership_id: prospect.id,
            step: "followup",
            idempotency_key: followupKey,
            metadata: { analyzed_count: analyzedCount },
          });
          await supabase
            .from("dealerships")
            .update({ outreach_step: "followup", outreach_sent_at: new Date().toISOString() })
            .eq("id", prospect.id);
        } else if (r.skipped) {
          results.skipped++;
        } else {
          results.errors++;
        }
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.errors++;
      console.error("[dealer-cold-outreach/send] error for prospect", prospect.id, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    prospects_evaluated: prospects.length,
    sent: results,
  });
}
