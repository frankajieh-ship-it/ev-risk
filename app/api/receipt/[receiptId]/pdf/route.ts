/**
 * OFFO Decision Pack — Receipt PDF Download
 *
 * Temporarily disabled. Re-enable by restoring the full implementation.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { error: "PDF download is temporarily unavailable" },
    { status: 503 }
  );
}
