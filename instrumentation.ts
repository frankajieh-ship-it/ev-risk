/**
 * Next.js Instrumentation
 *
 * Runs once when the server starts (Node.js runtime only).
 * Used for startup validation — fails fast if required env vars are missing.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}
