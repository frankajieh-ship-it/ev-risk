/**
 * Environment variable validation
 *
 * Validates required server-side env vars at startup via instrumentation.ts.
 * Throws on missing required vars so the process fails fast with a clear message
 * instead of crashing later with a cryptic error.
 *
 * Call validateEnv() from instrumentation.ts `register()` — runs once on boot.
 */

const REQUIRED = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "UPGRADE_SECRET",
  "ADMIN_API_KEY",
] as const;

const OPTIONAL = [
  "RESEND_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "PDF_RENDER_SECRET",
  "OPS_ALERT_EMAIL",
  "TURNSTILE_SECRET_KEY",
] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables:\n  ${missing.join("\n  ")}\n` +
        `Add these to your .env.local or Netlify environment settings.`
    );
  }

  const missingOptional: string[] = [];
  for (const key of OPTIONAL) {
    if (!process.env[key]) {
      missingOptional.push(key);
    }
  }

  if (missingOptional.length > 0) {
    console.warn(
      `[env] Optional env vars not set (some features may be disabled):\n  ${missingOptional.join("\n  ")}`
    );
  }
}
