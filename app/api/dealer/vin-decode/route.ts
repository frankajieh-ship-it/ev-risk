/**
 * Dealer VIN Decode API
 * POST /api/dealer/vin-decode — Decode a VIN via NHTSA for inventory autofill
 *
 * Reuses lib/vin-service.ts (same logic as receipt VIN decode).
 * Auth: dealer role required. No receipt_id needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { validateVin, decodeVin } from "@/lib/vin-service";

// Simple in-memory rate limit: 20 decodes per 10 minutes per user
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT = 20;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { success: false, error: "Too many VIN lookups. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let body: { vin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { vin } = body;
  if (!vin || typeof vin !== "string") {
    return NextResponse.json({ success: false, error: "VIN is required" }, { status: 400 });
  }

  const cleanVin = validateVin(vin);
  if (!cleanVin) {
    return NextResponse.json(
      { success: false, error: "Invalid VIN. Must be 17 characters (letters A-H, J-N, P, R-Z and digits 0-9)." },
      { status: 400 }
    );
  }

  const result = await decodeVin(cleanVin);

  if (!result.success) {
    const status = result.code === "unrecognized" ? 400 : result.code === "not_found" ? 404 : 502;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    decoded: result.decoded,
  });
}
