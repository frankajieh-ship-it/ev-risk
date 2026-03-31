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
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";

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
        const pendingAlerts = (search.deal_watch_results ?? []).filter(
          (r: any) => r.price_drop_amount && r.price_drop_amount > 0 && !r.alert_sent_at && r.is_active
        );

        if (pendingAlerts.length === 0) continue;

        // Build email
        const alertRows = pendingAlerts
          .map((r: any) => {
            const drop = r.price_drop_amount ? `$${Math.round(r.price_drop_amount / 100).toLocaleString()}` : null;
            const price = r.last_price ? `$${Math.round(r.last_price / 100).toLocaleString()}` : "—";
            const verdictColor = r.last_verdict === "GREEN" ? "#16a34a" : r.last_verdict === "RED" ? "#dc2626" : "#ca8a04";
            return `
              <tr style="border-bottom:1px solid #f3f4f6">
                <td style="padding:10px 12px;font-size:14px;color:#111">${r.vehicle_label}</td>
                <td style="padding:10px 12px;font-size:14px;text-align:right">${price}</td>
                ${drop ? `<td style="padding:10px 12px;font-size:14px;color:#16a34a;text-align:right">↓ ${drop}</td>` : '<td></td>'}
                ${r.last_verdict ? `<td style="padding:10px 12px;font-size:13px;font-weight:600;color:${verdictColor};text-align:center">${r.last_verdict}</td>` : '<td></td>'}
              </tr>`;
          })
          .join("");

        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#0a0a0a;padding:20px 24px;border-radius:8px 8px 0 0">
              <span style="color:white;font-size:22px;font-weight:700">OFFO</span>
              <span style="color:#22c55e;margin-left:8px;font-size:13px">Deal Watch Alert</span>
            </div>
            <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
              <h2 style="margin:0 0 4px;font-size:18px;color:#111">Price drops on your saved search</h2>
              <p style="margin:0 0 20px;font-size:14px;color:#6b7280">${search.label}</p>
              <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden">
                <thead>
                  <tr style="background:#f3f4f6">
                    <th style="padding:10px 12px;font-size:12px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase">Vehicle</th>
                    <th style="padding:10px 12px;font-size:12px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase">Price</th>
                    <th style="padding:10px 12px;font-size:12px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase">Drop</th>
                    <th style="padding:10px 12px;font-size:12px;text-align:center;color:#6b7280;font-weight:600;text-transform:uppercase">Verdict</th>
                  </tr>
                </thead>
                <tbody>${alertRows}</tbody>
              </table>
              <div style="margin-top:24px;text-align:center">
                <a href="${siteUrl}/receipt"
                   style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
                  Analyze a listing →
                </a>
              </div>
              <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center">
                You're receiving this because you set up a Deal Watch alert on OFFO.<br>
                <a href="${siteUrl}/workspace/garage" style="color:#9ca3af">Manage alerts</a>
              </p>
            </div>
          </div>`;

        const sent = await sendChecklistEmail(
          toEmail,
          `[OFFO Deal Watch] Price drops on: ${search.label}`,
          html
        );

        if (sent.success) {
          results.alerts_sent++;
          // Mark all pending alerts as sent
          const ids = pendingAlerts.map((r: any) => r.id);
          await supabase
            .from("deal_watch_results")
            .update({ alert_sent_at: new Date().toISOString() })
            .in("id", ids);
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
