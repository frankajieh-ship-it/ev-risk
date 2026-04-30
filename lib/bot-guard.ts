/**
 * Bot Guard — User-Agent Filtering
 *
 * Blocks requests from headless scrapers and script clients.
 * All real browsers send a UA starting with "Mozilla/".
 * Known legitimate crawlers (Googlebot, Bingbot) are explicitly allowed.
 */

import { NextResponse } from "next/server";

const BLOCKED_UA_PATTERNS = [
  /^python-requests\//i,
  /^curl\//i,
  /^Go-http-client\//i,
  /^Java\//i,
  /^wget\//i,
  /libwww/i,
  /[Ss]crapy/,
  /^okhttp\//i,
  /^axios\//i,
  /^node-fetch\//i,
  /^undici\//i,
  /^got\//i,
];

const ALLOWED_CRAWLERS = ["Googlebot", "Bingbot", "AhrefsBot", "YandexBot", "DuckDuckBot"];

function block403(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Unsupported browser" },
    { status: 403 }
  );
}

/**
 * Returns a 403 NextResponse if the request's User-Agent looks like a bot or
 * scripted client, or null if it should be allowed through.
 */
export function checkUserAgent(request: Request): NextResponse | null {
  const ua = request.headers.get("user-agent") ?? "";

  if (!ua) return block403();

  // Explicit allowlist: well-known crawlers that are legitimate
  if (ALLOWED_CRAWLERS.some((c) => ua.includes(c))) return null;

  // Block known script/headless clients
  if (BLOCKED_UA_PATTERNS.some((p) => p.test(ua))) return block403();

  // All real browsers (Chrome, Firefox, Safari, Edge, mobile variants) include "Mozilla/"
  if (!ua.includes("Mozilla/")) return block403();

  return null;
}
