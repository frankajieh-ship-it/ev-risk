/**
 * Unified Event Logger
 *
 * Provides a consistent schema for all event logging across the application.
 * Supports IP defensibility tagging and enterprise-ready metrics.
 */

// Valid event names for validation
export const VALID_EVENT_NAMES = [
  // Form & Input Events
  "form_submit",
  "url_autofill_attempt",

  // Navigation Events
  "blog_link_click",
  "button_click",

  // Report Events
  "report_generated",
  "report_view",

  // Scenario Save Events
  "scenario_save_clicked",
  "scenario_save_success",

  // Authentication Events
  "email_entry_start",
  "email_entry_submitted",
  "email_confirmed",

  // Feedback Events
  "feedback_helpful",
  "feedback_accuracy",
  "feedback_shown",
  "feedback_submitted",
  "why_checkpoint_shown",
  "why_checkpoint_submitted",
  "why_checkpoint_skipped",

  // Constraint Events
  "constraint_detected",
  "constraint_signal_viewed",

  // Micro Feedback Events
  "micro_feedback_shown",
  "micro_feedback_submitted",
  "micro_feedback_skipped",

  // Scroll & Engagement Events
  "scroll_depth",
  "time_on_page",

  // Copy Granular Events
  "copy_reddit_draft",
  "copy_seller_message",
  "copy_checklist",

  // SEO Page Events
  "listing_paste_submitted",

  // Email Capture Events
  "email_checklist_submit",

  // Funnel Instrumentation Events
  "landing_view",
  "cta_start_click",
  "intake_started",
  "intake_step_completed",
  "report_generate_click",
  "save_click",
  "save_success",
  "copy_click",

  // Events fired from components (previously unlisted)
  "v2_score_submit",
  "routine_step_viewed",
  "clicked_listing_receipt",
  "manual_entry_submit",

  // Receipt Events
  "receipt_generate",
  "receipt_regen",
  "receipt_history_viewed",

  // Decision Pack / Payment Events
  "deep_dive_offer_viewed",
  "deep_dive_offer_clicked",
  "deep_dive_purchase_succeeded",
  "download_pdf_clicked",
  "download_pdf_succeeded",
  "compare_started",
  "compare_bound",

  // Canonical funnel aliases (Unified Plan naming)
  "paywall_shown",
  "checkout_started",
  "checkout_completed",
] as const;

export type ValidEventName = (typeof VALID_EVENT_NAMES)[number];

// Event types for categorization
export type EventType = "user_action" | "system" | "conversion" | "feedback";

// Event payload interface
export interface EventPayload {
  event_name: ValidEventName;
  event_type: EventType;
  timestamp: string;
  session_id: string;
  visitor_id?: string;
  user_id?: string;
  page_path?: string;
  context: {
    scenario_type?: string;
    vehicle_model?: string;
    vehicle_year?: number;
    location?: string;
    fit_signal?: string;
    scenario_hash?: string;
    [key: string]: any;
  };
  tags?: {
    ip_relevance?: boolean;
    enterprise_ready?: boolean;
  };
}

// Determine event type based on event name
function getEventType(eventName: ValidEventName): EventType {
  if (
    eventName.startsWith("feedback_") ||
    eventName.startsWith("why_checkpoint_") ||
    eventName.startsWith("micro_feedback_")
  ) {
    return "feedback";
  }
  if (
    eventName === "scenario_save_success" ||
    eventName === "email_confirmed" ||
    eventName === "report_generated"
  ) {
    return "conversion";
  }
  if (eventName === "constraint_detected" || eventName === "report_view") {
    return "system";
  }
  return "user_action";
}

// Determine if event is IP-relevant (defensible insights)
function isIPRelevant(eventName: ValidEventName, context: EventPayload["context"]): boolean {
  const ipRelevantEvents: ValidEventName[] = [
    "constraint_detected",
    "scenario_save_success",
    "report_generated",
  ];

  if (ipRelevantEvents.includes(eventName)) {
    return true;
  }

  // Also mark as IP-relevant if it's a novel scenario
  if (context.is_novel_scenario === true) {
    return true;
  }

  return false;
}

// Determine if event is enterprise-ready
function isEnterpriseReady(eventName: ValidEventName, userId?: string): boolean {
  // Authenticated actions are enterprise-ready
  if (userId) {
    return true;
  }

  // Conversion events are enterprise-ready
  const enterpriseEvents: ValidEventName[] = [
    "scenario_save_success",
    "email_confirmed",
    "report_generated",
  ];

  return enterpriseEvents.includes(eventName);
}

// Validate event payload
export function validateEventPayload(
  payload: Partial<EventPayload>
): { valid: boolean; error?: string } {
  if (!payload.event_name) {
    return { valid: false, error: "event_name is required" };
  }

  if (!VALID_EVENT_NAMES.includes(payload.event_name as ValidEventName)) {
    return { valid: false, error: `Invalid event_name: ${payload.event_name}` };
  }

  if (!payload.session_id) {
    return { valid: false, error: "session_id is required" };
  }

  if (payload.timestamp && isNaN(Date.parse(payload.timestamp))) {
    return { valid: false, error: "Invalid timestamp format" };
  }

  // Check context size (max 10KB)
  if (payload.context) {
    const contextSize = JSON.stringify(payload.context).length;
    if (contextSize > 10240) {
      return { valid: false, error: "context exceeds 10KB limit" };
    }
  }

  return { valid: true };
}

// Generate visitor ID (browser fingerprint)
function generateVisitorId(): string {
  if (typeof window === "undefined") return "";

  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join("|");

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return `fp-${Math.abs(hash).toString(36)}`;
}

// Generate session ID
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Session ID storage
let cachedSessionId: string | null = null;
let cachedVisitorId: string | null = null;

function getSessionId(): string {
  if (!cachedSessionId) {
    cachedSessionId = generateSessionId();
  }
  return cachedSessionId;
}

function getVisitorId(): string {
  if (!cachedVisitorId) {
    cachedVisitorId = generateVisitorId();
  }
  return cachedVisitorId;
}

/**
 * Log an event with consistent schema
 *
 * @param eventName - The name of the event (must be in VALID_EVENT_NAMES)
 * @param context - Event context/metadata
 * @param options - Additional options (userId, custom tags)
 */
export async function logEvent(
  eventName: ValidEventName,
  context: EventPayload["context"] = {},
  options: {
    userId?: string;
    tags?: EventPayload["tags"];
    sessionId?: string;
    visitorId?: string;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined") {
    return { success: false, error: "Cannot log events server-side" };
  }

  const sessionId = options.sessionId || getSessionId();
  const visitorId = options.visitorId || getVisitorId();
  const timestamp = new Date().toISOString();

  // Build payload
  const payload: EventPayload = {
    event_name: eventName,
    event_type: getEventType(eventName),
    timestamp,
    session_id: sessionId,
    visitor_id: visitorId,
    user_id: options.userId,
    page_path: window.location.pathname,
    context,
    tags: {
      ip_relevance: isIPRelevant(eventName, context),
      enterprise_ready: isEnterpriseReady(eventName, options.userId),
      ...options.tags,
    },
  };

  // Validate
  const validation = validateEventPayload(payload);
  if (!validation.valid) {
    console.warn("[EventLogger] Validation failed:", validation.error);
    return { success: false, error: validation.error };
  }

  try {
    const response = await fetch("/api/track-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName: payload.event_name,
        eventData: {
          ...payload.context,
          event_type: payload.event_type,
          tags: payload.tags,
        },
        visitorId: payload.visitor_id,
        sessionId: payload.session_id,
        userId: payload.user_id,
        pagePath: payload.page_path,
        timestamp: payload.timestamp,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error("[EventLogger] Failed to log event:", error);
    // Fail silently - don't disrupt user experience
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Export helpers for session/visitor ID management
export { getSessionId, getVisitorId };
