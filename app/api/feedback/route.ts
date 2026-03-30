/**
 * Feedback Submission API
 *
 * POST /api/feedback
 * Saves user feedback to database and notifies admin via email.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sendChecklistEmail } from "@/lib/resend";
import { guardTurnstile } from "@/lib/turnstile";

// Rate limiting map (in-memory, per instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);

  // Reset if expired
  if (limit && now > limit.resetAt) {
    rateLimitMap.delete(ip);
  }

  const current = rateLimitMap.get(ip) || { count: 0, resetAt: now + 60000 }; // 1 minute window

  if (current.count >= 3) {
    // Max 3 submissions per minute
    return { allowed: false, resetAt: current.resetAt };
  }

  current.count++;
  rateLimitMap.set(ip, current);
  return { allowed: true, resetAt: current.resetAt };
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0] || realIP || "unknown";
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    // Get client IP
    const clientIP = getClientIP(request);

    // Rate limiting
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again in a minute.",
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[Feedback API] Parse error:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid request format" },
        { status: 400 }
      );
    }

    // Turnstile bot protection (honeypot + token verification)
    const blocked = await guardTurnstile(body, clientIP, "/api/feedback");
    if (blocked) return blocked;

    const { email, feedbackType, helpful, missing, additionalData, comments, name } =
      body as Record<string, string | undefined>;

    // Validate required field
    if (!feedbackType) {
      return NextResponse.json(
        { success: false, error: "Feedback type is required" },
        { status: 400 }
      );
    }

    // Validate feedback type
    const validTypes = ["general", "bug", "feature", "accuracy", "ux", "question", "success_story"];
    if (!validTypes.includes(feedbackType)) {
      return NextResponse.json(
        { success: false, error: "Invalid feedback type" },
        { status: 400 }
      );
    }

    // Optional: Validate email format if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { success: false, error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    // Get user agent
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Insert feedback into database
    console.log("[Feedback API] Saving feedback:", {
      feedbackType,
      hasEmail: !!email,
      ip: clientIP,
    });

    const { data, error } = await supabase
      .from("feedback")
      .insert({
        email: email || null,
        feedback_type: feedbackType,
        helpful: helpful || null,
        missing: missing || null,
        additional_data: additionalData || null,
        comments: comments || null,
        user_agent: userAgent,
        ip_address: clientIP,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[Feedback API] Supabase error:", error);

      if (error.message.includes("relation")) {
        return NextResponse.json(
          {
            success: false,
            error: "Feedback system not initialized. Please contact support.",
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log("[Feedback API] Feedback saved successfully:", data.id);

    // ── Admin notification email (fire-and-forget) ─────────────────────────
    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (adminEmail) {
      const typeLabel = feedbackType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const html = `
        <h2 style="margin:0 0 12px;font-family:sans-serif">New ${typeLabel} via Contact Form</h2>
        <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;width:100%">
          <tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap">Type</td><td style="padding:6px 0"><strong>${typeLabel}</strong></td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">From</td><td style="padding:6px 0">${email || "(no email)"}</td></tr>
          ${name ? `<tr><td style="padding:6px 12px 6px 0;color:#666">Name</td><td style="padding:6px 0">${name}</td></tr>` : ""}
          <tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top">Message</td><td style="padding:6px 0;white-space:pre-wrap">${(comments || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">ID</td><td style="padding:6px 0;color:#999;font-size:12px">${data.id}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666">IP</td><td style="padding:6px 0;color:#999;font-size:12px">${clientIP}</td></tr>
        </table>
      `;
      sendChecklistEmail(adminEmail, `[OFFO] ${typeLabel} from ${email || "anonymous"}`, html).catch(
        (err) => console.error("[Feedback API] Admin notify failed:", err)
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback!",
      feedbackId: data.id,
    });
  } catch (error) {
    console.error("[Feedback API] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit feedback",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve feedback (admin only - requires API key)
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    // Check for admin API key
    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type");

    // Build query
    let query = supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq("feedback_type", type);
    }

    const { data: feedback, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback,
      count: feedback?.length || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Feedback API] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve feedback",
      },
      { status: 500 }
    );
  }
}
