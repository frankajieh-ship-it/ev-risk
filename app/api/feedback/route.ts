/**
 * Feedback API
 *
 * POST /api/feedback
 * Stores user feedback for reports
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.POSTGRES_URL!);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportId, rating, feedbackText, wouldRecommend } = body;

    // Validate required fields
    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Store feedback in database
    await sql`
      INSERT INTO feedback (
        report_id,
        rating,
        feedback_text,
        would_recommend
      )
      VALUES (
        ${reportId},
        ${rating || null},
        ${feedbackText || null},
        ${wouldRecommend !== undefined ? wouldRecommend : null}
      )
    `;

    console.log(`✅ Feedback received for report ${reportId}:`, {
      rating,
      wouldRecommend,
      hasText: !!feedbackText,
    });

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    console.error("Feedback submission error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: "Failed to submit feedback",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
