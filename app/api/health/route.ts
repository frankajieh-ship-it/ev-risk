/**
 * Health Check Endpoint
 *
 * GET /api/health
 * Returns system health status
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      database: await checkDatabase(),
      api: 'ok',
    },
  };

  return NextResponse.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

async function checkDatabase(): Promise<string> {
  try {
    // Simple check - we could ping the database here
    if (process.env.POSTGRES_URL) {
      return 'ok';
    }
    return 'not_configured';
  } catch (error) {
    return 'error';
  }
}
