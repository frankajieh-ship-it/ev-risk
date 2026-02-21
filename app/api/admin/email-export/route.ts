/**
 * Admin Email Export
 *
 * GET /api/admin/email-export?format=json|csv&funnel_stage=lead&since=2025-01-01&limit=1000
 *
 * Exports email captures with UTM fields and funnel stage for marketing tools.
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "your-secret-admin-key";
const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";
  const funnelStage = url.searchParams.get("funnel_stage");
  const since = url.searchParams.get("since");
  const limitParam = parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(limitParam, 1), MAX_LIMIT);

  try {
    let query = supabase
      .from("checklist_email_captures")
      .select("email, created_at, updated_at, anon_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, funnel_stage, page_source, persistent_session_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (funnelStage) {
      query = query.eq("funnel_stage", funnelStage);
    }

    if (since) {
      query = query.gte("created_at", since);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[Email Export] Query error:", error);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const rows = data || [];

    if (format === "csv") {
      const headers = [
        "email", "created_at", "updated_at", "anon_id",
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "funnel_stage", "page_source",
      ];
      const csvLines = [headers.join(",")];

      for (const row of rows) {
        const values = headers.map((h) => {
          const val = (row as Record<string, unknown>)[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvLines.push(values.join(","));
      }

      return new NextResponse(csvLines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="email-captures-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({ total: rows.length, entries: rows });
  } catch (err) {
    console.error("[Email Export] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
