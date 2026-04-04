/**
 * Resend Email Client
 *
 * Sends transactional emails via Resend.
 * Requires RESEND_API_KEY env var.
 */

import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) {
    resendClient = new Resend(key);
  }
  return resendClient;
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface DealWatchAlert {
  vehicle_label: string;
  last_price: number | null;
  price_drop_amount: number | null;
  last_verdict: "GREEN" | "YELLOW" | "RED" | null;
}

export function buildDealWatchAlertHtml(
  alerts: DealWatchAlert[],
  searchLabel: string,
  siteUrl: string
): string {
  const alertRows = alerts
    .map((r) => {
      const drop = r.price_drop_amount ? `$${Math.round(r.price_drop_amount / 100).toLocaleString()}` : null;
      const price = r.last_price ? `$${Math.round(r.last_price / 100).toLocaleString()}` : "—";
      const verdictColor =
        r.last_verdict === "GREEN" ? "#16a34a" : r.last_verdict === "RED" ? "#dc2626" : "#ca8a04";
      return `
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:10px 12px;font-size:14px;color:#111827">${r.vehicle_label}</td>
          <td style="padding:10px 12px;font-size:14px;text-align:right;font-weight:600;color:#111827">${price}</td>
          ${drop ? `<td style="padding:10px 12px;font-size:14px;color:#16a34a;font-weight:600;text-align:right">↓ ${drop}</td>` : "<td></td>"}
          ${r.last_verdict ? `<td style="padding:10px 12px;font-size:13px;font-weight:700;color:${verdictColor};text-align:center">${r.last_verdict}</td>` : "<td></td>"}
        </tr>`;
    })
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:16px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <div style="max-width:580px;margin:0 auto">
        <!-- Header -->
        <div style="background:#111827;padding:20px 24px;border-radius:12px 12px 0 0">
          <table style="width:100%"><tr>
            <td>
              <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px">OFFO</span>
            </td>
            <td style="text-align:right">
              <span style="background:#16a34a;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:0.05em">Deal Watch</span>
            </td>
          </tr></table>
        </div>

        <!-- Body -->
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;padding:24px 24px 20px;border-radius:0 0 12px 12px">
          <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:#111827">Price drops on your saved search</h2>
          <p style="margin:0 0 20px;font-size:14px;color:#6b7280">${searchLabel}</p>

          <!-- Table -->
          <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#f9fafb">
                  <th style="padding:10px 12px;font-size:11px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Vehicle</th>
                  <th style="padding:10px 12px;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Price</th>
                  <th style="padding:10px 12px;font-size:11px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Drop</th>
                  <th style="padding:10px 12px;font-size:11px;text-align:center;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Verdict</th>
                </tr>
              </thead>
              <tbody>${alertRows}</tbody>
            </table>
          </div>

          <!-- CTA -->
          <div style="margin-top:24px;text-align:center">
            <a href="${siteUrl}/workspace/deal-watch"
               style="display:inline-block;padding:12px 28px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700">
              View Deal Watch →
            </a>
          </div>

          <!-- Footer -->
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6">
            You're receiving this because you set up a Deal Watch alert on OFFO.<br>
            <a href="${siteUrl}/workspace/deal-watch" style="color:#9ca3af;text-decoration:underline">Manage alerts</a>
            &nbsp;·&nbsp;
            <a href="${siteUrl}/workspace/settings" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>
          </p>
        </div>
      </div>
    </body>
    </html>`;
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
