/**
 * GET /api/admin/trace/:traceId
 *
 * Retrieve a stored pipeline trace by ID.
 * Protected by ADMIN_API_KEY header.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchTrace } from "@/lib/debug-trace-store";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ traceId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { traceId } = await params;
  if (!traceId) {
    return NextResponse.json({ error: "Missing traceId" }, { status: 400 });
  }

  const trace = await fetchTrace(traceId);
  if (!trace) {
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, trace });
}
