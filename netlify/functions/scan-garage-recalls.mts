/**
 * Garage Recall Scanner
 *
 * Runs daily at 13:00 UTC via Netlify scheduled functions.
 * For each garage vehicle (not owned EVs), fetches current NHTSA recalls,
 * upserts new ones to vehicle_recalls, and triggers recall-alert emails
 * for any newly inserted recall IDs.
 *
 * The Python recall_scanner.py handles deeper AI scoring; this function
 * covers the primary daily scan and email dispatch for all garage vehicles.
 */

import type { Config } from "@netlify/functions";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { getNhtsaRecalls } from "../../lib/nhtsa-recalls";

const BATCH_LIMIT = 200;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function alertOps(subject: string, message: string) {
  const key = process.env.RESEND_API_KEY;
  const opsEmail = process.env.OPS_ALERT_EMAIL || "hello@offolab.com";
  if (!key) return;
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: "OFFO Alerts <noreply@offolab.com>",
      to: opsEmail,
      subject,
      html: `<p>${message}</p><p><small>Sent from Netlify scheduled function — ${new Date().toISOString()}</small></p>`,
    });
  } catch {
    // Best-effort
  }
}

export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || "https://offolab.com";
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error("[scan-garage-recalls] ADMIN_API_KEY not set — aborting");
    await alertOps(
      "⚠️ scan-garage-recalls: missing ADMIN_API_KEY",
      "The scheduled garage recall scan could not run because ADMIN_API_KEY is not set."
    );
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[scan-garage-recalls] Supabase not configured");
    return;
  }

  const results = { vehicles: 0, recalls_found: 0, new_recalls: 0, emails_sent: 0, errors: 0 };

  // Fetch garage vehicles that have make/model/year and are not owned EVs
  const { data: vehicles, error: fetchErr } = await supabase
    .from("garage_vehicles")
    .select("id, user_id, make, model, year")
    .eq("is_owned_ev", false)
    .not("make", "is", null)
    .not("model", "is", null)
    .not("year", "is", null)
    .limit(BATCH_LIMIT);

  if (fetchErr || !vehicles?.length) {
    console.log("[scan-garage-recalls] No vehicles to scan or error:", fetchErr?.message);
    return;
  }

  for (const vehicle of vehicles) {
    results.vehicles++;
    try {
      const recallResult = await getNhtsaRecalls(
        vehicle.make as string,
        vehicle.model as string,
        vehicle.year as number
      );

      if (!recallResult || recallResult.recall_count === 0) continue;

      results.recalls_found += recallResult.recall_count;

      const newRecallIds: string[] = [];

      for (const recall of recallResult.recalls) {
        if (!recall.campaign_number) continue;

        const isSafetyCritical = recall.park_it || recall.park_outside;

        const { error: upsertErr, data: upserted } = await supabase
          .from("vehicle_recalls")
          .upsert(
            {
              vehicle_id: vehicle.id,
              user_id: vehicle.user_id,
              recall_id: recall.campaign_number,
              source: "nhtsa",
              title: recall.component || recall.campaign_number,
              description: recall.summary,
              consequence: recall.consequence,
              remedy: recall.remedy,
              component: recall.component,
              recall_date: recall.report_date ? recall.report_date.split("T")[0] : null,
              is_safety_critical: isSafetyCritical,
              // Default scoring; Python scanner will override with AI scores
              routine_impact_score: isSafetyCritical ? 8 : 4,
              ai_summary: recall.summary?.slice(0, 200) || null,
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "vehicle_id,recall_id", ignoreDuplicates: true }
          )
          .select("id, recall_id");

        if (upsertErr) {
          console.error("[scan-garage-recalls] Upsert error:", upsertErr.message);
          continue;
        }

        // ignoreDuplicates=true means upserted is empty for existing rows
        if (upserted?.length) {
          newRecallIds.push(recall.campaign_number);
          results.new_recalls++;
        }
      }

      // Send email for new recalls only
      if (newRecallIds.length > 0) {
        try {
          const res = await fetch(`${siteUrl}/api/email/recall-alert`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${adminKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vehicle_id: vehicle.id,
              user_id: vehicle.user_id,
              new_recall_ids: newRecallIds,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.sent) results.emails_sent++;
          } else {
            console.error(`[scan-garage-recalls] recall-alert API ${res.status} for vehicle ${vehicle.id}`);
          }
        } catch (emailErr) {
          console.error("[scan-garage-recalls] Email call failed:", emailErr instanceof Error ? emailErr.message : emailErr);
        }
      }
    } catch (err) {
      console.error("[scan-garage-recalls] Error for vehicle", vehicle.id, err instanceof Error ? err.message : err);
      results.errors++;
    }
  }

  console.log("[scan-garage-recalls] Complete:", JSON.stringify(results));

  // Log to recall_scan_log
  await supabase.from("recall_scan_log").insert({
    vehicles_scanned: results.vehicles,
    recalls_found: results.recalls_found,
    new_recalls: results.new_recalls,
    errors: results.errors,
    run_by: "cron",
  });
}

export const config: Config = {
  schedule: "0 13 * * *",
};
