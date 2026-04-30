/**
 * Cloudflare Turnstile Server-Side Verification
 *
 * Validates Turnstile tokens via POST to Cloudflare's siteverify endpoint.
 * Turnstile is pass/fail (not a score like reCAPTCHA v3).
 *
 * Also exports `guardTurnstile` — a shared helper that handles honeypot,
 * token verification, and event logging for any API route.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TurnstileVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

export interface TurnstileOutcome {
  passed: boolean;
  errorCodes: string[];
}

// ---------------------------------------------------------------------------
// Core verification
// ---------------------------------------------------------------------------

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(
  token: string,
  remoteip?: string
): Promise<TurnstileOutcome> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Fail open when secret key is not configured (local dev)
  if (!secretKey) {
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY not set — skipping verification");
    return { passed: true, errorCodes: [] };
  }

  try {
    const params = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteip) params.append("remoteip", remoteip);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      console.error(`[Turnstile] Verify endpoint returned ${res.status}`);
      return { passed: false, errorCodes: ["http_error"] };
    }

    const result: TurnstileVerifyResponse = await res.json();
    return {
      passed: result.success === true,
      errorCodes: result["error-codes"] || [],
    };
  } catch (err) {
    console.error("[Turnstile] Verification request failed:", err);
    // Fail closed on network error — do not allow unknown requests through
    return { passed: false, errorCodes: ["network_error"] };
  }
}

// ---------------------------------------------------------------------------
// Shared guard helper (DRYs the check across receipt + score routes)
// ---------------------------------------------------------------------------

function logBotEvent(
  eventName: "turnstile_verified" | "turnstile_blocked",
  endpoint: string,
  clientIP: string,
  data?: Record<string, unknown>
) {
  if (!isSupabaseConfigured()) return;
  supabase
    .from("user_events")
    .insert({
      event_name: eventName,
      event_data: { endpoint, ...data },
      ip_address: clientIP,
      page_path: endpoint,
      timestamp: new Date().toISOString(),
    })
    .then(() => {}, () => {}); // fire-and-forget
}

/**
 * Guard an API route with honeypot + Turnstile verification.
 *
 * Returns a `NextResponse` (403) if the request should be blocked,
 * or `null` if it passes. On pass, `turnstileToken` and `leave_this_empty`
 * are deleted from `body` so downstream code doesn't see them.
 *
 * Usage:
 * ```ts
 * const blocked = await guardTurnstile(body, clientIP, "/api/receipt");
 * if (blocked) return blocked;
 * ```
 */
export async function guardTurnstile(
  body: Record<string, unknown>,
  clientIP: string,
  endpoint: string
): Promise<NextResponse | null> {
  // 0. If Turnstile is not configured, skip entirely (fail open)
  if (!process.env.TURNSTILE_SECRET_KEY) {
    delete body.turnstileToken;
    delete body.leave_this_empty;
    return null;
  }

  // 1. Honeypot
  if (body.leave_this_empty) {
    console.warn(`[Turnstile] Honeypot triggered on ${endpoint}`);
    logBotEvent("turnstile_blocked", endpoint, clientIP, { reason: "honeypot_hit" });
    return NextResponse.json(
      { success: false, error: "Request blocked", captcha_required: true },
      { status: 403 }
    );
  }

  // 2. Token presence — fail-closed. Missing token means the Turnstile widget
  // never ran (bot, headless browser, or scripted request). Legitimate slow/mobile
  // connections will have the token by the time the user hits submit because the
  // widget runs invisibly in the background while the form is being filled.
  const token = body.turnstileToken;
  if (!token || typeof token !== "string") {
    console.warn(`[Turnstile] Token missing on ${endpoint} — blocking (fail-closed)`);
    logBotEvent("turnstile_blocked", endpoint, clientIP, { reason: "turnstile_missing", action: "blocked_failclosed" });
    return NextResponse.json(
      { success: false, error: "Please complete the security check", captcha_required: true },
      { status: 403 }
    );
  }

  // 3. Verify with Cloudflare
  const result = await verifyTurnstileToken(token, clientIP);
  if (!result.passed) {
    console.warn(`[Turnstile] Verification failed on ${endpoint}:`, result.errorCodes);
    logBotEvent("turnstile_blocked", endpoint, clientIP, {
      reason: "turnstile_invalid",
      cf_errors: result.errorCodes,
    });
    return NextResponse.json(
      { success: false, error: "Verification failed", captcha_required: true },
      { status: 403 }
    );
  }

  // 4. Passed — clean up body and log
  logBotEvent("turnstile_verified", endpoint, clientIP);
  delete body.turnstileToken;
  delete body.leave_this_empty;

  return null;
}
