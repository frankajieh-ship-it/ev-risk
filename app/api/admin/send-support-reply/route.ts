/**
 * POST /api/admin/send-support-reply
 *
 * Sends a one-off support reply to a specific user.
 * Body: { email: string, subject: string, html: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { sendChecklistEmail } from "@/lib/resend";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!ADMIN_KEY || auth !== `Bearer ${ADMIN_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; subject?: string; html?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, subject, html } = body;
  if (!email || !subject || !html) {
    return NextResponse.json({ error: "Missing email, subject, or html" }, { status: 400 });
  }

  const result = await sendChecklistEmail(email, subject, html);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
