import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });

  const { data: { user }, error } = await supabase.auth.admin.getUserById(userOrRes.id);
  if (error || !user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

  const meta = user.user_metadata || {};
  return NextResponse.json({
    success: true,
    profile: {
      email: user.email,
      display_name: meta.display_name ?? null,
      charging_access: meta.charging_access ?? null,
      weekly_miles: meta.weekly_miles ?? null,
      notifications_enabled: meta.notifications_enabled ?? false,
      climate: meta.climate ?? null,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow known profile fields
  const allowed = ["display_name", "charging_access", "weekly_miles", "notifications_enabled", "climate"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
  }

  // Get current metadata to merge (don't overwrite unrelated fields)
  const { data: { user: existing } } = await supabase.auth.admin.getUserById(userOrRes.id);
  const currentMeta = existing?.user_metadata || {};

  const { data, error } = await supabase.auth.admin.updateUserById(userOrRes.id, {
    user_metadata: { ...currentMeta, ...patch },
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const meta = data.user.user_metadata || {};
  return NextResponse.json({
    success: true,
    profile: {
      email: data.user.email,
      display_name: meta.display_name ?? null,
      charging_access: meta.charging_access ?? null,
      weekly_miles: meta.weekly_miles ?? null,
      notifications_enabled: meta.notifications_enabled ?? false,
      climate: meta.climate ?? null,
    },
  });
}
