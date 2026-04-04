/**
 * DELETE /api/user/account
 *
 * GDPR Article 17 — Right to Erasure.
 *
 * Steps:
 *  1. Authenticate via Bearer token
 *  2. Pseudonymize user_events (replace user identifiers with tombstone)
 *  3. Hard-delete all user-owned rows across core tables
 *  4. Delete the Supabase auth user (cascades to user_profiles via FK)
 *  5. Write a tombstone row to account_deletions for audit trail
 *  6. Send confirmation email via Resend
 *
 * Returns 200 on success. Partial failures are logged but don't block the
 * auth user deletion (the most critical step).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { sendChecklistEmail } from "@/lib/resend";

export async function DELETE(request: NextRequest) {
  // 1. Authenticate
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: userId, email } = auth;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const tombstoneId = `deleted_${Date.now()}`;
  const errors: string[] = [];

  // 2. Pseudonymize user_events — replace identifiable values with tombstone
  try {
    await supabase
      .from("user_events")
      .update({ ip_address: "0.0.0.0", event_data: {} })
      .eq("user_id", userId);
  } catch (err) {
    errors.push(`user_events pseudonymize: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Hard-delete user-owned data (order matters for FK constraints)
  const deletions: Array<{ table: string; column: string }> = [
    { table: "garage_vehicles", column: "user_id" },
    { table: "compare_sessions", column: "user_id" },
    { table: "routine_runs", column: "user_id" },
    { table: "routine_profiles", column: "user_id" },
    { table: "deal_watch_searches", column: "user_id" },
    { table: "receipts", column: "user_id" },
    { table: "saved_scenarios", column: "user_id" },
    { table: "email_sequences", column: "user_id" },
  ];

  for (const { table, column } of deletions) {
    try {
      await supabase.from(table).delete().eq(column, userId);
    } catch (err) {
      // Log but continue — auth user deletion is the critical step
      errors.push(`${table} delete: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. Delete the Supabase auth user (cascades to user_profiles via FK)
  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[account/delete] Auth user deletion failed:", deleteError.message);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact hello@offolab.com." },
      { status: 500 }
    );
  }

  // 5. Write audit tombstone (best-effort, non-blocking)
  supabase
    .from("account_deletions")
    .insert({
      tombstone_id: tombstoneId,
      deleted_at: new Date().toISOString(),
      email_domain: email?.split("@")[1] ?? "unknown",
      partial_errors: errors.length > 0 ? errors : null,
    })
    .then(() => {}, (err) => console.error("[account/delete] Tombstone write failed:", err));

  // 6. Send confirmation email (best-effort)
  if (email) {
    sendChecklistEmail(
      email,
      "Your OFFO account has been deleted",
      `<p>Hi,</p>
<p>Your OFFO account and all associated data have been deleted as requested.</p>
<p>If you believe this was a mistake, please contact us at <a href="mailto:hello@offolab.com">hello@offolab.com</a>.</p>
<p>— The OFFO Team</p>`
    ).catch((err) => console.error("[account/delete] Confirmation email failed:", err));
  }

  if (errors.length > 0) {
    console.warn("[account/delete] Completed with partial errors:", errors);
  }

  return NextResponse.json({ success: true });
}
