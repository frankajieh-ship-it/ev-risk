import { NextResponse } from "next/server";
import { validateVin, decodeVin } from "@/lib/vin-service";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

// 20 decodes per 10 minutes per IP (free tool — more generous limit)
const rateLimiter = new RateLimiter(10 * 60 * 1000, 20);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { vin } = body;

    if (!vin || typeof vin !== "string") {
      return NextResponse.json({ success: false, error: "VIN is required" }, { status: 400 });
    }

    const cleanVin = validateVin(vin);
    if (!cleanVin) {
      return NextResponse.json(
        { success: false, error: "Invalid VIN — must be 17 characters, no I/O/Q." },
        { status: 400 }
      );
    }

    const clientIP = getClientIP(request);
    const rateCheck = rateLimiter.check(clientIP);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests — please wait a few minutes." },
        { status: 429 }
      );
    }

    const result = await decodeVin(cleanVin);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, decoded: result.decoded });
  } catch (err) {
    console.error("[Tools VIN Decode] Unexpected error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
