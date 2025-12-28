/**
 * Processing Status API
 *
 * GET /api/status/[processId]
 * Returns real-time status of report generation
 * Uses Server-Sent Events (SSE) for live updates
 */

import { NextRequest } from 'next/server';
import { processingStore } from '@/lib/processing-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ processId: string }> }
) {
  const { processId } = await params;

  // Get current status
  const status = processingStore.get(processId);

  if (!status) {
    return new Response(
      JSON.stringify({ error: 'Process not found' }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Return current status as JSON
  // For SSE implementation, we'd need a different approach
  return new Response(JSON.stringify(status), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
