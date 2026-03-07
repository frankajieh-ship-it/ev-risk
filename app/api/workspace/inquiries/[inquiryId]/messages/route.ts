/**
 * Inquiry Messages API (Buyer side)
 *
 * GET  /api/workspace/inquiries/{inquiryId}/messages — get message thread
 * POST /api/workspace/inquiries/{inquiryId}/messages — send a reply
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

type Params = { params: Promise<{ inquiryId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { inquiryId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Verify buyer owns this inquiry
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id")
    .eq("id", inquiryId)
    .eq("buyer_user_id", user.id)
    .single();

  if (!inquiry) {
    return NextResponse.json(
      { success: false, error: "Inquiry not found" },
      { status: 404 }
    );
  }

  const { data: messages, error } = await supabase
    .from("inquiry_messages")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, messages: messages || [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { inquiryId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Verify buyer owns this inquiry
  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("id")
    .eq("id", inquiryId)
    .eq("buyer_user_id", user.id)
    .single();

  if (!inquiry) {
    return NextResponse.json(
      { success: false, error: "Inquiry not found" },
      { status: 404 }
    );
  }

  const { message } = await req.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { success: false, error: "message is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("inquiry_messages")
    .insert({
      inquiry_id: inquiryId,
      sender_user_id: user.id,
      sender_role: "buyer",
      message,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Update inquiry status
  await supabase
    .from("inquiries")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", inquiryId);

  return NextResponse.json({ success: true, message: data }, { status: 201 });
}
