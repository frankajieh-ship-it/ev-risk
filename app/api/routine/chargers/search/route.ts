/**
 * Charger Search API
 * GET /api/routine/chargers/search?zip=xxxxx&radius=10&connectors=CCS,NACS
 *
 * Proxies to NREL AFDC charger search client.
 */

import { NextRequest, NextResponse } from "next/server";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { logApi, startTimer } from "@/lib/api-logger";
import { getChargerClient, isChargerApiConfigured } from "@/lib/charger-client";

const rateLimiter = new RateLimiter(15 * 60 * 1000, 100);

export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const limit = rateLimiter.check(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  if (!isChargerApiConfigured()) {
    return NextResponse.json(
      { success: false, error: "Charger API not configured" },
      { status: 503 }
    );
  }

  const timer = startTimer();

  try {
    const { searchParams } = new URL(req.url);
    const zip = searchParams.get("zip");
    const radius = parseInt(searchParams.get("radius") || "10", 10);
    const connectors = searchParams.get("connectors");

    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { success: false, error: "Valid 5-digit ZIP code required" },
        { status: 400 }
      );
    }

    if (radius < 1 || radius > 50) {
      return NextResponse.json(
        { success: false, error: "Radius must be between 1 and 50 miles" },
        { status: 400 }
      );
    }

    const client = getChargerClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: "Charger client unavailable" },
        { status: 503 }
      );
    }

    const connectorTypes = connectors
      ? connectors.split(",").map((c) => c.trim())
      : undefined;

    const result = await client.searchByZip(zip, {
      radius_miles: radius,
      connector_types: connectorTypes,
    });

    if (!result.success) {
      logApi("error", "Charger search proxy failed", {
        endpoint: "/api/routine/chargers/search",
        elapsed_ms: timer(),
        error_code: "charger_api",
        zip,
      });
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 }
      );
    }

    logApi("info", "Charger search success", {
      endpoint: "/api/routine/chargers/search",
      elapsed_ms: timer(),
      zip,
      results: result.data.length,
    });

    return NextResponse.json({
      success: true,
      chargers: result.data,
    });
  } catch (error) {
    logApi("error", "Charger search error", {
      endpoint: "/api/routine/chargers/search",
      elapsed_ms: timer(),
      error_code: "unhandled",
    });
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
