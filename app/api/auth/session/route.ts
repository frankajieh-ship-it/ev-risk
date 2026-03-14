/**
 * Auth Session API
 * GET /api/auth/session - Get current session info
 * POST /api/auth/session - Send magic link (accepts email)
 *
 * Handles magic link authentication flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { audit } from "@/lib/audit-logger";
import { getClientIP } from "@/lib/rate-limiter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create server-side Supabase client
function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * GET - Get current session info
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { authenticated: false, error: "Auth not configured" },
      { status: 200 }
    );
  }

  // Get access token from cookie or header
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const ip = getClientIP(req);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      audit({ actor_type: "anon", action: "auth.session_invalid", result: "denied", ip });
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    audit({ actor_type: "user", actor_id: user.id, action: "auth.session_valid", result: "ok", ip });

    // Get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("email, scenarios_saved, preferred_region, created_at")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        ...profile,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

/**
 * POST - Send magic link email
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Auth not configured" },
      { status: 503 }
    );
  }

  const ip = getClientIP(req);

  try {
    const body = await req.json();
    const { email, session_id } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get redirect URL — prefer explicit env var over request origin
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "http://localhost:3000";
    const redirectTo = `${siteUrl}/auth/callback`;

    // Send magic link
    const { error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("Magic link error:", error);
      audit({
        actor_type: "anon",
        action: "auth.otp_send_fail",
        result: "error",
        ip,
        metadata: { error_code: error.status },
      });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    // Log domain only — never the full email address
    const emailDomain = email.split("@")[1] ?? "unknown";
    audit({
      actor_type: "anon",
      action: "auth.otp_sent",
      result: "ok",
      ip,
      metadata: { email_domain: emailDomain },
    });

    // Optionally store session_id association for post-login scenario save
    if (session_id) {
      // Store in a temporary table or cache for linking after auth
      // For MVP, we'll handle this client-side via localStorage
    }

    return NextResponse.json({
      success: true,
      message: "Magic link sent! Check your email.",
    });
  } catch (error) {
    console.error("Auth session error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send magic link",
      },
      { status: 500 }
    );
  }
}
