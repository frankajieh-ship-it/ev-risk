/**
 * POST /api/dealer/provision
 *
 * Creates a dealership + dealer_member row for a newly authenticated user,
 * then sets user_metadata.role = "dealer_admin" and dealer_id.
 *
 * Called once after a dealer confirms their email via magic link.
 * Idempotent — safe to call multiple times (returns existing dealership if
 * the user is already a dealer_admin).
 *
 * Body: { dealership_name, contact_name, phone, city, state, zip }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: NextRequest) {
  // Must be authenticated (just confirmed magic link)
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // Already a dealer? Return existing dealership
  if (authResult.role === "dealer_admin" || authResult.role === "dealer_user") {
    return NextResponse.json({ success: true, already_provisioned: true });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: {
    dealership_name?: string;
    contact_name?: string;
    phone?: string;
    city?: string;
    state?: string;
    zip?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { dealership_name, contact_name, phone, city, state, zip } = body;

  if (!dealership_name?.trim()) {
    return NextResponse.json({ error: "dealership_name is required" }, { status: 400 });
  }

  // Generate unique slug
  const baseSlug = slugify(dealership_name);
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const { data: existing } = await supabase
      .from("dealerships")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  // 1. Create dealership row
  const { data: dealership, error: dealError } = await supabase
    .from("dealerships")
    .insert({
      name: dealership_name.trim(),
      slug,
      phone: phone?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      zip: zip?.trim() || null,
      country: "US",
      description: contact_name?.trim()
        ? `Contact: ${contact_name.trim()}`
        : null,
      is_verified: false,
    })
    .select("id, slug")
    .single();

  if (dealError || !dealership) {
    console.error("[provision] dealership insert error:", dealError);
    return NextResponse.json(
      { error: dealError?.message || "Failed to create dealership" },
      { status: 500 }
    );
  }

  // 2. Create dealer_members row
  const { error: memberError } = await supabase.from("dealer_members").insert({
    user_id: authResult.id,
    dealership_id: dealership.id,
    role: "admin",
  });

  if (memberError) {
    console.error("[provision] dealer_members insert error:", memberError);
    // Clean up dealership row so user can retry
    await supabase.from("dealerships").delete().eq("id", dealership.id);
    return NextResponse.json(
      { error: memberError.message || "Failed to link user to dealership" },
      { status: 500 }
    );
  }

  // 3. Set user_metadata.role + dealer_id via admin API
  const { error: metaError } = await supabase.auth.admin.updateUserById(authResult.id, {
    user_metadata: {
      role: "dealer_admin",
      dealer_id: dealership.id,
    },
  });

  if (metaError) {
    console.error("[provision] user_metadata update error:", metaError);
    // Non-fatal — membership row exists; user can still operate as dealer
    // but layout redirect may not work until metadata propagates
  }

  return NextResponse.json({
    success: true,
    dealership_id: dealership.id,
    slug: dealership.slug,
  });
}
