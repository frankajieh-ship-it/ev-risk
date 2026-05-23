/**
 * POST /api/email/dealer-acquisition/send
 *
 * Sends dealer acquisition emails to buyers who have sent at least one inquiry
 * but have not yet signed up as a dealer.
 *
 * Two steps per candidate:
 *   intro:    First email — sent if no intro has been sent yet
 *   followup: Follow-up email — sent 7+ days after intro
 *
 * Protected by ADMIN_API_KEY. Designed to run daily via cron.
 * All sends go through safeSend() for suppression, daily cap, and idempotency.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import {
  buildDealerAcquisitionIntro,
  buildDealerAcquisitionFollowup,
} from "@/lib/crm-templates/dealer-acquisition";

const FOLLOWUP_DELAY_DAYS = 7;

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

  // Find buyers with ≥1 inquiry in the last 30 days who are not dealer members
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error: queryError } = await supabase.rpc(
    "get_dealer_acquisition_candidates",
    { since: thirtyDaysAgo, limit_count: 100 }
  );

  // Fallback if RPC doesn't exist: query directly via join
  interface Candidate {
    email: string;
    user_id: string;
    inquiry_count: number;
    last_inquiry_at: string;
  }

  let candidateList: Candidate[] = [];
  if (queryError || !candidates) {
    // Direct query: buyers with inquiries but no dealer_members row
    const { data: rows } = await supabase
      .from("inquiries")
      .select("buyer_user_id, created_at")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200);

    if (rows) {
      // Deduplicate by user_id, count inquiries
      const byUser = new Map<string, { count: number; lastAt: string }>();
      for (const r of rows) {
        const existing = byUser.get(r.buyer_user_id);
        if (!existing || r.created_at > existing.lastAt) {
          byUser.set(r.buyer_user_id, {
            count: (existing?.count ?? 0) + 1,
            lastAt: r.created_at,
          });
        }
      }

      // Filter out existing dealer members
      const userIds = Array.from(byUser.keys());
      const { data: members } = await supabase
        .from("dealer_members")
        .select("user_id")
        .in("user_id", userIds);

      const dealerUserIds = new Set((members ?? []).map((m) => m.user_id));

      // Get emails for non-dealer users
      for (const [userId, stats] of byUser.entries()) {
        if (dealerUserIds.has(userId)) continue;
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        const email = userData?.user?.email;
        if (!email) continue;
        candidateList.push({
          email,
          user_id: userId,
          inquiry_count: stats.count,
          last_inquiry_at: stats.lastAt,
        });
        if (candidateList.length >= 100) break;
      }
    }
  } else {
    candidateList = candidates as Candidate[];
  }

  const sevenDaysAgo = new Date(Date.now() - FOLLOWUP_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  for (const candidate of candidateList) {
    try {
      const introKey = `dealer_acq:${candidate.user_id}:intro`;
      const followupKey = `dealer_acq:${candidate.user_id}:followup`;

      // Check which emails have already been sent for this user
      const { data: sentRows } = await supabase
        .from("crm_email_sends")
        .select("idempotency_key, created_at")
        .in("idempotency_key", [introKey, followupKey]);

      const sentKeys = new Set((sentRows ?? []).map((r) => r.idempotency_key));
      const introSentAt = (sentRows ?? []).find((r) => r.idempotency_key === introKey)?.created_at;

      if (!sentKeys.has(introKey)) {
        // Send intro email
        const { subject, html } = buildDealerAcquisitionIntro({
          email: candidate.email,
          inquiryCount: candidate.inquiry_count,
        });
        const r = await safeSend({
          email: candidate.email,
          userId: candidate.user_id,
          sequenceType: "dealer_acquisition",
          sequenceStep: "intro",
          subject,
          html,
          idempotencyKey: introKey,
          metadata: { inquiry_count: candidate.inquiry_count, last_inquiry_at: candidate.last_inquiry_at },
        });
        if (r.sent) results.intro_sent++;
        else if (r.skipped) results.skipped++;
        else results.errors++;
      } else if (!sentKeys.has(followupKey) && introSentAt && introSentAt < sevenDaysAgo) {
        // Intro was sent 7+ days ago — send followup
        const { subject, html } = buildDealerAcquisitionFollowup({
          email: candidate.email,
        });
        const r = await safeSend({
          email: candidate.email,
          userId: candidate.user_id,
          sequenceType: "dealer_acquisition",
          sequenceStep: "followup",
          subject,
          html,
          idempotencyKey: followupKey,
          metadata: { inquiry_count: candidate.inquiry_count },
        });
        if (r.sent) results.followup_sent++;
        else if (r.skipped) results.skipped++;
        else results.errors++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.errors++;
      console.error("[dealer-acquisition/send] error:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    candidates: candidateList.length,
    sent: results,
  });
}
