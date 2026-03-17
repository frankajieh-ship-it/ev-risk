/**
 * Email Nudge Unsubscribe
 *
 * GET /api/email/nudge/unsubscribe?token=<base64(email)>
 * One-click unsubscribe from the nudge sequence.
 *
 * Sets unsubscribed=true on the email_sequences row.
 * Returns a plain HTML confirmation page.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const html = (message: string, isError = false) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>OFFO — Unsubscribe</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:80px auto;padding:32px 24px;background:white;border-radius:12px;border:1px solid #e5e7eb;text-align:center;">
    <div style="font-size:32px;margin-bottom:16px;">${isError ? "⚠️" : "✓"}</div>
    <h1 style="font-size:18px;color:#1e293b;margin:0 0 8px;">${isError ? "Something went wrong" : "You've been unsubscribed"}</h1>
    <p style="font-size:14px;color:#64748b;margin:0 0 24px;">${message}</p>
    <a href="https://offolab.com" style="font-size:13px;color:#4f46e5;text-decoration:none;">← Back to OFFO</a>
  </div>
</body>
</html>`;

  if (!token) {
    return new NextResponse(html("Invalid unsubscribe link.", true), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  let email: string;
  try {
    email = Buffer.from(decodeURIComponent(token), "base64").toString("utf-8");
    if (!email || !email.includes("@")) throw new Error("Invalid");
  } catch {
    return new NextResponse(html("Invalid unsubscribe link.", true), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!isSupabaseConfigured()) {
    return new NextResponse(html("Could not process your request. Please try again later.", true), {
      status: 503,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    await supabase
      .from("email_sequences")
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .eq("email", email.trim().toLowerCase())
      .eq("unsubscribed", false);

    return new NextResponse(
      html("You won't receive any more nudge emails from OFFO. You can always re-run a fit check at offolab.com."),
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("[Nudge Unsubscribe] Error:", err);
    return new NextResponse(html("Could not process your request. Please try again later.", true), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
