/**
 * GET /api/img?url=<encoded-url>
 *
 * Server-side image proxy. Fetches an external image and streams it back,
 * stripping the Referer header so CDNs with hotlink protection don't block us.
 *
 * Only allows known safe image CDN hostnames to prevent open-proxy abuse.
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "auto.dev",
  "img.autodev.com",
  "images.autodev.com",
  "photos.autodev.com",
  "cargurus.com",  // covers cimg, static, media, img, cdn and any future subdomains
  "pictures.dealer.com",
  "photos.dealer.com",
  "img.dealer.com",
  "media.dealerire.com",
  // Marketcheck dealer CDN hosts
  "dealerinspire.com",
  "dealereprocess.com",
  "autotrader.com",
  "cars.com",
  "dealer.com",
  "dealersocket.com",
  "homenetiol.com",
  "invisioncarsites.com",
  "media.dealerwebsites.com",
  "photos.zyte.com",
  "i.ebayimg.com",
  "s3.amazonaws.com",
  "cloudfront.net",
  "imagedelivery.net",
  "copart.com",
  "cs.copart.com",
  "img.iaai.com",
  "images.iaai.com",
  "upload.wikimedia.org",
  "acbxnfhcadvrjvftmbci.supabase.co",
]);

function isAllowedHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    for (const allowed of ALLOWED_HOSTS) {
      if (hostname === allowed || hostname.endsWith(`.${allowed}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  const decoded = decodeURIComponent(url);
  if (!isAllowedHost(decoded)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    const res = await fetch(decoded, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OFFO/1.0)",
        "Accept": "image/webp,image/avif,image/*,*/*",
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
        "Cache-Control": "no-store",
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
