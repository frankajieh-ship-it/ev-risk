/**
 * CRM Template Shared Utilities
 *
 * Pure helpers — no DB access. Used by all email template builders.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

export function verdictColor(verdict: "GREEN" | "YELLOW" | "RED"): string {
  const map: Record<string, string> = {
    GREEN: "#16a34a",
    YELLOW: "#ca8a04",
    RED: "#dc2626",
  };
  return map[verdict] ?? "#6b7280";
}

export function verdictLabel(verdict: "GREEN" | "YELLOW" | "RED"): string {
  const map: Record<string, string> = {
    GREEN: "Clean Deal",
    YELLOW: "Needs Review",
    RED: "High Risk",
  };
  return map[verdict] ?? verdict;
}

export function vehicleLabel(
  year?: number | null,
  make?: string | null,
  model?: string | null
): string {
  return [year, make, model].filter(Boolean).join(" ") || "your vehicle";
}

export function verdictBadge(verdict: "GREEN" | "YELLOW" | "RED"): string {
  const color = verdictColor(verdict);
  const label = verdictLabel(verdict);
  return `<span style="display:inline-block;padding:4px 14px;border-radius:20px;font-size:13px;font-weight:700;color:#fff;background:${color};">${label}</span>`;
}

export function ctaButton(text: string, href: string, color = "#4f46e5"): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background:${color};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${text}</a>`;
}
