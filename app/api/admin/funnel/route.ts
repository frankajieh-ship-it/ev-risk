/**
 * GET /api/admin/funnel?period=day|week|month
 *
 * Shopper → Dealer conversion funnel metrics.
 * Protected by ADMIN_API_KEY (x-api-key header).
 *
 * Returns counts for each funnel stage plus the previous period
 * so the UI can show deltas.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

function periodBounds(period: string): { start: Date; prevStart: Date } {
  const now = new Date();
  let ms: number;
  if (period === "day") ms = 24 * 60 * 60 * 1000;
  else if (period === "month") ms = 30 * 24 * 60 * 60 * 1000;
  else ms = 7 * 24 * 60 * 60 * 1000; // week default
  return {
    start: new Date(now.getTime() - ms),
    prevStart: new Date(now.getTime() - 2 * ms),
  };
}

async function countRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column: string,
  from: string,
  to?: string,
  extraFilters?: (q: ReturnType<NonNullable<typeof supabase>["from"]>) => ReturnType<NonNullable<typeof supabase>["from"]>
): Promise<number> {
  if (!supabase) return 0;
  let q = supabase
    .from(table)
    .select(column, { count: "exact", head: true })
    .gte("created_at", from);
  if (to) q = q.lt("created_at", to);
  if (extraFilters) q = extraFilters(q) as typeof q;
  const { count } = await q;
  return count ?? 0;
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (ADMIN_KEY && apiKey !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const period = new URL(req.url).searchParams.get("period") ?? "week";
  const { start, prevStart } = periodBounds(period);
  const startISO = start.toISOString();
  const prevStartISO = prevStart.toISOString();

  // Current period counts
  const [receipts, dealerViews, inquiries, attributedInquiries, newSubscriptions] = await Promise.all([
    countRows(supabase, "receipts", "id", startISO),
    // dealer views are tracked in user_events
    (async () => {
      const { count } = await supabase
        .from("user_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "offo_dealer_viewed")
        .gte("timestamp", startISO);
      return count ?? 0;
    })(),
    countRows(supabase, "inquiries", "id", startISO),
    // inquiries where we know which receipt triggered it
    (async () => {
      const { count } = await supabase
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startISO)
        .not("receipt_id", "is", null);
      return count ?? 0;
    })(),
    // dealers who became active subscribers in this period
    (async () => {
      const { count } = await supabase
        .from("dealerships")
        .select("id", { count: "exact", head: true })
        .eq("subscription_status", "active")
        .gte("updated_at", startISO);
      return count ?? 0;
    })(),
  ]);

  // Previous period counts for delta
  const [prevReceipts, prevInquiries, prevSubscriptions] = await Promise.all([
    countRows(supabase, "receipts", "id", prevStartISO, startISO),
    countRows(supabase, "inquiries", "id", prevStartISO, startISO),
    (async () => {
      const { count } = await supabase
        .from("dealerships")
        .select("id", { count: "exact", head: true })
        .eq("subscription_status", "active")
        .gte("updated_at", prevStartISO)
        .lt("updated_at", startISO);
      return count ?? 0;
    })(),
  ]);

  return NextResponse.json({
    period,
    period_start: startISO,
    current: {
      receipts,
      dealer_views: dealerViews,
      inquiries,
      attributed_inquiries: attributedInquiries,
      new_subscriptions: newSubscriptions,
    },
    previous: {
      receipts: prevReceipts,
      inquiries: prevInquiries,
      new_subscriptions: prevSubscriptions,
    },
  });
}
