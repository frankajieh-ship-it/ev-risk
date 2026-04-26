/**
 * Proxy Fetch API
 *
 * Fetches external URLs through a server-side proxy to avoid CORS
 * and bot detection issues with car listing sites
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

// Must be long enough for ScrapingBee JS-render (CarGurus/AutoTrader need 15-25s)
export const maxDuration = 45;

export async function POST(request: NextRequest) {
  try {
    // Admin batch jobs (deals-extract, ingest) bypass the rate limiter
    const adminHeader = request.headers.get("x-admin-key");
    const isAdminBypass = ADMIN_KEY && adminHeader === ADMIN_KEY;

    if (!isAdminBypass) {
      // Rate limiting for regular user requests
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

    // Parse request body
    const body = await request.json();
    // Default 30s — ScrapingBee needs 15-25s for JS-rendered sites (CarGurus, AutoTrader)
    const { url, timeout = 30000 } = body;

    // Validate URL
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

    // Security: Only allow known car listing domains
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

    const isAllowed = allowedDomains.some(domain =>
      parsedUrl.hostname.endsWith(domain)
    );

    if (!isAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Domain not allowed. Only car listing sites are supported.'
        },
        { status: 403 }
      );
    }

    console.log('[Proxy Fetch] Fetching URL:', url);

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Sites that need JS rendering (client-side rendered, bot-protected)
    const needsJsRender = ['cargurus.com', 'autotrader.com', 'cars.com'].some(
      d => parsedUrl.hostname.includes(d)
    );

    try {
      // --- ScrapingBee path (when API key is configured) ---
      const SCRAPINGBEE_KEY = process.env.SCRAPINGBEE_API_KEY;
      if (SCRAPINGBEE_KEY) {
        try {
          const sbUrl = new URL('https://app.scrapingbee.com/api/v1/');
          sbUrl.searchParams.set('api_key', SCRAPINGBEE_KEY);
          sbUrl.searchParams.set('url', url);
          sbUrl.searchParams.set('render_js', needsJsRender ? 'true' : 'false');
          sbUrl.searchParams.set('premium_proxy', 'true');
          sbUrl.searchParams.set('country_code', 'us');
          if (needsJsRender) {
            // wait_browser tells ScrapingBee's headless browser to wait until network is idle
            // (Puppeteer networkidle2 equivalent). ScrapingBee uses wait_browser, NOT wait_for.
            // wait_for is for CSS selectors only — passing 'networkidle2' there causes a timeout.
            // Minimum 20s for JS-rendered sites — CarGurus and AutoTrader need the full render cycle.
            sbUrl.searchParams.set('wait_browser', 'networkidle2');
            sbUrl.searchParams.set('timeout', String(Math.max(20000, Math.min(timeout, 30000))));
          }

          console.log('[Proxy Fetch] Trying ScrapingBee:', { url: url.substring(0, 80), needsJsRender });
          const sbResponse = await fetch(sbUrl.toString(), { signal: controller.signal });
          clearTimeout(timeoutId);

          if (sbResponse.ok) {
            const html = await sbResponse.text();
            const creditsUsed = sbResponse.headers.get('spb-cost');
            console.log('[Proxy Fetch] ScrapingBee success, credits used:', creditsUsed, 'html length:', html.length);

            const lowerHtml = html.toLowerCase();
            const isBlocked =
              lowerHtml.includes('captcha') ||
              lowerHtml.includes('just a moment') ||
              lowerHtml.includes('challenge-platform') ||
              html.length < 2000;

            if (!isBlocked) {
              return NextResponse.json({
                success: true,
                html,
                contentLength: html.length,
                status: 200,
                fetchMethod: 'scrapingbee',
                headers: { 'content-type': 'text/html' },
              });
            }
            console.warn('[Proxy Fetch] ScrapingBee returned blocked page, falling back to direct fetch');
          } else {
            const errText = await sbResponse.text().catch(() => '');
            console.warn('[Proxy Fetch] ScrapingBee error', sbResponse.status, errText.substring(0, 200));
            // For JS-rendered sites, ScrapingBee is the only viable path.
            // If it returns non-OK (402 credit exhaustion, 500, etc.), direct fetch won't work either.
            // Return blocked so the scraper shows the right error instead of silently falling through.
            if (needsJsRender) {
              clearTimeout(timeoutId);
              return NextResponse.json({
                success: false,
                error: `ScrapingBee error ${sbResponse.status} — site requires JS rendering`,
                blocked: true,
                sb_status: sbResponse.status,
              }, { status: 422 });
            }
          }
        } catch (sbErr) {
          console.warn('[Proxy Fetch] ScrapingBee threw, falling back:', sbErr instanceof Error ? sbErr.message : sbErr);
        }
      }

      // --- Direct fetch fallback ---
      clearTimeout(timeoutId); // ensure outer timer is cleared regardless of ScrapingBee path
      const directController = new AbortController();
      const directTimeoutId = setTimeout(() => directController.abort(), timeout);

      const response = await fetch(url, {
        signal: directController.signal,
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

      clearTimeout(directTimeoutId);

      console.log('[Proxy Fetch] Direct response status:', response.status, response.statusText);

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

      console.log('[Proxy Fetch] HTML received, length:', html.length);

      // Check if we got a cookie consent / bot wall instead of real content
      const lowerHtml = html.toLowerCase();
      const isCookieWall =
        (lowerHtml.includes('cookie') && lowerHtml.includes('consent') && html.length < 15000) ||
        lowerHtml.includes('cookiebanner') ||
        lowerHtml.includes('cookie-banner') ||
        lowerHtml.includes('cookie_consent') ||
        (lowerHtml.includes('accept') && lowerHtml.includes('cookie') && !lowerHtml.includes('lot-') && html.length < 10000);
      const isBlocked =
        html.includes('captcha') ||
        html.includes('bot detection') ||
        html.includes('Just a moment') ||
        html.includes('challenge-platform') ||
        html.includes('access denied') ||
        html.length < 2000;

      if (isCookieWall) {
        console.warn('[Proxy Fetch] Cookie consent wall detected');
        return NextResponse.json({
          success: false,
          error: 'cookie_wall',
          blocked: true,
          cookie_wall: true,
        }, { status: 422 });
      }

      if (isBlocked) {
        console.warn('[Proxy Fetch] Possible blocking detected');
        return NextResponse.json({
          success: false,
          error: 'blocked',
          blocked: true,
        }, { status: 403 });
      }

      // Return successful response
      return NextResponse.json({
        success: true,
        html,
        contentLength: html.length,
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type'),
        },
      });

    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    // Handle abort/timeout
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
