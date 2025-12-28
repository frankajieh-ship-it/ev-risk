/**
 * Confidence State Visibility - Debug Utilities
 *
 * Purpose: Devs can see confidence changes without exposing UI
 * Enabled only when:
 * - process.env.NODE_ENV !== "production" AND query param ?debug=1
 * - OR NEXT_PUBLIC_DEBUG_OK=1 AND query param ?debug=1
 *
 * Usage: Add ?debug=1 to URL in development
 */

/**
 * Check if debug mode is enabled
 *
 * Requires:
 * 1. Query param ?debug=1 in URL
 * 2. Either development mode OR NEXT_PUBLIC_DEBUG_OK=1 env var
 */
export function isDebugEnabled(): boolean {
  // Server-side: always false
  if (typeof window === "undefined") return false;

  try {
    // Check query parameter
    const qp = new URLSearchParams(window.location.search);
    const byQuery = qp.get("debug") === "1";

    // Must have ?debug=1
    if (!byQuery) return false;

    // Check environment
    const isDevelopment = process.env.NODE_ENV !== "production";
    const allowedInProd = process.env.NEXT_PUBLIC_DEBUG_OK === "1";

    return isDevelopment || allowedInProd;
  } catch {
    return false;
  }
}

/**
 * Debug logger (only logs when debug is enabled)
 *
 * @param args - Arguments to log
 */
export function debugLog(...args: any[]) {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);

  // eslint-disable-next-line no-console
  console.log(
    `%c[EV-RISK DEBUG ${timestamp}]`,
    "color: #3b82f6; font-weight: bold;",
    ...args
  );
}

/**
 * Debug warn (only logs when debug is enabled)
 */
export function debugWarn(...args: any[]) {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);

  // eslint-disable-next-line no-console
  console.warn(
    `%c[EV-RISK WARN ${timestamp}]`,
    "color: #f59e0b; font-weight: bold;",
    ...args
  );
}

/**
 * Debug error (only logs when debug is enabled)
 */
export function debugError(...args: any[]) {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);

  // eslint-disable-next-line no-console
  console.error(
    `%c[EV-RISK ERROR ${timestamp}]`,
    "color: #ef4444; font-weight: bold;",
    ...args
  );
}

/**
 * Debug table (formatted data display)
 */
export function debugTable(data: any) {
  if (!isDebugEnabled()) return;

  debugLog("Table:");
  // eslint-disable-next-line no-console
  console.table(data);
}

/**
 * Debug group (collapsible logs)
 */
export function debugGroup(label: string, callback: () => void) {
  if (!isDebugEnabled()) return;

  // eslint-disable-next-line no-console
  console.group(`[EV-RISK] ${label}`);
  callback();
  // eslint-disable-next-line no-console
  console.groupEnd();
}

/**
 * Performance measurement helper
 */
export function debugMeasure(label: string): () => void {
  if (!isDebugEnabled()) return () => {};

  const start = performance.now();

  return () => {
    const duration = performance.now() - start;
    debugLog(`⏱️ ${label}:`, `${duration.toFixed(2)}ms`);
  };
}

/**
 * Confidence change tracker
 *
 * Logs when confidence changes and why
 */
export interface ConfidenceChange {
  from: number | null;
  to: number;
  delta?: number;
  inputs: Record<string, any>;
  timestamp: number;
}

export function logConfidenceChange(change: ConfidenceChange) {
  if (!isDebugEnabled()) return;

  const { from, to, inputs } = change;

  if (from === null) {
    debugLog("🎯 Confidence (initial):", `${(to * 100).toFixed(1)}%`, {
      inputs,
    });
  } else {
    const delta = to - from;
    const deltaPercent = (delta * 100).toFixed(1);
    const arrow = delta > 0 ? "↑" : "↓";

    debugLog(
      `🎯 Confidence changed:`,
      `${(from * 100).toFixed(1)}% → ${(to * 100).toFixed(1)}%`,
      `(${arrow} ${Math.abs(parseFloat(deltaPercent))}%)`,
      {
        inputs,
        changedFields: getChangedFields(inputs),
      }
    );
  }
}

/**
 * Helper to identify which fields changed
 * (Simplified - compares against previous snapshot)
 */
function getChangedFields(inputs: Record<string, any>): string[] {
  // In a real implementation, compare against previous inputs
  // For now, return all non-empty fields
  return Object.entries(inputs)
    .filter(([_, value]) => value !== "" && value !== null && value !== undefined)
    .map(([key]) => key);
}

/**
 * Debug badge component (dev-only UI indicator)
 *
 * Shows confidence value in corner when debug mode enabled
 */
export function DebugBadge({ confidence }: { confidence: number }) {
  if (!isDebugEnabled()) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-mono">
      <div className="font-bold">DEBUG MODE</div>
      <div>Confidence: {(confidence * 100).toFixed(1)}%</div>
      <div className="text-blue-200 text-[10px]">
        Add ?debug=0 to hide
      </div>
    </div>
  );
}
