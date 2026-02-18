"use client";

import { useEventTracking } from "@/hooks/useEventTracking";
import { useHumanSignals } from "@/hooks/useHumanSignals";

export function HumanSignalCollector() {
  const { trackEvent } = useEventTracking();
  useHumanSignals(trackEvent);
  return null;
}
