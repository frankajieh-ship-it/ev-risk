/**
 * trackServerEvent — server-side event emission helper.
 *
 * Use this from API routes and server functions instead of raw
 * supabase.from("user_events").insert() calls.
 *
 * Features:
 * - Deterministic dedupe_key (prevents double-counting on retries)
 * - ip_relevance / enterprise_ready tagging via shared event-tags lists
 * - Silently ignores duplicate key constraint (Postgres 23505)
 * - Never throws — always fire-and-forget safe
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getEventTags } from "@/lib/event-tags";

export type EventSource =
  | "evfit"
  | "refine"
  | "garage"
  | "compare"
  | "listing"
  | "auth"
  | "share"
  | "ai";

export interface ServerEventInput {
  event_name: string;
  source: EventSource;
  /** Persistent anonymous session ID (offo_persistent_session / psess_*) */
  anon_id?: string | null;
  /** Tab-level session ID */
  session_id?: string | null;
  /** Supabase user UUID — null for anonymous events */
  user_id?: string | null;
  /** e.g. "/api/routine/run" */
  page_path?: string;
  /** Entity type for dedupe_key — e.g. "fit_session_id", "garage_item_id" */
  entity_type?: string;
  /** Entity UUID — e.g. run_id */
  entity_id?: string;
  /**
   * Increment this if you intentionally want a second event for the same
   * entity+session (e.g. version=1 for a retry). Default 0.
   */
  version?: number;
  payload: Record<string, unknown>;
}

/**
 * Emit a server-side event to user_events.
 *
 * dedupe_key format:
 *   `${event_name}:${entity_type||"_"}:${entity_id||"_"}:${session_id||"_"}:${version||0}`
 *
 * This is idempotent — duplicate inserts with the same dedupe_key are
 * silently swallowed (Postgres unique constraint 23505).
 */
export async function trackServerEvent(input: ServerEventInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const {
      event_name,
      source,
      anon_id,
      session_id,
      user_id,
      page_path,
      entity_type,
      entity_id,
      version = 0,
      payload,
    } = input;

    const dedupe_key = [
      event_name,
      entity_type || "_",
      entity_id || "_",
      session_id || "_",
      String(version),
    ].join(":");

    const tags = getEventTags(event_name, payload, user_id ?? undefined);

    const row: Record<string, unknown> = {
      event_name,
      source,
      anon_id: anon_id ?? null,
      session_id: session_id ?? null,
      user_id: user_id ?? null,
      page_path: page_path ?? null,
      dedupe_key,
      timestamp: new Date().toISOString(),
      event_data: {
        ...payload,
        _tags: tags,
        _source: source,
        _anon_id: anon_id ?? null,
      },
      ip_relevance: tags.ip_relevance,
      enterprise_ready: tags.enterprise_ready,
    };

    const { error } = await supabase.from("user_events").insert(row);

    if (error && error.code !== "23505") {
      // 23505 = unique_violation (dedupe) — expected and silent
      // Log other errors but never throw
      console.warn(`[trackServerEvent] ${event_name} insert failed:`, error.code, error.message);
    }
  } catch (err) {
    // Never propagate — tracking must not break the calling route
    console.warn("[trackServerEvent] Unexpected error:", err instanceof Error ? err.message : err);
  }
}
