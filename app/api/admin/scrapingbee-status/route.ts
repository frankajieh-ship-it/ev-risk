/**
 * GET /api/admin/scrapingbee-status
 *
 * Returns ScrapingBee account info: credit balance and key validity.
 * Uses one free (non-JS-rendered) request to httpbin to read the
 * Spb-Remaining-Api-Credits response header from ScrapingBee.
 */

import { NextRequest, NextResponse } from "next/server";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const SCRAPINGBEE_KEY = process.env.SCRAPINGBEE_API_KEY;

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const adminKey = request.headers.get("x-admin-key") || request.nextUrl.searchParams.get("adminKey");
  if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SCRAPINGBEE_KEY) {
    return NextResponse.json({
      key_valid: false,
      credits_remaining: null,
      error: "SCRAPINGBEE_API_KEY env var is not set",
    }, { status: 200 });
  }

  try {
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_KEY,
      url: "https://httpbin.org/get",
      render_js: "false",
    });

    const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`, {
      signal: AbortSignal.timeout(15000),
    });

    const creditsHeader = res.headers.get("spb-remaining-api-credits");
    const usedHeader = res.headers.get("spb-used-api-credits");
    const credits = creditsHeader !== null ? parseInt(creditsHeader) : null;
    const used = usedHeader !== null ? parseInt(usedHeader) : null;

    if (res.status === 401) {
      return NextResponse.json({ key_valid: false, credits_remaining: null, error: "Invalid API key (401)" });
    }
    if (res.status === 402) {
      return NextResponse.json({ key_valid: true, credits_remaining: 0, error: "Credits exhausted (402)" });
    }

    return NextResponse.json({
      key_valid: res.ok,
      credits_remaining: credits,
      credits_used: used,
      http_status: res.status,
    });
  } catch (err) {
    return NextResponse.json({
      key_valid: null,
      credits_remaining: null,
      error: err instanceof Error ? err.message : "Request failed",
    }, { status: 200 });
  }
}
