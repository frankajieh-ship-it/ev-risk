/**
 * Structured API Logger
 *
 * Emits JSON log lines with consistent schema for all API routes.
 * Each line is parseable by Netlify logs, Datadog, or any log aggregator.
 */

interface LogContext {
  endpoint: string;
  anon_id?: string;
  receipt_id?: string;
  scenario_id?: string;
  error_code?: string;
  elapsed_ms?: number;
  status?: number;
  [key: string]: unknown;
}

export function logApi(
  level: "info" | "warn" | "error",
  message: string,
  ctx: LogContext
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...ctx,
  };

  const line = JSON.stringify(entry);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Returns a function that reports elapsed milliseconds since creation.
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
