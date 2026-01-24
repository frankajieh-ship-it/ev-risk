/**
 * Listing Extraction API
 *
 * POST /api/extract-listing
 * Extracts vehicle data from marketplace listing URLs
 */

import { NextRequest, NextResponse } from "next/server";
import { extractVehicleData } from "@/lib/listing-scraper";
import { extractionRateLimiter, getClientIP } from "@/lib/rate-limiter";

// Configure route to allow longer execution time for slow listing sites
export const maxDuration = 30; // 30 seconds for Netlify/Vercel

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

    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Request body parse error:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }

    const { url } = body;

    // Validate input
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Extract vehicle data with comprehensive error handling
    console.log('[Extract Listing API] Starting extraction for URL:', url);
    console.log('[Extract Listing API] Request headers:', Object.fromEntries(request.headers.entries()));

    let result;
    try {
      result = await extractVehicleData(url);
      console.log('[Extract Listing API] Extraction result:', {
        success: result.success,
        error: result.error,
        dataSource: result.data?.dataSource,
        extractedFields: result.data?.extractedFields?.length || 0,
        warningsCount: result.warnings?.length || 0,
        diagnostics: result.diagnostics,
      });
    } catch (extractError) {
      console.error('[Extract Listing API] Extraction error:', extractError);
      console.error('[Extract Listing API] Error stack:', extractError instanceof Error ? extractError.stack : 'No stack trace');
      return NextResponse.json(
        {
          success: false,
          error: extractError instanceof Error ? extractError.message : 'Failed to extract listing data',
          warnings: [],
          diagnostics: {
            failureReason: "unknown",
            domain: null,
            extractedFieldCount: 0,
            fetchMethod: null,
            durationMs: 0,
          },
        },
        { status: 500 }
      );
    }

    if (!result.success) {
      // Determine which fields are missing
      const missingFields: string[] = [];
      if (!result.data?.make) missingFields.push('make');
      if (!result.data?.model) missingFields.push('model');
      if (!result.data?.year) missingFields.push('year');
      if (!result.data?.mileage) missingFields.push('mileage');

      return NextResponse.json(
        {
          success: false,
          needsMoreInfo: true,
          missing: missingFields.length > 0 ? missingFields : ['make', 'model', 'year'],
          error: result.error || 'Failed to extract listing data',
          warnings: result.warnings || [],
          diagnostics: result.diagnostics,
        },
        { status: 200 } // Return 200 so frontend can handle gracefully
      );
    }

    // Return extracted data
    return NextResponse.json({
      success: true,
      data: result.data,
      warnings: result.warnings || [],
      diagnostics: result.diagnostics,
    });

  } catch (error) {
    // Final catch-all for any unexpected errors
    console.error('Unexpected listing extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        warnings: [],
      },
      { status: 500 }
    );
  }
}
