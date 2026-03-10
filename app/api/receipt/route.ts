/**
 * Receipt API - DISABLED
 *
 * This endpoint has been permanently disabled.
 * Receipt functionality is no longer available.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Receipt functionality has been disabled",
      message: "This feature is no longer available"
    },
    { status: 410 } // 410 Gone - permanently removed
  );
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "Receipt functionality has been disabled",
      message: "This feature is no longer available"
    },
    { status: 410 }
  );
}
