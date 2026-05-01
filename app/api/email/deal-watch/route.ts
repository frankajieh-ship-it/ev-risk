/**
 * Deal Watch Alert Sender
 *
 * POST /api/email/deal-watch
 * Protected by ADMIN_API_KEY. Called by the scan-deal-watch Netlify scheduled function.
 *
 * For each active saved search, checks recent receipts/garage items against the
 * search criteria and sends a price-drop or new-match alert if warranted.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendChecklistEmail, isResendConfigured, buildDealWatchAlertHtml } from "@/lib/resend";
import { trackServerEvent } from "@/lib/track-server-event";

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const apiKey = authHeader?.replace("Bearer ", "") ?? request.headers.get("x-api-key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ success: false, error: "Email not configured" }, { status: 503 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
  const results = { checked: 0, alerts_sent: 0, errors: 0 };

  try {
    // Fetch all searches with email alerts enabled
    const { data: searches, error: searchErr } = await supabase
      .from("deal_watch_searches")
      .select("*, deal_watch_results(*)")
      .eq("email_alerts", true)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(100);

    if (searchErr || !searches) {
      return NextResponse.json({ success: false, error: searchErr?.message ?? "No searches" }, { status: 500 });
    }

    for (const search of searches) {
      results.checked++;

      try {
        // Get user's email
        const { data: userRow } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("user_id", search.user_id)
          .maybeSingle();

        const toEmail = search.alert_email || userRow?.email;
        if (!toEmail) continue;

        // Find results that had a price drop and haven't had an alert sent yet
        type DealWatchResult = { id: string; vehicle_label: string; last_price: number | null; price_drop_amount: number | null; last_verdict: "GREEN" | "YELLOW" | "RED" | null; alert_sent_at: string | null; is_active: boolean };
        const pendingAlerts = (search.deal_watch_results ?? []).filter(
          (r: DealWatchResult) => r.price_drop_amount && r.price_drop_amount > 0 && !r.alert_sent_at && r.is_active
        );

        if (pendingAlerts.length === 0) continue;

        // Build branded email
        const html = buildDealWatchAlertHtml(
          pendingAlerts.map((r: DealWatchResult) => ({
            vehicle_label: r.vehicle_label,
            last_price: r.last_price,
            price_drop_amount: r.price_drop_amount,
            last_verdict: r.last_verdict,
          })),
          search.label,
          siteUrl
        );

        const sent = await sendChecklistEmail(
          toEmail,
          `[OFFO Deal Watch] Price drops on: ${search.label}`,
          html
        );

        if (sent.success) {
          results.alerts_sent++;
          // Mark all pending alerts as sent
          const ids = pendingAlerts.map((r: DealWatchResult) => r.id);
          await supabase
            .from("deal_watch_results")
            .update({ alert_sent_at: new Date().toISOString() })
            .in("id", ids);

          // Track alert sent event for each result
          for (const r of pendingAlerts) {
            trackServerEvent({
              event_name: "deal_watch_alert_sent",
              source: "listing",
              user_id: search.user_id,
              page_path: "/api/email/deal-watch",
              entity_type: "deal_watch_result_id",
              entity_id: r.id,
              payload: {
                search_id: search.id,
                vehicle_label: r.vehicle_label,
                price_drop_amount: r.price_drop_amount,
                last_price: r.last_price,
              },
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`[deal-watch] Error processing search ${search.id}:`, err);
        results.errors++;
      }

      // Update last_checked_at
      await supabase
        .from("deal_watch_searches")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", search.id);
    }

    return NextResponse.json({ success: true, ...results });
  } catch (err) {
    console.error("[deal-watch] Fatal error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
