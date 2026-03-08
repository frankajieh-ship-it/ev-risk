import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.googleadservices.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "frame-src https://js.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com https://td.doubleclick.net",
      "connect-src 'self' https://api.stripe.com https://*.supabase.co https://*.nsvcs.net https://vpic.nhtsa.dot.gov https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://googleads.g.doubleclick.net https://www.googleadservices.com https://www.google.com https://api.openweathermap.org https://developer.nrel.gov",
    ].join("; ")
  );

  // HSTS - Force HTTPS (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  // Geo-detect region via Netlify x-country header (ISO 3166)
  // Sets offo_region cookie for UK visitors on first visit (not httpOnly — client reads it)
  if (!request.cookies.get("offo_region")) {
    const country = request.headers.get("x-country");
    if (country === "GB") {
      response.cookies.set("offo_region", "UK", {
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
      });
    }
  }

  // Receipt session cookie — httpOnly, server-side rate limiting anchor
  if (!request.cookies.get("receipt_session")) {
    const sessionId = `rs_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    response.cookies.set("receipt_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
  }

  // Protected routes (/workspace, /dealer) are guarded client-side by
  // their layouts via useAuth(). The Supabase JS client stores sessions
  // in localStorage (not cookies), so middleware can't check auth state.

  // Admin Panel IP Restriction
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const allowedIPs = (process.env.ADMIN_ALLOWED_IPS || "").split(",").filter(Boolean);

    if (allowedIPs.length > 0) {
      // Get client IP from various headers
      const forwarded = request.headers.get("x-forwarded-for");
      const realIP = request.headers.get("x-real-ip");
      const clientIP = forwarded?.split(",")[0] || realIP || "unknown";

      if (!allowedIPs.includes(clientIP.trim())) {
        console.warn(`Admin access denied for IP: ${clientIP}`);
        return new NextResponse("Access Denied", { status: 403 });
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/stripe/webhook (needs raw body)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
