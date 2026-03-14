/**
 * Audit Logger
 *
 * Fire-and-forget writes to the `audit_events` table.
 * Never throws or awaits — must not block the request path.
 *
 * Rules:
 *   - Never log raw tokens, secrets, or full email addresses
 *   - Log email domain only (e.g. "gmail.com")
 *   - Log resource identifiers, not resource contents
 */

import { supabase } from "@/lib/supabase";

type AuditResult = "ok" | "denied" | "error";
type ActorType = "anon" | "user" | "system" | "webhook";

export interface AuditEntry {
  actor_id?: string | null;
  actor_type: ActorType;
  action: string;
  resource?: string | null;
  result: AuditResult;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function audit(entry: AuditEntry): void {
  supabase
    .from("audit_events")
    .insert({
      actor_id: entry.actor_id ?? null,
      actor_type: entry.actor_type,
      action: entry.action,
      resource: entry.resource ?? null,
      result: entry.result,
      ip: entry.ip ?? null,
      user_agent: entry.user_agent ?? null,
      metadata: entry.metadata ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // Intentionally degraded: audit failure must not surface to users
        console.error("[audit] Failed to write audit event:", error.message, { action: entry.action });
      }
    });
}
