/**
 * AI Health Monitor — Scheduled Cron
 *
 * Runs every 5 minutes. Reads the last 30 minutes of ai_job_succeeded /
 * ai_job_failed events from user_events and fires a Slack alert when the
 * rolling success rate drops below 85% (minimum 3 samples).
 *
 * Alert suppression: checks receipt_events for a recent ai_health_alert row
 * so the same degradation window only fires one Slack message.
 *
 * Requires no new tables — reads existing user_events and receipt_events.
 */

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function sendAlert(text: string) {
  const webhookUrl = process.env.UPGRADE_FAILURE_ALERT_WEBHOOK;
  if (!webhookUrl) return;
  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

export default async function handler() {
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch (err) {
    console.error("[HealthCheckAI] Supabase init failed:", err instanceof Error ? err.message : err);
    return;
  }

  const windowStart = new Date(Date.now() - 30 * 60_000).toISOString();

  // Count succeeded and failed AI jobs in the last 30 minutes
  const { data: events, error } = await supabase
    .from("user_events")
    .select("event_name")
    .in("event_name", ["ai_job_succeeded", "ai_job_failed"])
    .gte("timestamp", windowStart);

  if (error) {
    console.error("[HealthCheckAI] Failed to query user_events:", error.message);
    return;
  }

  const total = events?.length ?? 0;
  const succeeded = events?.filter((e) => e.event_name === "ai_job_succeeded").length ?? 0;
  const failed = total - succeeded;
  const successRate = total > 0 ? succeeded / total : 1;

  console.log(`[HealthCheckAI] 30-min window — total:${total} succeeded:${succeeded} failed:${failed} rate:${(successRate * 100).toFixed(1)}%`);

  // Not enough samples or rate is healthy — nothing to do
  if (total < 3 || successRate >= 0.85) return;

  // Check if we already alerted in the last 30 minutes (suppress duplicates)
  const { data: recentAlert } = await supabase
    .from("receipt_events")
    .select("created_at")
    .eq("event_type", "ai_health_alert")
    .gte("created_at", windowStart)
    .limit(1)
    .maybeSingle();

  if (recentAlert) {
    console.log("[HealthCheckAI] Alert suppressed — already fired within 30-min window");
    return;
  }

  // Record the alert so future runs in this window stay quiet
  supabase.from("receipt_events").insert({
    event_type: "ai_health_alert",
    metadata: { success_rate: successRate, total, succeeded, failed },
  }).then(() => {}, () => {});

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
  await sendAlert(
    `🚨 *AI health degraded* — ${(successRate * 100).toFixed(1)}% success rate over last 30 min\n` +
    `*Jobs:* ${succeeded} succeeded / ${failed} failed (${total} total)\n` +
    `*Admin:* ${siteUrl}/admin`
  );

  console.warn(`[HealthCheckAI] Alert fired — ${(successRate * 100).toFixed(1)}% success rate (${total} jobs)`);
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
