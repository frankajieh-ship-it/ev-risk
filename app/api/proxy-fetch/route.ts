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
    const { url } = body;
    // Clamp timeout — never trust caller-supplied value
    const timeout = Math.min(Math.max(Number(body.timeout) || 10000, 1000), 30000);

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

    // Security: only allow known car listing domains.
    // Uses hostname.endsWith() for suffix matching — prevents subdomain bypass
    // (evil.autotrader.com.attacker.com would not end with "autotrader.com").
    // facebook.com removed — overly broad, not a car listing source.
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
      'copart.com',
      'iaai.com',
    ];

    // Also block private/internal IP ranges even if domain passes the check
    const hostname = parsedUrl.hostname;
    const isPrivateIp =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") || // AWS/GCP metadata
      hostname.startsWith("172.16.") ||
      hostname.startsWith("100.64.") ||  // Tailscale
      hostname === "::1" ||
      hostname === "0.0.0.0";

    if (isPrivateIp) {
      return NextResponse.json(
        { success: false, error: "Domain not allowed." },
        { status: 403 }
      );
    }

    const isAllowed = allowedDomains.some(domain => parsedUrl.hostname.endsWith(`.${domain}`) || parsedUrl.hostname === domain);

    if (!isAllowed) {
      return NextResponse.json(
        { success: false, error: 'Domain not allowed. Only car listing sites are supported.' },
        { status: 403 }
      );
    }

    console.log('[Proxy Fetch] Fetching URL:', url.substring(0, 100));

    // Sites that need JS rendering via Nimbleway
    // autotrader.com removed — Nimbleway returns Akamai block page; direct fetch works fine
    // cars.com removed — direct fetch returns full HTML without JS rendering
    const needsJsRender = ['cargurus.com'].some(
      d => parsedUrl.hostname.includes(d)
    );

    const NIMBLEWAY_KEY = process.env.NIMBLEWAY_API_KEY;

    // Listing ID for CarGurus stale-cache detection — hoisted so both Nimbleway
    // and ScrapingBee blocks can validate the returned HTML against the requested listing.
    const cgListingId = parsedUrl.hostname.includes('cargurus.com')
      ? (parsedUrl.pathname.match(/\/details\/(\d{7,12})/)?.[1] ?? null)
      : null;

    // --- CarGurus: try JSON API first (fastest, no scraping needed) ---
    // Returns structured listing data (year/make/model/VIN/price/mileage/photos) without
    // requiring HTML rendering. Works from Netlify IPs when the listing is active.
    if (parsedUrl.hostname.includes('cargurus.com') && cgListingId) {
      try {
        const cgApiUrl = `https://www.cargurus.com/api/listing/v1/detail/${cgListingId}`;
        const cgApiRes = await fetch(cgApiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': `https://www.cargurus.com/Cars/new/nl-New-Cars-d0`,
            'Origin': 'https://www.cargurus.com',
            'x-requested-with': 'XMLHttpRequest',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (cgApiRes.ok) {
          const cgJson = await cgApiRes.json() as Record<string, unknown>;
          // Wrap JSON as minimal HTML so the scraper can parse it via __NEXT_DATA__ path
          const wrappedHtml = `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { listing: cgJson } } })}</script><p>${cgListingId}</p></body></html>`;
          console.log(`[Proxy Fetch] CarGurus JSON API success for ${cgListingId}`);
          return NextResponse.json({
            success: true,
            html: wrappedHtml,
            contentLength: wrappedHtml.length,
            status: 200,
            fetchMethod: 'cargurus_api',
            headers: { 'content-type': 'text/html' },
          });
        }
        console.warn(`[Proxy Fetch] CarGurus JSON API returned ${cgApiRes.status} — falling through to Googlebot`);
      } catch (cgApiErr) {
        console.warn('[Proxy Fetch] CarGurus JSON API failed:', cgApiErr instanceof Error ? cgApiErr.message : String(cgApiErr));
      }
    }

    // --- CarGurus: try Googlebot direct fetch ---
    // CarGurus serves a fully server-rendered page (including __remixContext with VIN + photos)
    // to Googlebot without requiring JS execution. This is faster and avoids Nimbleway's
    // persistent stale cache problem entirely.
    if (parsedUrl.hostname.includes('cargurus.com')) {
      try {
        const cgController = new AbortController();
        const cgTimeoutId = setTimeout(() => cgController.abort(), 15000);
        const cgRes = await fetch(url, {
          signal: cgController.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.google.com/',
          },
          redirect: 'follow',
        });
        clearTimeout(cgTimeoutId);
        if (cgRes.ok) {
          const cgHtml = await cgRes.text();
          const hasRemixContext = cgHtml.includes('__remixContext') || cgHtml.includes('__NEXT_DATA__');
          const hasListingId = cgListingId ? cgHtml.includes(cgListingId) : true;
          const isBlocked = cgHtml.length < 5000 || cgHtml.toLowerCase().includes('just a moment');
          console.log(`[Proxy Fetch] CarGurus Googlebot fetch: length=${cgHtml.length} hasRemix=${hasRemixContext} hasListingId=${hasListingId}`);
          if (!isBlocked && hasListingId && hasRemixContext) {
            return NextResponse.json({
              success: true,
              html: cgHtml,
              contentLength: cgHtml.length,
              status: 200,
              fetchMethod: 'googlebot_direct',
              headers: { 'content-type': 'text/html' },
            });
          }
          console.warn(`[Proxy Fetch] CarGurus Googlebot fetch insufficient (blocked=${isBlocked} hasListingId=${hasListingId} hasRemix=${hasRemixContext}) — falling through to Nimbleway`);
        } else {
          console.warn(`[Proxy Fetch] CarGurus Googlebot fetch returned ${cgRes.status} — falling through to Nimbleway`);
        }
      } catch (cgErr) {
        console.warn('[Proxy Fetch] CarGurus Googlebot fetch failed:', cgErr instanceof Error ? cgErr.message : String(cgErr));
      }
    }

    // --- Nimbleway path for JS-rendered sites ---
    if (needsJsRender && NIMBLEWAY_KEY) {
      const nmController = new AbortController();
      const nmTimeoutId = setTimeout(() => nmController.abort(), 28000);
      try {
        console.log('[Proxy Fetch] Trying Nimbleway:', url.substring(0, 80));
        const nmResponse = await fetch('https://sdk.nimbleway.com/v1/extract', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NIMBLEWAY_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url, render: true, country: 'US', locale: 'en-US', cache: false }),
          signal: nmController.signal,
        });
        clearTimeout(nmTimeoutId);

        console.log('[Proxy Fetch] Nimbleway status:', nmResponse.status);

        if (nmResponse.ok) {
          // Nimbleway returns { status, status_code, data: { html, redirects }, metadata, task_id, url }
          const nmJson = await nmResponse.json() as {
            status?: string;
            status_code?: number;
            data?: { html?: string };
          };
          const html = nmJson?.data?.html ?? '';
          const nmStatusCode = nmJson?.status_code ?? 200;
          console.log('[Proxy Fetch] Nimbleway html length:', html.length, 'status_code:', nmStatusCode);

          const lowerHtml = html.toLowerCase();
          const isBlocked =
            lowerHtml.includes('id="captcha"') ||
            lowerHtml.includes('just a moment') ||
            lowerHtml.includes('challenge-platform') ||
            lowerHtml.includes('autotrader - page unavailable') ||
            lowerHtml.includes('akamai-block') ||
            html.length < 500;

          // CarGurus sometimes returns a BLACKOUT_TEXAS JS shell (~2755 bytes) that lacks
          // vehicle history (title/accident). Fall through to direct fetch for small responses
          // so we can merge — direct fetch often gets rendered history text via Googlebot UA.
          const isThinShell = parsedUrl.hostname.includes('cargurus.com') && html.length < 10000;

          // CarGurus stale-cache check: verify the listing ID appears in the returned HTML.
          // Nimbleway sometimes returns a cached page from a different listing even with cache:false.
          const isStaleCache = cgListingId !== null && !html.includes(cgListingId);

          if (isStaleCache) {
            console.warn(`[Proxy Fetch] Nimbleway stale cache — listing ID ${cgListingId} not in HTML (length: ${html.length}), trying CarGurus JSON API`);
            // Try CarGurus JSON API directly — bypasses JS rendering entirely.
            // /api/graphql or the listing data endpoint returns structured JSON without needing a browser.
            try {
              const cgApiUrl = `https://www.cargurus.com/api/listing/v1/detail/${cgListingId}`;
              const cgApiRes = await fetch(cgApiUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                  'Accept': 'application/json',
                  'Referer': 'https://www.cargurus.com/',
                },
                signal: AbortSignal.timeout(10000),
              });
              if (cgApiRes.ok) {
                const cgJson = await cgApiRes.json() as Record<string, unknown>;
                // Wrap JSON as minimal HTML so the scraper's __NEXT_DATA__ / JSON paths can parse it
                const wrappedHtml = `<html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { listing: cgJson } } })}</script><p>${cgListingId}</p></body></html>`;
                console.log(`[Proxy Fetch] CarGurus JSON API success for listing ${cgListingId}`);
                return NextResponse.json({
                  success: true,
                  html: wrappedHtml,
                  contentLength: wrappedHtml.length,
                  status: 200,
                  fetchMethod: 'cargurus_api',
                  headers: { 'content-type': 'text/html' },
                });
              }
              console.warn(`[Proxy Fetch] CarGurus JSON API returned ${cgApiRes.status} — falling through to ScrapingBee`);
            } catch (cgApiErr) {
              console.warn('[Proxy Fetch] CarGurus JSON API failed:', cgApiErr instanceof Error ? cgApiErr.message : String(cgApiErr));
            }
            // Fall through to ScrapingBee
          } else if (!isBlocked && !isThinShell) {
            return NextResponse.json({
              success: true,
              html,
              contentLength: html.length,
              status: nmStatusCode,
              fetchMethod: 'nimbleway',
              headers: { 'content-type': 'text/html' },
            });
          }
          if (!isBlocked && isThinShell && !isStaleCache) {
            // Store partial Nimbleway result; try direct fetch below and use whichever is richer
            console.log('[Proxy Fetch] CarGurus thin shell from Nimbleway, trying direct fetch for history data');
          } else if (!isStaleCache) {
            console.warn('[Proxy Fetch] Nimbleway returned blocked/empty page, length:', html.length);
          }
        } else {
          const errText = await nmResponse.text().catch(() => '');
          console.warn('[Proxy Fetch] Nimbleway error', nmResponse.status, errText.substring(0, 200), '— falling through to ScrapingBee');
        }
      } catch (nmErr) {
        clearTimeout(nmTimeoutId);
        const msg = nmErr instanceof Error ? nmErr.message : String(nmErr);
        console.warn('[Proxy Fetch] Nimbleway threw:', msg, '— falling through to ScrapingBee');
      }

      // --- ScrapingBee fallback for JS-rendered sites when Nimbleway fails ---
      const SCRAPINGBEE_KEY = process.env.SCRAPINGBEE_API_KEY;
      if (SCRAPINGBEE_KEY) {
        const sbController = new AbortController();
        const sbTimeoutId = setTimeout(() => sbController.abort(), 25000);
        try {
          console.log('[Proxy Fetch] Trying ScrapingBee fallback:', url.substring(0, 80));
          const sbParams = new URLSearchParams({
            api_key: SCRAPINGBEE_KEY,
            url,
            render_js: 'true',
            premium_proxy: 'true',
            country_code: 'us',
            wait: '3000',
          });
          const sbResponse = await fetch(`https://app.scrapingbee.com/api/v1/?${sbParams}`, {
            signal: sbController.signal,
          });
          clearTimeout(sbTimeoutId);
          console.log('[Proxy Fetch] ScrapingBee status:', sbResponse.status);

          if (sbResponse.ok) {
            const sbHtml = await sbResponse.text();
            const lowerSb = sbHtml.toLowerCase();
            const sbBlocked =
              lowerSb.includes('id="captcha"') ||
              lowerSb.includes('just a moment') ||
              lowerSb.includes('challenge-platform') ||
              sbHtml.length < 500;
            const sbStaleCache = cgListingId !== null && !sbHtml.includes(cgListingId);

            if (!sbBlocked && !sbStaleCache && sbHtml.length >= 10000) {
              console.log('[Proxy Fetch] ScrapingBee success, length:', sbHtml.length);
              return NextResponse.json({
                success: true,
                html: sbHtml,
                contentLength: sbHtml.length,
                status: 200,
                fetchMethod: 'scrapingbee',
                headers: { 'content-type': 'text/html' },
              });
            }
            if (sbStaleCache) {
              console.warn(`[Proxy Fetch] ScrapingBee also stale cache — listing ID ${cgListingId} not in HTML`);
            } else {
              console.warn('[Proxy Fetch] ScrapingBee returned blocked/thin page, length:', sbHtml.length);
            }
          } else {
            console.warn('[Proxy Fetch] ScrapingBee error:', sbResponse.status);
          }
        } catch (sbErr) {
          clearTimeout(sbTimeoutId);
          console.warn('[Proxy Fetch] ScrapingBee threw:', sbErr instanceof Error ? sbErr.message : String(sbErr));
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // CarGurus serves rendered HTML (including vehicle history) to Googlebot
    const isCarGurus = parsedUrl.hostname.includes('cargurus.com');
    const fetchUA = isCarGurus
      ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      : getRandomUserAgent();

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': fetchUA,
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
