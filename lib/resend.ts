/**
 * Resend Email Client
 *
 * Sends transactional emails via Resend.
 * Requires RESEND_API_KEY env var.
 */

import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!resendApiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(resendApiKey);
  }
  return resendClient;
}

export function isResendConfigured(): boolean {
  return !!resendApiKey;
}

export async function sendChecklistEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: "Email service not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "OFFO Lab <noreply@offolab.com>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("[Resend] Send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Resend] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to send email",
    };
  }
}
