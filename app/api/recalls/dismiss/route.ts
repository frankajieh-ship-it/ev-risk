/**
 * POST /api/recalls/dismiss
 *
 * Body: { recall_id: string }
 * Marks a recall as dismissed so the badge disappears from the garage card.
 * Only dismisses recalls owned by the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({})) as { recall_id?: string };
  const { recall_id } = body;

  if (!recall_id) {
    return NextResponse.json(
      { success: false, error: "recall_id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("vehicle_recalls")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", recall_id)
    .eq("user_id", user.id);  // ownership guard

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
