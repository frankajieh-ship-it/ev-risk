// debug/confTrace.ts
export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const qp = new URLSearchParams(window.location.search);
  return qp.get("debug") === "1";
}

export function confTrace(payload: Record<string, any>) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log("[EV-RISK CONF]", payload);
}

export function voiceTrace(payload: Record<string, any>) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log("[EV-RISK VOICE]", payload);
}
