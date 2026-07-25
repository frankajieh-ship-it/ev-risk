/**
 * CRM Eligibility Queries
 *
 * Centralized Supabase queries for determining which users are eligible
 * for each CRM sequence. All queries are additive-safe (re-running produces
 * the same result due to idempotency checks against crm_email_sends).
 */

import { getSupabaseAdmin } from "@/lib/api-auth";
import { vehicleLabel } from "@/lib/crm-templates/shared";
import { articleMatchesVehicle } from "@/lib/vehicle-tags";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConversionCandidate {
  email: string;
  userId?: string;
  anonId?: string;
  eventId: string;
  receiptId?: string;
  vehicle?: string;
  verdict?: string;
  triggerType: "paywall_dismissed" | "checkout_started" | "paywall_seen";
}

export interface AuctionNurtureCandidate {
  email: string;
  anonId?: string;
  eventId: string;
  resultId?: string;
  vehicle?: string;
}

export interface WinBackCandidate {
  userId: string;
  email: string;
  lastReceiptAt: string;
  vehicle?: string;
  receiptsGenerated: number;
}

export interface DigestRecipient {
  userId?: string;
  anonId?: string;
  email: string;
  dealWatchMatches: number;
  receiptsThisWeek: number;
  lastVehicle?: string;
  lastVerdict?: string;
}

export interface MarketSnapshot {
  avgPrice: number;
  greenPct: number;
  yellowPct: number;
  redPct: number;
  totalReceipts: number;
}

// ── Conversion candidates ─────────────────────────────────────────────────────

export async function getConversionCandidates(
  triggerType: "paywall_dismissed" | "checkout_started",
  limit = 50
): Promise<ConversionCandidate[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const now = Date.now();
  const step = triggerType === "paywall_dismissed" ? "conv_24h" : "conv_2h";

  // Time windows: paywall_dismissed → 23-48h ago; checkout_started → 1.5-3h ago
  const windowOldMs = triggerType === "paywall_dismissed" ? 48 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
  const windowRecentMs = triggerType === "paywall_dismissed" ? 23 * 60 * 60 * 1000 : 90 * 60 * 1000;

  const windowStart = new Date(now - windowOldMs).toISOString();
  const windowEnd = new Date(now - windowRecentMs).toISOString();

  const { data: events } = await supabase
    .from("user_events")
    .select("id, user_id, event_data, timestamp")
    .eq("event_name", triggerType)
    .gte("timestamp", windowStart)
    .lte("timestamp", windowEnd)
    .not("is_internal", "eq", true)
    .limit(limit * 2); // over-fetch to account for filtering

  if (!events?.length) return [];

  const candidates: ConversionCandidate[] = [];

  for (const ev of events) {
    const eventData = (ev.event_data || {}) as Record<string, unknown>;
    const receiptId = eventData.receipt_id as string | undefined;
    const anonId = eventData.anon_id as string | undefined;
    const userId = ev.user_id as string | undefined;

    // Skip if already sent this step
    const { count } = await supabase
      .from("crm_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", `conv:${ev.id}:${step}`);
    if ((count ?? 0) > 0) continue;

    // Skip if user has since purchased
    if (receiptId) {
      const { count: purchaseCount } = await supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("base_scenario_id", receiptId)
        .eq("status", "paid");
      if ((purchaseCount ?? 0) > 0) continue;
    }

    // Resolve email — auth user first, then anon email capture
    let email: string | undefined;
    if (userId) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      email = authUser?.user?.email;
    }
    if (!email && anonId) {
      const { data: capture } = await supabase
        .from("checklist_email_captures")
        .select("email")
        .eq("anon_id", anonId)
        .maybeSingle();
      email = capture?.email;
    }
    if (!email) continue;

    // Check suppression
    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, conversion, bounced")
      .eq("email", email)
      .maybeSingle();
    if (pref && (!pref.all_marketing || !pref.conversion || pref.bounced)) continue;

    // Fetch vehicle label from receipt
    let vehicle: string | undefined;
    let verdict: string | undefined;
    if (receiptId) {
      const { data: receipt } = await supabase
        .from("receipts")
        .select("output_json")
        .eq("id", receiptId)
        .maybeSingle();
      if (receipt?.output_json) {
        const out = receipt.output_json as Record<string, unknown>;
        const summary = out.listing_summary as Record<string, unknown> | undefined;
        vehicle = vehicleLabel(
          summary?.year as number | null,
          summary?.make as string | null,
          summary?.model as string | null
        );
        verdict = out.verdict as string | undefined;
      }
    }

    candidates.push({
      email,
      userId,
      anonId,
      eventId: ev.id as string,
      receiptId,
      vehicle,
      verdict,
      triggerType,
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

// ── Paywall abandoned candidates ─────────────────────────────────────────────
// Users who saw the paywall (paywall_seen event) 23–48h ago but never purchased.
// Email resolution requires a prior checklist email capture for anon users.

export async function getPaywallAbandonedCandidates(
  limit = 50
): Promise<ConversionCandidate[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const now = Date.now();
  const windowStart = new Date(now - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
  const windowEnd = new Date(now - 23 * 60 * 60 * 1000).toISOString();   // 23h ago

  const { data: events } = await supabase
    .from("user_events")
    .select("id, user_id, event_data, timestamp")
    .eq("event_name", "paywall_seen")
    .gte("timestamp", windowStart)
    .lte("timestamp", windowEnd)
    .not("is_internal", "eq", true)
    .limit(limit * 2);

  if (!events?.length) return [];

  const candidates: ConversionCandidate[] = [];

  for (const ev of events) {
    const eventData = (ev.event_data || {}) as Record<string, unknown>;
    const receiptId = eventData.receipt_id as string | undefined;
    const anonId = (eventData.anon_id ?? eventData.persistent_session_id) as string | undefined;
    const userId = ev.user_id as string | undefined;

    // Skip if already sent this step
    const { count: alreadySent } = await supabase
      .from("crm_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", `conv:${ev.id}:paywall_seen_24h`);
    if ((alreadySent ?? 0) > 0) continue;

    // Skip if user has since purchased
    if (receiptId) {
      const { count: purchaseCount } = await supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("base_scenario_id", receiptId)
        .eq("status", "paid");
      if ((purchaseCount ?? 0) > 0) continue;
    }

    // Resolve email — auth user first, then anon email capture
    let email: string | undefined;
    if (userId) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      email = authUser?.user?.email;
    }
    if (!email && anonId) {
      const { data: capture } = await supabase
        .from("checklist_email_captures")
        .select("email")
        .eq("anon_id", anonId)
        .maybeSingle();
      email = capture?.email;
    }
    if (!email) continue;

    // Check suppression
    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, conversion, bounced")
      .eq("email", email)
      .maybeSingle();
    if (pref && (!pref.all_marketing || !pref.conversion || pref.bounced)) continue;

    // Fetch vehicle label and verdict from receipt
    let vehicle: string | undefined;
    let verdict: string | undefined;
    if (receiptId) {
      const { data: receipt } = await supabase
        .from("receipts")
        .select("output_json")
        .eq("id", receiptId)
        .maybeSingle();
      if (receipt?.output_json) {
        const out = receipt.output_json as Record<string, unknown>;
        const summary = out.listing_summary as Record<string, unknown> | undefined;
        vehicle = vehicleLabel(
          summary?.year as number | null,
          summary?.make as string | null,
          summary?.model as string | null
        );
        verdict = out.verdict as string | undefined;
      }
    }

    candidates.push({
      email,
      userId,
      anonId,
      eventId: ev.id as string,
      receiptId,
      vehicle,
      verdict,
      triggerType: "paywall_seen",
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

// ── Auction nurture candidates ────────────────────────────────────────────────
// Users who captured email on /copart after running a lot lookup, but have
// not yet purchased a copart_report. Single email, sent 2-24h after capture.

export async function getAuctionNurtureCandidates(
  limit = 50
): Promise<AuctionNurtureCandidate[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const now = Date.now();
  const windowStart = new Date(now - 24 * 60 * 60 * 1000).toISOString(); // up to 24h ago
  const windowEnd = new Date(now - 2 * 60 * 60 * 1000).toISOString();   // at least 2h ago

  const { data: events } = await supabase
    .from("user_events")
    .select("id, event_data, timestamp")
    .eq("event_name", "auction_email_captured")
    .gte("timestamp", windowStart)
    .lte("timestamp", windowEnd)
    .not("is_internal", "eq", true)
    .limit(limit * 2);

  if (!events?.length) return [];

  const candidates: AuctionNurtureCandidate[] = [];

  for (const ev of events) {
    const eventData = (ev.event_data || {}) as Record<string, unknown>;
    const resultId = eventData.result_id as string | undefined;
    const email = eventData.email as string | undefined;

    if (!email) continue;

    // Skip if already sent this nurture email
    const { count: sentCount } = await supabase
      .from("crm_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", `auction_nurture:${ev.id}`);
    if ((sentCount ?? 0) > 0) continue;

    // Skip if already purchased
    if (resultId) {
      const { count: purchaseCount } = await supabase
        .from("auction_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("result_id", resultId);
      if ((purchaseCount ?? 0) > 0) continue;
    }

    // Check suppression
    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, conversion, bounced")
      .eq("email", email)
      .maybeSingle();
    if (pref && (!pref.all_marketing || !pref.conversion || pref.bounced)) continue;

    // Resolve vehicle label from auction_analyses
    let vehicle: string | undefined;
    if (resultId) {
      const { data: analysis } = await supabase
        .from("auction_analyses")
        .select("raw_data")
        .eq("result_id", resultId)
        .maybeSingle();
      if (analysis?.raw_data) {
        const lot = analysis.raw_data as Record<string, unknown>;
        vehicle = [lot.year, lot.make, lot.model, lot.trim].filter(Boolean).join(" ") || undefined;
      }
    }

    candidates.push({
      email,
      eventId: ev.id as string,
      resultId,
      vehicle,
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

// ── Win-back candidates ───────────────────────────────────────────────────────

export async function getWinBackCandidates(
  step: "30d" | "60d",
  limit = 100
): Promise<WinBackCandidate[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const dayThreshold = step === "30d" ? 30 : 60;
  const cutoff = new Date(Date.now() - dayThreshold * 24 * 60 * 60 * 1000).toISOString();
  const activityCutoff = new Date(Date.now() - (dayThreshold + 1) * 24 * 60 * 60 * 1000).toISOString();

  // Use Supabase rpc or raw query via .rpc — fall back to JS-side filtering
  // Fetch auth users who have receipts, then filter in JS (Supabase JS doesn't support
  // cross-schema JOINs directly without an rpc or view)
  const { data: receipts } = await supabase
    .from("receipts")
    .select("user_id, created_at, output_json")
    .not("user_id", "is", null)
    .lte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (!receipts?.length) return [];

  // Group by user_id and find last receipt per user
  const userMap = new Map<string, { lastReceiptAt: string; vehicle?: string; count: number }>();
  for (const r of receipts) {
    const uid = r.user_id as string;
    const existing = userMap.get(uid);
    if (!existing || r.created_at > existing.lastReceiptAt) {
      const out = r.output_json as Record<string, unknown> | null;
      const summary = out?.listing_summary as Record<string, unknown> | undefined;
      const v = vehicleLabel(
        summary?.year as number | null,
        summary?.make as string | null,
        summary?.model as string | null
      );
      userMap.set(uid, {
        lastReceiptAt: r.created_at as string,
        vehicle: v !== "your vehicle" ? v : undefined,
        count: (existing?.count ?? 0) + 1,
      });
    } else {
      const entry = userMap.get(uid)!;
      entry.count++;
    }
  }

  const candidates: WinBackCandidate[] = [];

  for (const [userId, info] of userMap.entries()) {
    if (candidates.length >= limit) break;

    // Check recent activity
    const { count: recentActivity } = await supabase
      .from("user_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("timestamp", activityCutoff);
    if ((recentActivity ?? 0) > 0) continue;

    // Check win-back state
    const stateField = step === "30d" ? "winback_30_sent_at" : "winback_60_sent_at";
    const { data: wb } = await supabase
      .from("crm_win_back_state")
      .select("id, winback_30_sent_at, winback_60_sent_at, exited_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (wb?.exited_at) continue;
    if (wb?.[stateField as keyof typeof wb]) continue;

    // For 60d, must have received 30d first
    if (step === "60d" && !wb?.winback_30_sent_at) continue;

    // Resolve email
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) continue;

    // Check suppression
    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, win_back, bounced")
      .eq("email", email)
      .maybeSingle();
    if (pref && (!pref.all_marketing || !pref.win_back || pref.bounced)) continue;

    candidates.push({
      userId,
      email,
      lastReceiptAt: info.lastReceiptAt,
      vehicle: info.vehicle,
      receiptsGenerated: info.count,
    });
  }

  return candidates;
}

// ── Digest recipients ─────────────────────────────────────────────────────────

export async function getDigestRecipients(
  limit: number,
  offset: number,
  weekKey: string
): Promise<DigestRecipient[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  const recipients: DigestRecipient[] = [];
  const seenEmails = new Set<string>();

  // ── Pool A: Auth users with deal watches or saved scenarios ────────────────

  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, email")
    .not("email", "is", null)
    .range(offset, offset + limit - 1);

  for (const user of users ?? []) {
    // Must have deal watches or saved scenarios
    const { count: dealWatchCount } = await supabase
      .from("deal_watch_searches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: savedCount } = await supabase
      .from("saved_scenarios")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: purchaseCount } = await supabase
      .from("purchases")
      .select("purchase_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "paid");

    const { count: receiptCount } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    if ((dealWatchCount ?? 0) === 0 && (savedCount ?? 0) === 0 && (purchaseCount ?? 0) === 0 && (receiptCount ?? 0) === 0) continue;

    // Check suppression
    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, weekly_digest, bounced")
      .eq("email", user.email)
      .maybeSingle();
    if (pref && (!pref.all_marketing || !pref.weekly_digest || pref.bounced)) continue;

    // Check not already sent this week
    const { count: alreadySent } = await supabase
      .from("crm_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", `digest:${user.id}:week:${weekKey}`);
    if ((alreadySent ?? 0) > 0) continue;

    // Deal watch matches this week
    const { count: matchCount } = await supabase
      .from("deal_watch_results")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("last_seen_at", weekStart.toISOString())
      .gt("price_drop_amount", 0);

    // Receipts this week
    const { count: receiptsThisWeek } = await supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", weekStart.toISOString());

    // Last receipt (vehicle + verdict)
    const { data: lastReceipt } = await supabase
      .from("receipts")
      .select("output_json")
      .eq("user_id", user.id)
      .in("generation_status", ["lite", "full"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let lastVehicle: string | undefined;
    let lastVerdict: string | undefined;
    if (lastReceipt?.output_json) {
      const out = lastReceipt.output_json as Record<string, unknown>;
      const summary = out.listing_summary as Record<string, unknown> | undefined;
      const label = vehicleLabel(
        summary?.year as number | null,
        summary?.make as string | null,
        summary?.model as string | null
      );
      if (label !== "your vehicle") lastVehicle = label;
      lastVerdict = out.verdict as string | undefined;
    }

    seenEmails.add(user.email);
    recipients.push({
      userId: user.id,
      email: user.email,
      dealWatchMatches: matchCount ?? 0,
      receiptsThisWeek: receiptsThisWeek ?? 0,
      lastVehicle,
      lastVerdict,
    });
  }

  // ── Pool B: Anon users who captured email via receipt checklist ────────────
  // Fill remaining slots up to `limit` from checklist_email_captures.

  const remaining = limit - recipients.length;
  if (remaining > 0) {
    const { data: captures } = await supabase
      .from("checklist_email_captures")
      .select("email, anon_id")
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(remaining * 3); // over-fetch to account for suppression + already-sent

    for (const cap of captures ?? []) {
      if (recipients.length >= limit) break;
      if (!cap.email || seenEmails.has(cap.email)) continue;

      // Check suppression
      const { data: pref } = await supabase
        .from("crm_email_preferences")
        .select("all_marketing, weekly_digest, bounced")
        .eq("email", cap.email)
        .maybeSingle();
      if (pref && (!pref.all_marketing || !pref.weekly_digest || pref.bounced)) continue;

      // Check not already sent this week
      const idemKey = `digest:anon:${cap.email}:week:${weekKey}`;
      const { count: alreadySent } = await supabase
        .from("crm_email_sends")
        .select("id", { count: "exact", head: true })
        .eq("idempotency_key", idemKey);
      if ((alreadySent ?? 0) > 0) continue;

      // Last receipt via user_events → receipt_id lookup
      let lastVehicle: string | undefined;
      let lastVerdict: string | undefined;
      let receiptsThisWeek = 0;

      if (cap.anon_id) {
        // Most recent receipt_generated event for this anon
        const { data: latestEvent } = await supabase
          .from("user_events")
          .select("event_data")
          .eq("event_name", "receipt_generated")
          .filter("event_data->>anon_id", "eq", cap.anon_id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();

        const receiptId = (latestEvent?.event_data as Record<string, unknown> | null)?.receipt_id as string | undefined;
        if (receiptId) {
          const { data: receipt } = await supabase
            .from("receipts")
            .select("output_json")
            .eq("id", receiptId)
            .in("generation_status", ["lite", "full"])
            .maybeSingle();

          if (receipt?.output_json) {
            const out = receipt.output_json as Record<string, unknown>;
            const summary = out.listing_summary as Record<string, unknown> | undefined;
            const label = vehicleLabel(
              summary?.year as number | null,
              summary?.make as string | null,
              summary?.model as string | null
            );
            if (label !== "your vehicle") lastVehicle = label;
            lastVerdict = out.verdict as string | undefined;
          }
        }

        // Count receipt_generated events this week for this anon
        const { count: weekCount } = await supabase
          .from("user_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", "receipt_generated")
          .filter("event_data->>anon_id", "eq", cap.anon_id)
          .gte("timestamp", weekStart.toISOString());
        receiptsThisWeek = weekCount ?? 0;
      }

      seenEmails.add(cap.email);
      recipients.push({
        anonId: cap.anon_id ?? undefined,
        email: cap.email,
        dealWatchMatches: 0,
        receiptsThisWeek,
        lastVehicle,
        lastVerdict,
      });
    }
  }

  return recipients;
}

// ── Top weekly news ───────────────────────────────────────────────────────────

export interface NewsDigestArticle {
  title: string;
  url: string;
  source: string;
  category: string;
  impact_score: number;
  ai_summary: string;
}

export async function getTopWeeklyNews(limit = 5): Promise<NewsDigestArticle[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("daily_routine_news")
    .select("title, url, source, category, impact_score, ai_summary")
    .gte("scored_at", since)
    .gte("impact_score", 70)
    .order("impact_score", { ascending: false })
    .limit(limit);

  return (data ?? []) as NewsDigestArticle[];
}

// ── News alert candidates ─────────────────────────────────────────────────────
// For each garage vehicle owner: find new high-impact articles or recalls in the
// last 24h that match their vehicle. Groups into per-user digests.
// Recalls (category='recall') are sent standalone; others batch into one digest.

export interface NewsArticleMatch {
  articleId: string;   // daily_routine_news.article_id
  newsId: string;      // daily_routine_news.id (UUID)
  title: string;
  url: string;
  source: string;
  category: string;
  impactScore: number;
  aiSummary: string | null;
  matchedVehicle: string; // "2021 Tesla Model 3"
  isRecall: boolean;
}

export interface NewsAlertCandidate {
  userId: string;
  email: string;
  articles: NewsArticleMatch[];
  hasRecall: boolean;
}

export async function getNewsAlertCandidates(
  limit = 200
): Promise<NewsAlertCandidate[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const todayDate = new Date().toISOString().slice(0, 10);

  // Fetch articles from last 24h: recalls at 50+, others at 65+
  const { data: articles } = await supabase
    .from("daily_routine_news")
    .select("id, article_id, title, url, source, category, impact_score, key_routine_effects, ai_summary")
    .gte("scored_at", since24h)
    .or("impact_score.gte.65,category.eq.recall")
    .order("impact_score", { ascending: false })
    .limit(100);

  if (!articles?.length) return [];

  // Fetch all garage vehicles (shopping/considering, not owned) with user_id
  const { data: vehicles } = await supabase
    .from("garage_vehicles")
    .select("id, user_id, make, model, year")
    .eq("is_owned_ev", false)
    .not("make", "is", null)
    .not("model", "is", null)
    .not("user_id", "is", null)
    .limit(limit);

  if (!vehicles?.length) return [];

  // Group vehicles by user_id
  const userVehicles = new Map<string, Array<{ make: string; model: string; year: number | null; label: string }>>();
  for (const v of vehicles) {
    const uid = v.user_id as string;
    if (!userVehicles.has(uid)) userVehicles.set(uid, []);
    userVehicles.get(uid)!.push({
      make: v.make as string,
      model: v.model as string,
      year: v.year as number | null,
      label: [v.year, v.make, v.model].filter(Boolean).join(" "),
    });
  }

  const candidates: NewsAlertCandidate[] = [];

  for (const [userId, userVehicleList] of userVehicles.entries()) {
    // Collect matched articles for this user
    const matched: NewsArticleMatch[] = [];

    for (const article of articles) {
      const effects: string[] = Array.isArray(article.key_routine_effects) ? article.key_routine_effects : [];
      const isRecall = article.category === "recall";

      // For each vehicle this user has saved, check if article is relevant
      for (const v of userVehicleList) {
        const isRelevant = isRecall
          // Recalls: match on make name anywhere in title/effects OR effects tag match
          ? (article.title.toLowerCase().includes(v.make.toLowerCase()) ||
             articleMatchesVehicle(effects, v.make, v.model))
          : articleMatchesVehicle(effects, v.make, v.model);

        if (!isRelevant) continue;

        // Check dedup — skip if already dispatched this article to this user
        const { count: alreadySent } = await supabase
          .from("news_alert_dispatches")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("article_id", article.article_id);

        if ((alreadySent ?? 0) > 0) continue;

        matched.push({
          articleId: article.article_id as string,
          newsId: article.id as string,
          title: article.title as string,
          url: article.url as string,
          source: (article.source as string) || "",
          category: article.category as string,
          impactScore: article.impact_score as number,
          aiSummary: (article.ai_summary as string) || null,
          matchedVehicle: v.label,
          isRecall,
        });
        break; // one match per article per user is enough
      }
    }

    if (!matched.length) continue;

    // Resolve email
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) continue;

    // Check suppression — recall uses 'recall' pref, news uses 'news_alerts' pref
    const { data: pref } = await supabase
      .from("crm_email_preferences")
      .select("all_marketing, recall, news_alerts, bounced")
      .eq("email", email)
      .maybeSingle();

    if (pref?.bounced || pref?.all_marketing === false) continue;

    // Filter articles by their pref: recalls need recall=true, others need news_alerts=true
    const allowed = matched.filter((a) =>
      a.isRecall ? pref?.recall !== false : pref?.news_alerts !== false
    );
    if (!allowed.length) continue;

    candidates.push({
      userId,
      email,
      articles: allowed,
      hasRecall: allowed.some((a) => a.isRecall),
    });
  }

  return candidates;
}

// ── Market snapshot ───────────────────────────────────────────────────────────

export async function getDigestMarketSnapshot(): Promise<MarketSnapshot> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { avgPrice: 0, greenPct: 0, yellowPct: 0, redPct: 0, totalReceipts: 0 };

  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: receipts } = await supabase
    .from("receipts")
    .select("output_json")
    .gte("created_at", weekStart)
    .not("output_json", "is", null)
    .limit(500);

  if (!receipts?.length) {
    return { avgPrice: 0, greenPct: 0, yellowPct: 0, redPct: 0, totalReceipts: 0 };
  }

  let totalPrice = 0;
  let priceCount = 0;
  let green = 0, yellow = 0, red = 0;

  for (const r of receipts) {
    const out = r.output_json as Record<string, unknown>;
    const verdict = out?.verdict as string | undefined;
    if (verdict === "GREEN") green++;
    else if (verdict === "YELLOW") yellow++;
    else if (verdict === "RED") red++;

    const summary = out?.listing_summary as Record<string, unknown> | undefined;
    const price = summary?.price as number | undefined;
    if (price && price > 0) {
      totalPrice += price;
      priceCount++;
    }
  }

  const total = receipts.length;
  return {
    avgPrice: priceCount > 0 ? Math.round(totalPrice / priceCount) : 0,
    greenPct: total > 0 ? Math.round((green / total) * 100) : 0,
    yellowPct: total > 0 ? Math.round((yellow / total) * 100) : 0,
    redPct: total > 0 ? Math.round((red / total) * 100) : 0,
    totalReceipts: total,
  };
}
