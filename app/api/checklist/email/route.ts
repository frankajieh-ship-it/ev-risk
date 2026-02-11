/**
 * Email Capture API
 *
 * POST /api/checklist/email
 * Stores email with attribution context in checklist_email_captures table.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { email, attribution, persistent_session_id } = body;

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "Valid email required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("checklist_email_captures").insert({
      email: email.toLowerCase().trim(),
      attribution: attribution || null,
      persistent_session_id: persistent_session_id || null,
      page_source: attribution?.page_source || null,
    });

    if (error) {
      // Unique constraint violation — already subscribed
      if (error.code === "23505") {
        return NextResponse.json({ success: true, already_subscribed: true });
      }
      console.error("Email capture insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email capture error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
