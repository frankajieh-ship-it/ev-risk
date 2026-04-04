/**
 * Structured API Logger
 *
 * Emits JSON log lines with consistent schema for all API routes.
 * Each line is parseable by Netlify logs, Datadog, or any log aggregator.
 */

interface LogContext {
  endpoint: string;
  request_id?: string;
  anon_id?: string;
  receipt_id?: string;
  scenario_id?: string;
  error_code?: string;
  elapsed_ms?: number;
  status?: number;
  [key: string]: unknown;
}

/**
 * Extract the correlation ID from a Request or Headers object.
 * Pass this to logApi as `request_id` so all logs for a request are traceable.
 */
export function getRequestId(req: Request | Headers): string | undefined {
  const headers = req instanceof Headers ? req : req.headers;
  return headers.get("x-request-id") ?? undefined;
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

  // Drain to Logtail/BetterStack if configured (fire-and-forget)
  const logtailToken = process.env.LOGTAIL_SOURCE_TOKEN;
  if (logtailToken) {
    fetch("https://in.logtail.com/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${logtailToken}`,
        "Content-Type": "application/json",
      },
      body: line,
    }).catch(() => {}); // never throw — log drain must not affect request path
  }
}

/**
 * Returns a function that reports elapsed milliseconds since creation.
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
