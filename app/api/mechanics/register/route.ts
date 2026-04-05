/**
 * POST /api/mechanics/register
 * Public endpoint — creates a pending mechanic profile.
 * If an Authorization: Bearer token is present, the user is linked via mechanic_members.
 *
 * Body: OnboardingData from MechanicOnboarding component
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/api-auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const {
    business_name,
    bio,
    phone,
    website,
    address_line1,
    city,
    state,
    zip,
    service_radius_miles,
    specialties,
    certifications,
  } = body as {
    business_name: string;
    bio?: string;
    phone?: string;
    website?: string;
    address_line1?: string;
    city: string;
    state: string;
    zip: string;
    service_radius_miles?: number;
    specialties: string[];
    certifications?: string[];
  };

  if (!business_name?.trim() || !city?.trim() || !state?.trim() || !/^\d{5}$/.test(zip ?? "")) {
    return NextResponse.json(
      { success: false, error: "business_name, city, state, and a valid ZIP are required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(specialties) || specialties.length === 0) {
    return NextResponse.json({ success: false, error: "At least one specialty is required" }, { status: 400 });
  }

  // Generate unique slug
  let slug = slugify(business_name.trim());
  const { data: existing } = await supabase
    .from("mechanic_profiles")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    slug = `${slug}-${randomSuffix()}`;
  }

  const { data: profile, error: insertError } = await supabase
    .from("mechanic_profiles")
    .insert({
      slug,
      business_name: business_name.trim(),
      bio: bio?.trim() || null,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      address_line1: address_line1?.trim() || null,
      city: city.trim(),
      state,
      zip,
      service_radius_miles: service_radius_miles ?? 50,
      specialties,
      certifications: certifications ?? [],
      status: "pending",
    })
    .select("id, slug")
    .single();

  if (insertError || !profile) {
    console.error("[mechanics/register] insert error:", insertError?.message);
    return NextResponse.json({ success: false, error: "Registration failed. Please try again." }, { status: 500 });
  }

  // Optionally link authenticated user as admin of this mechanic profile
  const user = await getUserFromRequest(req);
  if (user) {
    await supabase.from("mechanic_members").insert({
      user_id: user.id,
      mechanic_id: profile.id,
      role: "admin",
    });
  }

  return NextResponse.json({ success: true, slug: profile.slug, id: profile.id });
}
