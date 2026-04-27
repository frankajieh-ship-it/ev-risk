/**
 * Proxy Fetch API
 *
 * Fetches external URLs through a server-side proxy to avoid CORS
 * and bot detection issues with car listing sites.
 * Uses direct fetch with user-agent rotation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP, extractionRateLimiter } from "@/lib/rate-limiter";

// User agent rotation — keep current with latest stable browser versions
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export const maxDuration = 40;

export async function POST(request: NextRequest) {
  try {
    // Admin batch jobs (deals-extract, ingest) bypass the rate limiter
    const adminHeader = request.headers.get("x-admin-key");
    const isAdminBypass = ADMIN_KEY && adminHeader === ADMIN_KEY;

    if (!isAdminBypass) {
      const clientIP = getClientIP(request);
      const rateLimit = extractionRateLimiter.check(clientIP);

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            resetAt: new Date(rateLimit.resetAt).toISOString(),
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const { url, timeout = 10000 } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Security: only allow known car listing domains
    const allowedDomains = [
      'autotrader.com',
      'cargurus.com',
      'cars.com',
      'carvana.com',
      'carfax.com',
      'kbb.com',
      'truecar.com',
      'edmunds.com',
      'vroom.com',
      'carmax.com',
      'autotempest.com',
      'hemmings.com',
      'facebook.com',
      'copart.com',
      'iaai.com',
    ];

    const isAllowed = allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain));

    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: 'Domain not allowed. Only car listing sites are supported.' },
        { status: 403 }
      );
    }

    console.log('[Proxy Fetch] Fetching URL:', url.substring(0, 100));

    // Sites that need JS rendering (client-side rendered, bot-protected)
    const needsJsRender = ['cargurus.com', 'autotrader.com', 'cars.com'].some(
      d => parsedUrl.hostname.includes(d)
    );

    const NIMBLEWAY_KEY = process.env.NIMBLEWAY_API_KEY;

    // --- Nimbleway path for JS-rendered sites ---
    if (needsJsRender && NIMBLEWAY_KEY) {
      const nmController = new AbortController();
      const nmTimeoutId = setTimeout(() => nmController.abort(), 30000);
      try {
        console.log('[Proxy Fetch] Trying Nimbleway:', url.substring(0, 80));
        const nmResponse = await fetch('https://sdk.nimbleway.com/v1/extract', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NIMBLEWAY_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, render: true, country: 'US', locale: 'en-US' }),
          signal: nmController.signal,
        });
        clearTimeout(nmTimeoutId);

        console.log('[Proxy Fetch] Nimbleway status:', nmResponse.status);

        if (nmResponse.ok) {
          // Nimbleway returns JSON: { status, status_code, data: { html } }
          const nmJson = await nmResponse.json() as { status?: string; status_code?: number; data?: { html?: string } };
          const html = nmJson?.data?.html ?? '';
          const nmStatusCode = nmJson?.status_code ?? 200;
          console.log('[Proxy Fetch] Nimbleway html length:', html.length, 'status_code:', nmStatusCode);

          // CarGurus returns BLACKOUT_TEXAS shell (~2755 bytes) for some routes —
          // still usable since og:title / og:description are populated on /details/ URLs.
          // Only treat as blocked if truly empty or has CAPTCHA.
          const lowerHtml = html.toLowerCase();
          const isBlocked =
            lowerHtml.includes('id="captcha"') ||
            lowerHtml.includes('just a moment') ||
            lowerHtml.includes('challenge-platform') ||
            html.length < 500;

          if (!isBlocked) {
            return NextResponse.json({
              success: true,
              html,
              contentLength: html.length,
              status: nmStatusCode,
              fetchMethod: 'nimbleway',
              headers: { 'content-type': 'text/html' },
            });
          }
          console.warn('[Proxy Fetch] Nimbleway returned blocked/empty page, length:', html.length);
        } else {
          const errText = await nmResponse.text().catch(() => '');
          console.warn('[Proxy Fetch] Nimbleway error', nmResponse.status, errText.substring(0, 200));
          // JS-render domains won't work via direct fetch either — fail fast
          return NextResponse.json({
            success: false,
            error: `Nimbleway error ${nmResponse.status} — site requires JS rendering`,
            blocked: true,
            nm_status: nmResponse.status,
          }, { status: 422 });
        }
      } catch (nmErr) {
        clearTimeout(nmTimeoutId);
        const msg = nmErr instanceof Error ? nmErr.message : String(nmErr);
        console.warn('[Proxy Fetch] Nimbleway threw:', msg);
        // Fall through to direct fetch if Nimbleway itself is unreachable
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.google.com/',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
          'DNT': '1',
          'Connection': 'keep-alive',
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      console.log('[Proxy Fetch] Response status:', response.status, 'for', parsedUrl.hostname);

      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch URL (${response.status} ${response.statusText})`,
            status: response.status,
          },
          { status: response.status }
        );
      }

      const html = await response.text();
      console.log('[Proxy Fetch] HTML length:', html.length);

      const lowerHtml = html.toLowerCase();

      // Cookie consent wall — page is not useful content
      const isCookieWall =
        (lowerHtml.includes('cookie') && lowerHtml.includes('consent') && html.length < 15000) ||
        lowerHtml.includes('cookiebanner') ||
        lowerHtml.includes('cookie-banner') ||
        lowerHtml.includes('cookie_consent') ||
        (lowerHtml.includes('accept') && lowerHtml.includes('cookie') && !lowerHtml.includes('lot-') && html.length < 10000);

      if (isCookieWall) {
        console.warn('[Proxy Fetch] Cookie consent wall detected');
        return NextResponse.json({
          success: false,
          error: 'cookie_wall',
          blocked: true,
          cookie_wall: true,
        }, { status: 422 });
      }

      // Bot/CAPTCHA wall
      const isBlocked =
        lowerHtml.includes('id="captcha"') ||
        lowerHtml.includes('class="captcha') ||
        lowerHtml.includes('bot detection') ||
        lowerHtml.includes('just a moment') ||
        lowerHtml.includes('challenge-platform') ||
        lowerHtml.includes('access denied') ||
        html.includes('Autotrader - page unavailable') ||
        html.length < 2000;

      if (isBlocked) {
        console.warn('[Proxy Fetch] Bot protection detected');
        return NextResponse.json({
          success: false,
          error: 'blocked',
          blocked: true,
        }, { status: 403 });
      }

      return NextResponse.json({
        success: true,
        html,
        contentLength: html.length,
        status: response.status,
        fetchMethod: 'direct',
        headers: { 'content-type': response.headers.get('content-type') },
      });

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Proxy Fetch] Request timeout');
      return NextResponse.json(
        { success: false, error: 'Request timeout' },
        { status: 504 }
      );
    }

    console.error('[Proxy Fetch] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
