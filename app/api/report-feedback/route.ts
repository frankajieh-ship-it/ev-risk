/**
 * Report Feedback API
 *
 * POST /api/report-feedback
 * Saves report-specific feedback (rating, text, would recommend)
 * This populates the report_feedback table for admin analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL!);

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

  if (current.count >= 5) {
    // Max 5 submissions per minute
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
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[Report Feedback API] Parse error:", parseError);
      return NextResponse.json(
        { success: false, error: "Invalid request format" },
        { status: 400 }
      );
    }

    const { reportId, rating, feedbackText, wouldRecommend } = body;

    // Validate rating (required, 1-5)
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    // Validate reportId format if provided (should be UUID-like or null)
    let validReportId = null;
    if (reportId && typeof reportId === "string") {
      // Basic UUID format check
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(reportId)) {
        validReportId = reportId;
      }
    }

    // Sanitize feedback text (limit length, strip dangerous content)
    let sanitizedText = null;
    if (feedbackText && typeof feedbackText === "string") {
      sanitizedText = feedbackText
        .slice(0, 2000) // Max 2000 chars
        .replace(/<[^>]*>/g, ""); // Strip HTML tags
    }

    // Log submission
    console.log("[Report Feedback API] Saving feedback:", {
      reportId: validReportId ? "present" : "null",
      rating,
      hasText: !!sanitizedText,
      wouldRecommend,
      ip: clientIP,
    });

    // Insert into report_feedback table
    const result = await sql`
      INSERT INTO report_feedback (
        report_id,
        rating,
        feedback_text,
        would_recommend
      ) VALUES (
        ${validReportId},
        ${rating},
        ${sanitizedText},
        ${wouldRecommend ?? null}
      )
      RETURNING id, created_at
    `;

    console.log("[Report Feedback API] Feedback saved successfully:", result[0].id);

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback!",
      feedbackId: result[0].id,
    });
  } catch (error) {
    console.error("[Report Feedback API] Error:", error);

    // Check if it's a database error (table doesn't exist)
    if (error instanceof Error && error.message.includes("relation")) {
      console.error("[Report Feedback API] Table does not exist - run migration");
      return NextResponse.json(
        {
          success: false,
          error: "Feedback system not initialized. Please contact support.",
        },
        { status: 503 }
      );
    }

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
