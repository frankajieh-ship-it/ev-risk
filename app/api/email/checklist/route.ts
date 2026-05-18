/**
 * Email Checklist Delivery API
 *
 * POST /api/email/checklist
 * Sends the receipt checklist (verdict, risk flags, must-ask questions,
 * negotiation opener) to the user's email via Resend.
 *
 * Rate limited: 5/hr per IP, 3/day per anon_id.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendChecklistEmail, isResendConfigured } from "@/lib/resend";
import { humanizeFlag } from "@/lib/receipt-rules";
import { emailFooter } from "@/lib/crm-email";
import { createHash } from "crypto";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ListingSummary = {
  year?: string | number;
  make?: string;
  model?: string;
  trim?: string;
  price?: string | number;
  mileage?: string | number;
  seller_type?: string;
};

type ReceiptData = {
  listing_summary?: ListingSummary;
  verdict?: string;
  verdict_reason?: string;
  risk_flags?: string[];
  must_answer_questions?: string[];
  inspect_first?: string[];
  negotiation_opener?: string;
};

// In-memory rate limiters (per instance)
const ipLimiter = new Map<string, { count: number; resetAt: number }>();
const anonLimiter = new Map<string, { count: number; resetAt: number }>();

function checkIpRate(ip: string): boolean {
  const now = Date.now();
  const entry = ipLimiter.get(ip);
  if (entry && now > entry.resetAt) ipLimiter.delete(ip);
  const current = ipLimiter.get(ip) || { count: 0, resetAt: now + 3600000 }; // 1hr window
  if (current.count >= 5) return false;
  current.count++;
  ipLimiter.set(ip, current);
  return true;
}

function checkAnonRate(anonId: string): boolean {
  const now = Date.now();
  const entry = anonLimiter.get(anonId);
  if (entry && now > entry.resetAt) anonLimiter.delete(anonId);
  const current = anonLimiter.get(anonId) || { count: 0, resetAt: now + 86400000 }; // 24hr window
  if (current.count >= 3) return false;
  current.count++;
  anonLimiter.set(anonId, current);
  return true;
}

function getClientIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown";
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case "GREEN": return "#238636";
    case "YELLOW": return "#d29922";
    case "RED": return "#da3633";
    default: return "#8b949e";
  }
}

function getVerdictLabel(verdict: string): string {
  switch (verdict) {
    case "GREEN": return "Clean Deal";
    case "YELLOW": return "Needs Review";
    case "RED": return "High Risk";
    default: return verdict;
  }
}

const OFFO_HEADER = `
  <div style="text-align:center;padding-bottom:24px;margin-bottom:24px;border-bottom:1px solid #21262d;">
    <span style="font-size:22px;font-weight:800;color:#00d97e;letter-spacing:-0.5px;">OFFO</span><span style="font-size:22px;font-weight:800;color:#e6edf3;letter-spacing:-0.5px;"> Lab</span>
  </div>`;

function buildChecklistHtml(receipt: ReceiptData, email: string): string {
  const summary: ListingSummary = receipt.listing_summary ?? {};
  const vehicle = [summary.year, summary.make, summary.model, summary.trim].filter(Boolean).join(" ");
  const verdict = receipt.verdict ?? "unknown";
  const verdictColor = getVerdictColor(verdict);
  const verdictLabel = getVerdictLabel(verdict);

  const riskFlagsHtml = (receipt.risk_flags || [])
    .map((flag: string) => `<li style="margin-bottom:6px;color:#c9d1d9;">${humanizeFlag(flag)}</li>`)
    .join("");

  const mustAskHtml = (receipt.must_answer_questions || [])
    .map((q: string) => `<li style="margin-bottom:6px;color:#c9d1d9;">${q}</li>`)
    .join("");

  const inspectHtml = (receipt.inspect_first || [])
    .map((item: string) => `<li style="margin-bottom:6px;color:#c9d1d9;">${item}</li>`)
    .join("");

  const price = summary.price ? `$${Number(summary.price).toLocaleString()}` : "N/A";
  const mileage = summary.mileage ? `${Number(summary.mileage).toLocaleString()} mi` : "N/A";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    ${OFFO_HEADER}

    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:20px;color:#e6edf3;margin:0 0 4px;">Your OFFO Checklist</h1>
      <p style="font-size:14px;color:#8b949e;margin:0;">${vehicle || "Vehicle"} — ${price}</p>
    </div>

    <!-- Verdict -->
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:2px solid ${verdictColor};">
      <div style="text-align:center;">
        <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:700;color:white;background:${verdictColor};">
          ${verdictLabel}
        </span>
        <p style="font-size:14px;color:#c9d1d9;margin:12px 0 0;">${receipt.verdict_reason || ""}</p>
      </div>
    </div>

    <!-- Risk Flags -->
    ${riskFlagsHtml ? `
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <h2 style="font-size:16px;color:#f87171;margin:0 0 12px;">Risk Flags</h2>
      <ul style="margin:0;padding-left:20px;font-size:14px;">${riskFlagsHtml}</ul>
    </div>` : ""}

    <!-- Must-Ask Questions -->
    ${mustAskHtml ? `
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <h2 style="font-size:16px;color:#e6edf3;margin:0 0 12px;">Must-Ask Questions</h2>
      <ol style="margin:0;padding-left:20px;font-size:14px;">${mustAskHtml}</ol>
    </div>` : ""}

    <!-- Inspect First -->
    ${inspectHtml ? `
    <div style="background:#161b22;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #30363d;">
      <h2 style="font-size:16px;color:#e6edf3;margin:0 0 12px;">Inspect First</h2>
      <ol style="margin:0;padding-left:20px;font-size:14px;">${inspectHtml}</ol>
    </div>` : ""}

    <!-- Negotiation Opener -->
    ${receipt.negotiation_opener ? `
    <div style="background:rgba(0,217,126,0.08);border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid rgba(0,217,126,0.2);">
      <h2 style="font-size:16px;color:#86efac;margin:0 0 8px;">Seller Message</h2>
      <p style="font-size:14px;color:#c9d1d9;margin:0;font-style:italic;">"${receipt.negotiation_opener}"</p>
    </div>` : ""}

    <!-- Quick Stats -->
    <div style="background:#161b22;border-radius:12px;padding:16px;margin-bottom:24px;border:1px solid #30363d;">
      <table style="width:100%;font-size:13px;" cellpadding="4">
        <tr><td style="color:#8b949e;">Price</td><td style="text-align:right;font-weight:600;color:#e6edf3;">${price}</td></tr>
        <tr><td style="color:#8b949e;">Mileage</td><td style="text-align:right;font-weight:600;color:#e6edf3;">${mileage}</td></tr>
        ${summary.seller_type ? `<tr><td style="color:#8b949e;">Seller</td><td style="text-align:right;font-weight:600;color:#e6edf3;">${summary.seller_type}</td></tr>` : ""}
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;padding-top:16px;border-top:1px solid #21262d;margin-bottom:24px;">
      <a href="https://offolab.com/receipt" style="display:inline-block;padding:13px 28px;background:#00d97e;color:#0d1117;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">Analyze another listing →</a>
    </div>

    ${emailFooter(email, "activation")}
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  if (!isResendConfigured()) {
    return NextResponse.json(
      { success: false, error: "Email service not configured" },
      { status: 503 }
    );
  }

  const clientIP = getClientIP(req);

  // Rate limit by IP
  if (!checkIpRate(clientIP)) {
    return NextResponse.json(
      { success: false, error: "Too many email requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: { email?: string; receipt_id?: string; anon_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { email, receipt_id, anon_id } = body;

  // Validate email
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { success: false, error: "Valid email required" },
      { status: 400 }
    );
  }

  // Validate receipt_id
  if (!receipt_id || typeof receipt_id !== "string") {
    return NextResponse.json(
      { success: false, error: "receipt_id required" },
      { status: 400 }
    );
  }

  // Rate limit by anon_id
  if (anon_id && !checkAnonRate(anon_id)) {
    return NextResponse.json(
      { success: false, error: "Daily email limit reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  try {
    // Fetch receipt data from DB
    let receiptData: ReceiptData | null = null;

    if (isSupabaseConfigured()) {
      const { data } = await supabase
        .from("receipts")
        .select("output_json")
        .eq("id", receipt_id)
        .single();

      if (data?.output_json) {
        receiptData = data.output_json;
      }
    }

    if (!receiptData) {
      return NextResponse.json(
        { success: false, error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Build and send email
    const summary = receiptData.listing_summary || {};
    const vehicle = [summary.year, summary.make, summary.model].filter(Boolean).join(" ");
    const subject = `Your OFFO Checklist — ${vehicle || "Vehicle Receipt"}`;
    const html = buildChecklistHtml(receiptData, email.trim());

    const result = await sendChecklistEmail(email.trim(), subject, html);

    // Log delivery to DB
    if (isSupabaseConfigured()) {
      try {
        await supabase.from("email_checklist_deliveries").insert({
          scenario_type: "receipt",
          scenario_id: receipt_id,
          email_hash: hashEmail(email),
          delivery_status: result.success ? "sent" : "failed",
          provider_message_id: result.messageId || null,
        });
      } catch {
        // Non-critical — don't fail the request
      }

      // Track in user_events for summary builder visibility
      const eventName = result.success ? "email_checklist_sent" : "email_checklist_failed";
      try {
        await supabase.from("user_events").insert({
          event_name: eventName,
          event_data: {
            receipt_id,
            email_hash: hashEmail(email),
            ...(result.error ? { error: result.error } : {}),
          },
          anon_id: anon_id || null,
          ip_address: clientIP,
          page_path: "/api/email/checklist",
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error("[Email Checklist] Failed to track event:", e);
      }
    }

    if (!result.success) {
      console.error("[Email Checklist API] Resend failed:", result.error);
      return NextResponse.json(
        { success: false, error: result.error || "Failed to send email. Please try again." },
        { status: 500 }
      );
    }

    // Enroll in activation sequence (Day 1/3/7 emails via Netlify cron)
    if (isSupabaseConfigured()) {
      const normalizedEmail = email.trim().toLowerCase();
      const vehicle = [summary.year, summary.make, summary.model].filter(Boolean).join(" ");

      void supabase.from("email_sequences").insert({
        email: normalizedEmail,
        anon_id: anon_id || null,
        trigger_event: "receipt_generated",
        trigger_id: receipt_id,
        metadata: { vehicle, verdict: receiptData.verdict },
      });

      void supabase.from("checklist_email_captures").upsert({
        email: normalizedEmail,
        anon_id: anon_id || null,
        funnel_stage: "receipt_generated",
        page_source: "/receipt",
      }, { onConflict: "email", ignoreDuplicates: false });
    }

    return NextResponse.json({
      success: true,
      message: "Checklist sent! Check your inbox.",
    });
  } catch (err) {
    console.error("[Email Checklist API] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
