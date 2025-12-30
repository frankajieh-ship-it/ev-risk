/**
 * Debug Environment Variables API
 *
 * GET /api/debug-env
 * Returns current environment variables (sanitized for security)
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Check for admin API key
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Return sanitized environment info
  return NextResponse.json({
    success: true,
    environment: {
      // Platform detection
      isServerSide: typeof window === 'undefined',

      // URL environment variables (for debugging proxy issues)
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'not set',
      URL: process.env.URL || 'not set',  // Netlify production
      DEPLOY_URL: process.env.DEPLOY_URL || 'not set',  // Netlify preview
      VERCEL_URL: process.env.VERCEL_URL || 'not set',  // Vercel

      // Node environment
      NODE_ENV: process.env.NODE_ENV || 'not set',

      // Netlify-specific
      NETLIFY: process.env.NETLIFY || 'not set',
      CONTEXT: process.env.CONTEXT || 'not set',  // production, deploy-preview, branch-deploy

      // What URL would be used for proxy
      computedProxyBaseUrl: process.env.NEXT_PUBLIC_BASE_URL ||
                            process.env.URL ||
                            process.env.DEPLOY_URL ||
                            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                            'http://localhost:3000',
    },
    timestamp: new Date().toISOString(),
  });
}
