/**
 * Shared API Authentication Utilities
 *
 * Extracts getUserFromRequest() pattern from scenario/save route
 * and adds role-based authorization for B2B routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_adminClient) return _adminClient;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  _adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _adminClient;
}

export type UserRole = "buyer" | "dealer_admin" | "dealer_user";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole | null;
  dealerId: string | null;
}

/**
 * Extract authenticated user from Authorization: Bearer <token> header.
 * Returns null if missing/invalid token.
 */
export async function getUserFromRequest(
  req: NextRequest
): Promise<AuthenticatedUser | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) return null;

    const meta = user.user_metadata || {};
    return {
      id: user.id,
      email: user.email || "",
      role: (meta.role as UserRole) || null,
      dealerId: (meta.dealer_id as string) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns 401 JSON response if not authenticated.
 */
export async function requireAuth(
  req: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }
  return user;
}

/**
 * Require a specific role. Returns 403 if user lacks the role.
 */
export async function requireRole(
  req: NextRequest,
  ...roles: UserRole[]
): Promise<AuthenticatedUser | NextResponse> {
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;

  if (!result.role || !roles.includes(result.role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }
  return result;
}

/**
 * Get the dealership ID for a dealer user. Checks dealer_members table
 * as the authoritative source (user_metadata.dealer_id is convenience cache).
 */
export async function getDealershipId(
  userId: string
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data } = await supabase
    .from("dealer_members")
    .select("dealership_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return data?.dealership_id || null;
}
