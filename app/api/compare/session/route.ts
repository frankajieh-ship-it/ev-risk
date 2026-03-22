/**
 * POST /api/compare/session
 * Creates a compare_sessions row so Stripe checkout can validate the scenario.
 * Returns { session_id: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    // Return a random UUID so the UI still works without DB
    return NextResponse.json({ session_id: crypto.randomUUID(), fallback: true });
  }

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* ok */ }

  const anon_id = (body.anon_id as string) || null;
  const label_a = (body.label_a as string) || null;
  const label_b = (body.label_b as string) || null;

  const { data, error } = await supabase
    .from("compare_sessions")
    .insert({ anon_id, label_a, label_b })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[compare/session] insert error:", error?.message);
    // Return a UUID anyway — checkout will 404 but that's acceptable degradation
    return NextResponse.json({ session_id: crypto.randomUUID(), fallback: true });
  }

  return NextResponse.json({ session_id: data.id });
}
