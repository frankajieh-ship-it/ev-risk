/**
 * Email Nudge Enrollment
 *
 * POST /api/email/nudge/enroll
 * Enrolls a user in the 7-day email nudge sequence.
 *
 * Called after EVFit completion or receipt generation when the user
 * provides their email address.
 *
 * Idempotent — safe to call multiple times for the same email + trigger.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { email, anon_id, trigger_event, trigger_id, metadata } = body;

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
  }

  if (!trigger_event || !["receipt_generated", "evfit_completed"].includes(trigger_event)) {
    return NextResponse.json({ success: false, error: "Valid trigger_event required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Upsert into checklist_email_captures to keep the email list unified
    await supabase
      .from("checklist_email_captures")
      .upsert(
        {
          email: normalizedEmail,
          anon_id: anon_id || null,
          funnel_stage: trigger_event === "evfit_completed" ? "evfit_results" : "receipt_generated",
          page_source: trigger_event === "evfit_completed" ? "/routine/results" : "/receipt",
        },
        { onConflict: "email", ignoreDuplicates: false }
      );

    // 2. Enroll in nudge sequence (idempotent — ignore conflict on duplicate enrollment)
    const { error } = await supabase
      .from("email_sequences")
      .insert({
        email: normalizedEmail,
        anon_id: anon_id || null,
        trigger_event,
        trigger_id: trigger_id || null,
        metadata: metadata || null,
      });

    // Unique constraint violation = already enrolled — treat as success
    if (error && error.code !== "23505") {
      console.error("[Nudge Enroll] DB error:", error);
      return NextResponse.json({ success: false, error: "Failed to enroll" }, { status: 500 });
    }

    return NextResponse.json({ success: true, enrolled: true });
  } catch (err) {
    console.error("[Nudge Enroll] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Enrollment failed" },
      { status: 500 }
    );
  }
}
