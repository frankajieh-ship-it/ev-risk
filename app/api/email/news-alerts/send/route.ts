/**
 * POST /api/email/news-alerts/send
 *
 * Scans daily_routine_news for articles from the last 24h that match
 * users' saved garage vehicle listings and sends personalized alerts.
 *
 * Two send modes:
 *   - Recall articles (category='recall'): standalone email, sent immediately, uncapped
 *   - Impact/market articles: batched into one digest email per user per day
 *
 * Idempotency: news_alert_dispatches table prevents re-alerting same article.
 * Protected by ADMIN_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { getNewsAlertCandidates, type NewsArticleMatch } from "@/lib/crm-queries";
import { buildRecallAlert, buildNewsDigest } from "@/lib/crm-templates/news-alert";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const todayDate = new Date().toISOString().slice(0, 10);

  const results = {
    users_evaluated: 0,
    recall_emails: { sent: 0, skipped: 0, errors: 0 },
    digest_emails: { sent: 0, skipped: 0, errors: 0 },
    articles_dispatched: 0,
  };

  const candidates = await getNewsAlertCandidates(200);
  results.users_evaluated = candidates.length;

  for (const candidate of candidates) {
    const { userId, email, articles } = candidate;

    const recallArticles = articles.filter((a) => a.isRecall);
    const digestArticles = articles.filter((a) => !a.isRecall);

    // ── Recall emails — standalone, uncapped ─────────────────────────────────
    if (recallArticles.length > 0) {
      // Group all recall articles into one email per user per day
      const idemKey = `news_recall:${todayDate}:${userId}`;
      const primaryVehicle = recallArticles[0].matchedVehicle;

      try {
        const { subject, html } = buildRecallAlert(email, primaryVehicle, recallArticles);
        const r = await safeSend({
          email,
          userId,
          sequenceType: "recall",
          sequenceStep: "news_recall_daily",
          subject,
          html,
          idempotencyKey: idemKey,
          metadata: {
            vehicle: primaryVehicle,
            article_count: recallArticles.length,
            article_ids: recallArticles.map((a) => a.articleId),
            date: todayDate,
          },
        });

        if (r.sent) {
          results.recall_emails.sent++;
          await recordDispatches(supabase, userId, email, recallArticles, todayDate);
          results.articles_dispatched += recallArticles.length;
        } else if (r.skipped) {
          results.recall_emails.skipped++;
          // Still mark dispatched so dedup table is consistent
          await recordDispatches(supabase, userId, email, recallArticles, todayDate);
        } else {
          results.recall_emails.errors++;
        }
      } catch (err) {
        results.recall_emails.errors++;
        console.error("[news-alerts/send] recall email error:", err instanceof Error ? err.message : err);
      }
    }

    // ── Digest email — one per user per day ──────────────────────────────────
    if (digestArticles.length > 0) {
      const idemKey = `news_digest:${todayDate}:${userId}`;

      try {
        // Sort by impact_score desc so most important article leads
        const sorted = [...digestArticles].sort((a, b) => b.impactScore - a.impactScore);
        const { subject, html } = buildNewsDigest(email, sorted);
        const r = await safeSend({
          email,
          userId,
          sequenceType: "recall",  // reuses uncapped recall sequence to avoid marketing cap
          sequenceStep: "news_digest_daily",
          subject,
          html,
          idempotencyKey: idemKey,
          metadata: {
            article_count: digestArticles.length,
            article_ids: digestArticles.map((a) => a.articleId),
            date: todayDate,
          },
        });

        if (r.sent) {
          results.digest_emails.sent++;
          await recordDispatches(supabase, userId, email, digestArticles, todayDate);
          results.articles_dispatched += digestArticles.length;
        } else if (r.skipped) {
          results.digest_emails.skipped++;
          await recordDispatches(supabase, userId, email, digestArticles, todayDate);
        } else {
          results.digest_emails.errors++;
        }
      } catch (err) {
        results.digest_emails.errors++;
        console.error("[news-alerts/send] digest email error:", err instanceof Error ? err.message : err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    date: todayDate,
    ...results,
  });
}

async function recordDispatches(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  articles: NewsArticleMatch[],
  digestDate: string
) {
  if (!articles.length) return;
  // Upsert — safe to call even if already dispatched (idempotent via UNIQUE constraint)
  await supabase.from("news_alert_dispatches").upsert(
    articles.map((a) => ({
      user_id: userId,
      article_id: a.articleId,
      email,
      digest_date: digestDate,
    })),
    { onConflict: "user_id,article_id", ignoreDuplicates: true }
  );
}
