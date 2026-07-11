/**
 * Email Capture API
 *
 * POST /api/checklist/email
 * Stores email with attribution context + UTM fields + funnel stage
 * in checklist_email_captures table.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
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
    const { email, attribution, persistent_session_id, anon_id, source, trigger_id } = body;

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "Valid email required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Extract individual UTM fields from attribution blob
    const utmSource = attribution?.utm_source || null;
    const utmMedium = attribution?.utm_medium || null;
    const utmCampaign = attribution?.utm_campaign || null;
    const utmTerm = attribution?.utm_term || null;
    const utmContent = attribution?.utm_content || null;

    const { error } = await supabase.from("checklist_email_captures").insert({
      email: normalizedEmail,
      attribution: attribution || null,
      persistent_session_id: persistent_session_id || null,
      page_source: attribution?.page_source || null,
      anon_id: anon_id || persistent_session_id || null,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
      funnel_stage: "lead",
    });

    if (error) {
      // Unique constraint violation — already subscribed
      if (error.code === "23505") {
        // Update UTM fields if they were previously null
        await supabase
          .from("checklist_email_captures")
          .update({
            anon_id: anon_id || persistent_session_id || undefined,
            utm_source: utmSource || undefined,
            utm_medium: utmMedium || undefined,
            utm_campaign: utmCampaign || undefined,
            utm_term: utmTerm || undefined,
            utm_content: utmContent || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("email", normalizedEmail)
          .is("utm_source", null);

        // Still track the attempt for analytics
        const dupHash = createHash("sha256").update(normalizedEmail).digest("hex");
        supabase.from("user_events").insert({
          event_name: "email_capture_submitted",
          event_data: {
            email_hash: dupHash,
            source: "capture_only",
            already_subscribed: true,
          },
          anon_id: anon_id || persistent_session_id || null,
          page_path: "/api/checklist/email",
          timestamp: new Date().toISOString(),
        }).then(() => {}, () => {});

        return NextResponse.json({ success: true, already_subscribed: true });
      }
      console.error("Email capture insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save email" },
        { status: 500 }
      );
    }

    // Enroll in activation sequence (Day 1/3/7 emails via Netlify cron)
    // email_gate source uses verdict-personalized activation; others use newsletter flow
    const triggerEvent = source === "email_gate" ? "receipt_email_gate" : "newsletter_signup";
    void supabase.from("email_sequences").insert({
      email: normalizedEmail,
      anon_id: anon_id || persistent_session_id || null,
      trigger_event: triggerEvent,
      trigger_id: (source === "email_gate" && trigger_id) ? trigger_id : null,
      metadata: { source: attribution?.page_source || "unknown" },
    });

    // Track in user_events for analytics visibility
    const emailHash = createHash("sha256").update(normalizedEmail).digest("hex");
    supabase.from("user_events").insert({
      event_name: "email_capture_submitted",
      event_data: {
        email_hash: emailHash,
        source: "capture_only",
        page_source: attribution?.page_source || null,
      },
      anon_id: anon_id || persistent_session_id || null,
      page_path: "/api/checklist/email",
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email capture error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
