/**
 * Onboarding API
 * POST /api/onboarding — Set user role after first sign-in
 *
 * Accepts { role: "buyer" | "dealer", dealershipName?: string }
 * Sets user_metadata via Supabase Admin, creates dealership for dealers.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  if (user.role) {
    return NextResponse.json(
      { success: false, error: "Already onboarded" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Server not configured" },
      { status: 503 }
    );
  }

  let body: { role?: string; dealershipName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { role, dealershipName } = body;

  // --- Buyer path ---
  if (role === "buyer") {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { role: "buyer" },
    });

    if (error) {
      console.error("[Onboarding] Failed to set buyer role:", error.message);
      return NextResponse.json(
        { success: false, error: "Failed to set role" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, redirect: "/workspace" });
  }

  // --- Dealer path ---
  if (role === "dealer") {
    if (!dealershipName?.trim()) {
      return NextResponse.json(
        { success: false, error: "Dealership name is required" },
        { status: 400 }
      );
    }

    const name = dealershipName.trim();

    // Generate slug
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check uniqueness
    const { data: existing } = await supabase
      .from("dealerships")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    // Create dealership
    const { data: dealership, error: dealerErr } = await supabase
      .from("dealerships")
      .insert({ name, slug })
      .select("id")
      .single();

    if (dealerErr || !dealership) {
      console.error("[Onboarding] Failed to create dealership:", dealerErr?.message);
      return NextResponse.json(
        { success: false, error: "Failed to create dealership" },
        { status: 500 }
      );
    }

    // Create dealer_members row
    const { error: memberErr } = await supabase
      .from("dealer_members")
      .insert({
        user_id: user.id,
        dealership_id: dealership.id,
        role: "admin",
      });

    if (memberErr) {
      // Rollback: delete the dealership
      await supabase.from("dealerships").delete().eq("id", dealership.id);
      console.error("[Onboarding] Failed to create dealer member:", memberErr.message);
      return NextResponse.json(
        { success: false, error: "Failed to set up dealer account" },
        { status: 500 }
      );
    }

    // Set user metadata
    const { error: metaErr } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        role: "dealer_admin",
        dealer_id: dealership.id,
      },
    });

    if (metaErr) {
      console.error("[Onboarding] Failed to set dealer metadata:", metaErr.message);
      // Don't rollback — DB rows are correct, metadata can be retried
    }

    return NextResponse.json({
      success: true,
      redirect: "/dealer",
      dealershipId: dealership.id,
    });
  }

  return NextResponse.json(
    { success: false, error: "Invalid role. Choose 'buyer' or 'dealer'." },
    { status: 400 }
  );
}
