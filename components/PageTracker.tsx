"use client";

import { useEffect } from "react";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function PageTracker({ event }: { event: string }) {
  const { trackEvent } = useEventTracking();
  useEffect(() => { trackEvent(event, {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
