/**
 * Health Check Endpoint
 *
 * GET /api/health
 * Used by uptime monitors (BetterStack, Uptime Robot, etc.)
 * Returns 200 when the service is healthy, 503 when degraded.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  const checks: Record<string, "ok" | "error" | "not_configured"> = {
    api: "ok",
    database: "not_configured",
  };

  // Ping Supabase with a lightweight query
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from("receipts")
        .select("id")
        .limit(1)
        .maybeSingle();
      checks.database = error ? "error" : "ok";
    } catch {
      checks.database = "error";
    }
  }

  const isHealthy = Object.values(checks).every(
    (v) => v === "ok" || v === "not_configured"
  );
  const hasDegraded = Object.values(checks).some((v) => v === "error");

  const status = hasDegraded ? 503 : 200;

  return NextResponse.json(
    {
      status: hasDegraded ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
      checks,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
