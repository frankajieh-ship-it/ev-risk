/**
 * Event tag lists shared between /api/track-event and lib/track-server-event.
 *
 * ip_relevance  — defensible insights, suitable for IP investor reporting
 * enterprise_ready — authenticated or conversion events worth highlighting
 */

export const IP_RELEVANT_EVENTS: readonly string[] = [
  "constraint_detected",
  "scenario_save_success",
  "report_generated",
  // Analytics (March 2026)
  "routine_form_completed",
  "routine_form_partial_abandon",
  "vehicle_list_generated",
  "vehicle_full_report_clicked",
  "external_link_clicked",
  "offo_dealer_viewed",
  "offo_dealer_message_sent",
  // Funnel business outcomes (added with backend event tracking spec)
  "evfit_session_created",
  "evfit_completed",
  "refine_completed",
  "shortlist_saved",
  "compare_completed",
  "listing_saved",
];

export const ENTERPRISE_READY_EVENTS: readonly string[] = [
  "scenario_save_success",
  "email_confirmed",
  "report_generated",
  "report_generated_success",
  "email_checklist_submit",
  // Analytics (March 2026)
  "routine_form_completed",
  "vehicle_list_generated",
  "vehicle_full_report_clicked",
  "offo_dealer_viewed",
  "offo_dealer_message_sent",
  // Funnel business outcomes
  "evfit_session_created",
  "evfit_completed",
  "refine_completed",
  "shortlist_saved",
  "compare_completed",
  "listing_saved",
  "garage_created",
  "anon_attached_to_user",
];

export function getEventTags(
  eventName: string,
  eventData: Record<string, unknown> | null | undefined,
  userId?: string
): { ip_relevance: boolean; enterprise_ready: boolean } {
  return {
    ip_relevance:
      IP_RELEVANT_EVENTS.includes(eventName) ||
      eventData?.is_novel_scenario === true,
    enterprise_ready:
      ENTERPRISE_READY_EVENTS.includes(eventName) || !!userId,
  };
}
