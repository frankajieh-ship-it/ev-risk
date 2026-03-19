/**
 * POST /api/full-risk-report/intake
 *
 * Records the buyer's email + listing URL/VIN before they pay for the $39
 * Full Risk Report. Called client-side immediately before Stripe redirect.
 *
 * 1. Inserts a row into full_risk_report_requests (or user_events fallback)
 * 2. Sends an internal alert to support@offolabs.com via Resend
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: {
    receipt_id?: string;
    email?: string;
    listing_input?: string;
    vehicle_label?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { receipt_id, email, listing_input, vehicle_label } = body;

  if (!receipt_id || !email || !listing_input) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // 1. Persist to Supabase (best-effort — use user_events if dedicated table missing)
  if (isSupabaseConfigured()) {
    try {
      await supabase.from("user_events").insert({
        event_name: "full_risk_report_intake",
        timestamp: new Date().toISOString(),
        event_data: {
          receipt_id,
          email,
          listing_input,
          vehicle_label: vehicle_label || null,
        },
      });
    } catch {
      // Non-blocking
    }
  }

  // 2. Send internal alert to support@offolabs.com
  if (isResendConfigured()) {
    const vehicle = vehicle_label || "Unknown vehicle";
    const html = `
      <h2>🚨 New Full Risk Report Request — $39</h2>
      <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Receipt ID</td><td style="padding:8px;">${receipt_id}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;color:#555;">Customer Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Vehicle</td><td style="padding:8px;">${vehicle}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;color:#555;">Listing URL / VIN</td><td style="padding:8px;word-break:break-all;">${listing_input}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Submitted At</td><td style="padding:8px;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
      </table>
      <p style="margin-top:16px;font-size:13px;color:#888;">
        The customer is being redirected to Stripe to complete payment. Reply to <strong>${email}</strong> within 48h with their PDF report.
      </p>
    `;

    await sendChecklistEmail(
      "support@offolabs.com",
      `🚨 Full Risk Report Request — ${vehicle} (${email})`,
      html
    );
  }

  return NextResponse.json({ success: true });
}
