import { NextRequest, NextResponse } from "next/server";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { getSupabaseAdmin } from "@/lib/api-auth";

// 3 reports per day per IP — prevents a single user from mass-flagging
const reportLimiter = new RateLimiter(24 * 60 * 60 * 1000, 3);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = getClientIP(request);

  if (!reportLimiter.check(ip).allowed) {
    return NextResponse.json({ error: "Too many reports" }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Server error" }, { status: 500 });

  const { data: deal } = await supabase
    .from("curated_deals")
    .select("sold_report_count")
    .eq("id", id)
    .single();

  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newCount = (deal.sold_report_count ?? 0) + 1;
  const shouldDeactivate = newCount >= 2;

  await supabase
    .from("curated_deals")
    .update({
      sold_report_count: newCount,
      ...(shouldDeactivate ? { is_active: false } : {}),
    })
    .eq("id", id);

  return NextResponse.json({ ok: true, deactivated: shouldDeactivate });
}
