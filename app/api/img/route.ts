/**
 * GET /api/img?url=<encoded-url>
 *
 * Server-side image proxy. Fetches an external image and streams it back,
 * stripping the Referer header so CDNs with hotlink protection don't block us.
 *
 * Security: blocks private IPs, localhost, and non-HTTPS URLs.
 * Only proxies responses with image/* content-type.
 */

import { NextRequest, NextResponse } from "next/server";

// Regex to block private/internal IP ranges and localhost — prevents SSRF.
const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1|fc00:|fd[0-9a-f]{2}:)/i;

// Always-allowed internal domains (Supabase storage)
const INTERNAL_ALLOWED = ["acbxnfhcadvrjvftmbci.supabase.co"];

function isSafeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    // Must be HTTPS (or HTTP for internal dev — blocked by BLOCKED_HOSTS anyway)
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname;
    // Block private/loopback ranges
    if (BLOCKED_HOSTS.test(host)) return false;
    // Must have a real TLD (at least one dot)
    if (!host.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  const decoded = decodeURIComponent(url);

  if (!isSafeUrl(decoded)) {
    return new NextResponse("URL not allowed", { status: 403 });
  }

  try {
    const res = await fetch(decoded, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/avif,image/*,*/*",
        // Explicitly clear Referer — Akamai and dealer CDNs block hotlinks by Referer.
        "Referer": "",
      },
    });

    if (!res.ok) {
      return new NextResponse("Upstream error", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 400 });
    }

    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
