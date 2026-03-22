/**
 * POST /api/consultation/request
 *
 * Stores a personal consultation request from a receipt page visitor.
 * Logs to Supabase consultation_requests table (if configured).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { receipt_id, name, email, phone, preferred_time, message, vehicle_label } = body as {
    receipt_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    preferred_time?: string;
    message?: string;
    vehicle_label?: string;
  };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    try {
      await supabase.from("consultation_requests").insert({
        receipt_id: receipt_id || null,
        name: name || null,
        email: email.trim(),
        phone: phone || null,
        preferred_time: preferred_time || null,
        message: message || null,
        vehicle_label: vehicle_label || null,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical — always return success to client
    }
  }

  return NextResponse.json({ success: true });
}
