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

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
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

    // Parse request body
    const body = await request.json();
    const { url, timeout = 10000 } = body;

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
        // Add a small delay to appear more human-like
        ...(Math.random() > 0.5 && {
          // Randomly include cookies to appear more legitimate
        }),
      });

      clearTimeout(timeoutId);

      console.log('[Proxy Fetch] Response status:', response.status, response.statusText);

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

      // Check if we got blocked
      const isBlocked =
        html.includes('captcha') ||
        html.includes('bot detection') ||
        html.includes('Just a moment') ||
        html.includes('challenge-platform') ||
        html.includes('access denied') ||
        html.length < 2000;

      if (isBlocked) {
        console.warn('[Proxy Fetch] Possible blocking detected');
        return NextResponse.json({
          success: false,
          error: 'Site appears to be blocking automated requests',
          blocked: true,
          html: html.substring(0, 1000), // Return first 1000 chars for debugging
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
