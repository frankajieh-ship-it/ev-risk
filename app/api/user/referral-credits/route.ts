/**
 * GET /api/user/referral-credits
 *
 * Returns the total unspent referral credits for the authenticated user.
 * Requires a valid Supabase session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies();

  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ credits: 0, authenticated: false });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ credits: 0, authenticated: true });
  }

  const { data, error } = await supabase
    .from("referral_credits")
    .select("credit_amount")
    .eq("referrer_user_id", user.id);

  if (error) {
    return NextResponse.json({ credits: 0, authenticated: true });
  }

  const total = (data ?? []).reduce((sum, row) => sum + (row.credit_amount ?? 0), 0);

  return NextResponse.json({ credits: total, authenticated: true });
}
