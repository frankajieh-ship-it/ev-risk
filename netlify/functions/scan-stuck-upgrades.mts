/**
 * Scan Stuck Upgrades — Scheduled Retry Scanner
 *
 * Runs every 5 minutes via Netlify scheduled functions.
 * Finds receipt upgrade jobs that are stuck or failed and re-enqueues them.
 *
 * Handles three cases:
 * 1. Jobs in status "pending" or "failed" where next_retry_at <= NOW()
 *    → Re-enqueue the background function
 * 2. Jobs stuck in "processing" for > 20 minutes
 *    → Background function crashed without updating status; reset and re-enqueue
 * 3. Jobs reaching max_attempts
 *    → Move to "dead_letter", fire Slack/webhook alert
 *
 * Safe to run concurrently: background function marks receipt as "generating"
 * on start, preventing double-processing of the same receipt.
 */

import type { Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Supabase (service role — needs write access to receipt_upgrade_jobs)
// ---------------------------------------------------------------------------

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ---------------------------------------------------------------------------
// Ops alert helper
// ---------------------------------------------------------------------------

async function alertOps(subject: string, text: string) {
  // Try Slack/webhook first
  const webhookUrl = process.env.UPGRADE_FAILURE_ALERT_WEBHOOK;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  }

  // Also send email if Resend is configured
  const resendKey = process.env.RESEND_API_KEY;
  const opsEmail = process.env.OPS_ALERT_EMAIL || "hello@offolab.com";
  if (!resendKey) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "OFFO Alerts <noreply@offolab.com>",
      to: opsEmail,
      subject,
      html: `<p style="white-space:pre-wrap">${text}</p><p><small>${new Date().toISOString()}</small></p>`,
    });
  } catch {
    // Best-effort
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler() {
  const upgradeSecret = process.env.UPGRADE_SECRET;
  const baseUrl = (process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || "https://offolab.com").replace(/\/$/, "");
  const bgUrl = `${baseUrl}/.netlify/functions/upgrade-receipt-background`;

  if (!upgradeSecret) {
    console.error("[ScanStuckUpgrades] UPGRADE_SECRET not configured — aborting");
    return;
  }

  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch (err) {
    console.error("[ScanStuckUpgrades] Supabase init failed:", err instanceof Error ? err.message : err);
    return;
  }

  const now = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - 20 * 60_000).toISOString(); // 20 minutes ago
  const stats = { scanned: 0, requeued: 0, skipped: 0, dead_lettered: 0, errors: 0 };

  // -------------------------------------------------------------------------
  // 1. Jobs due for retry (pending/failed with next_retry_at <= now)
  // -------------------------------------------------------------------------
  const { data: retryJobs, error: retryErr } = await supabase
    .from("receipt_upgrade_jobs")
    .select("job_id, receipt_id, receipt_token, payload, attempt_count, max_attempts, last_error")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", now)
    .order("next_retry_at", { ascending: true })
    .limit(20);

  if (retryErr) {
    console.error("[ScanStuckUpgrades] Failed to fetch retry jobs:", retryErr.message);
  }

  // -------------------------------------------------------------------------
  // 2. Jobs stuck in "processing" for > 20 minutes (background fn crashed)
  // -------------------------------------------------------------------------
  const { data: stuckJobs, error: stuckErr } = await supabase
    .from("receipt_upgrade_jobs")
    .select("job_id, receipt_id, receipt_token, payload, attempt_count, max_attempts, last_error")
    .eq("status", "processing")
    .lt("updated_at", staleCutoff)
    .order("updated_at", { ascending: true })
    .limit(10);

  if (stuckErr) {
    console.error("[ScanStuckUpgrades] Failed to fetch stuck jobs:", stuckErr.message);
  }

  const allJobs = [...(retryJobs ?? []), ...(stuckJobs ?? [])];
  stats.scanned = allJobs.length;
  console.log(`[ScanStuckUpgrades] Found ${allJobs.length} jobs to process (${retryJobs?.length ?? 0} retry, ${stuckJobs?.length ?? 0} stuck)`);

  for (const job of allJobs) {
    try {
      // Guard: check if receipt already upgraded — don't re-run if unnecessary
      const { data: receipt } = await supabase
        .from("receipts")
        .select("generation_status")
        .eq("id", job.receipt_id)
        .maybeSingle();

      if (receipt?.generation_status === "full" || receipt?.generation_status === "succeeded") {
        // Receipt already done — mark job succeeded and move on
        await supabase.from("receipt_upgrade_jobs").update({
          status: "succeeded",
          last_error: "receipt_already_full_at_scan",
          updated_at: new Date().toISOString(),
        }).eq("job_id", job.job_id);
        stats.skipped++;
        console.log(`[ScanStuckUpgrades] Skipping job ${job.job_id} — receipt already full`);
        continue;
      }

      const attemptsDone = job.attempt_count ?? 0;
      const maxAttempts = job.max_attempts ?? 3;

      // Dead-letter if exhausted
      if (attemptsDone >= maxAttempts) {
        await supabase.from("receipt_upgrade_jobs").update({
          status: "dead_letter",
          updated_at: new Date().toISOString(),
        }).eq("job_id", job.job_id);
        stats.dead_lettered++;

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";
        await alertOps(
          `☠️ Receipt upgrade dead-lettered: ${job.receipt_id}`,
          `☠️ *Receipt upgrade DEAD-LETTERED* — ${attemptsDone}/${maxAttempts} attempts exhausted\n` +
          `Receipt: ${job.receipt_id}\nJob: ${job.job_id}\n` +
          `Last error: ${job.last_error ?? "unknown"}\nAdmin: ${siteUrl}/admin`
        );
        console.warn(`[ScanStuckUpgrades] Dead-lettered job ${job.job_id} after ${attemptsDone} attempts`);
        continue;
      }

      // Re-enqueue with updated attempt count in payload
      const retryPayload = {
        ...(job.payload as Record<string, unknown>),
        job_id: job.job_id,
        attempt_count: attemptsDone,
        t0: Date.now(),
      };

      const res = await fetch(bgUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-upgrade-secret": upgradeSecret,
        },
        body: JSON.stringify(retryPayload),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        // Background function accepted — it will update status to "processing" itself
        stats.requeued++;
        console.log(`[ScanStuckUpgrades] Re-enqueued job ${job.job_id} (attempt ${attemptsDone + 1})`);
      } else {
        // HTTP error from enqueue — mark failed with short backoff
        const backoffMs = 60_000; // 1 min, scanner will pick up again
        await supabase.from("receipt_upgrade_jobs").update({
          status: "failed",
          last_error: `scanner_enqueue_http_${res.status}`,
          attempt_count: attemptsDone + 1,
          next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("job_id", job.job_id);
        stats.errors++;
        console.warn(`[ScanStuckUpgrades] Enqueue returned ${res.status} for job ${job.job_id}`);
      }
    } catch (err) {
      stats.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ScanStuckUpgrades] Error processing job ${job.job_id}:`, msg);

      // Mark failed with short backoff so we retry at next scan
      await supabase.from("receipt_upgrade_jobs").update({
        status: "failed",
        last_error: msg.slice(0, 300),
        attempt_count: (job.attempt_count ?? 0) + 1,
        next_retry_at: new Date(Date.now() + 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("job_id", job.job_id).then(() => {}, () => {});
    }
  }

  console.log(`[ScanStuckUpgrades] Done — scanned:${stats.scanned} requeued:${stats.requeued} skipped:${stats.skipped} dead_lettered:${stats.dead_lettered} errors:${stats.errors}`);
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
