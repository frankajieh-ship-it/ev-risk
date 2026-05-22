/**
 * GET /api/advisor/sessions
 *
 * Returns a list of the authenticated user's recent Ask OFFO advisor sessions.
 * Each entry includes: advisor_session_id, first message preview, message count, date.
 * Auth required (Bearer token).
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  // Fetch the first user message per advisor_session_id, ordered by most recent
  const { data, error } = await supabase
    .from("chat_messages")
    .select("advisor_session_id, content, created_at")
    .eq("user_id", user.id)
    .eq("role", "user")
    .not("advisor_session_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  // Group by advisor_session_id, keep earliest message as preview
  const sessionMap = new Map<string, { preview: string; created_at: string; message_count: number }>();
  for (const row of (data ?? [])) {
    const sid = row.advisor_session_id as string;
    if (!sessionMap.has(sid)) {
      sessionMap.set(sid, { preview: row.content as string, created_at: row.created_at as string, message_count: 0 });
    }
    sessionMap.get(sid)!.message_count++;
  }

  const sessions = Array.from(sessionMap.entries())
    .map(([advisor_session_id, v]) => ({ advisor_session_id, ...v }))
    .slice(0, 20);

  return NextResponse.json({ sessions });
}
