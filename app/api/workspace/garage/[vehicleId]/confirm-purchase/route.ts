/**
 * POST /api/workspace/garage/{vehicleId}/confirm-purchase
 *
 * Marks a garage vehicle as purchased:
 *   - Sets is_owned_ev = true, purchased_at = now(), outcome = 'purchased'
 *   - Fires a one-time "welcome to ownership" email
 *   - Returns the updated vehicle row
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { safeSend } from "@/lib/crm-email";
import { buildPurchaseConfirmEmail } from "@/lib/crm-templates/activation";

type Params = { params: Promise<{ vehicleId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  // Fetch vehicle — verifies ownership
  const { data: vehicle, error: fetchErr } = await supabase
    .from("garage_vehicles")
    .select("id, make, model, year, is_owned_ev, purchased_at")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !vehicle) {
    return NextResponse.json({ success: false, error: "Vehicle not found" }, { status: 404 });
  }

  if (vehicle.purchased_at) {
    // Already confirmed — idempotent, just return current state
    return NextResponse.json({ success: true, alreadyConfirmed: true });
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from("garage_vehicles")
    .update({
      is_owned_ev: true,
      purchased_at: now,
      outcome: "purchased",
      updated_at: now,
    })
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }

  // Fire welcome email if user has an email address
  const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
  const email = authUser?.user?.email;
  if (email) {
    const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
    const { subject, html } = buildPurchaseConfirmEmail({ email, vehicle: vehicleLabel, vehicleId });
    safeSend({
      email,
      userId: user.id,
      sequenceType: "activation",
      sequenceStep: "purchase_confirm",
      subject,
      html,
      idempotencyKey: `purchase_confirm:${vehicleId}`,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, vehicle: updated });
}
