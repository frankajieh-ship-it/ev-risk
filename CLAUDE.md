# CLAUDE.md — ev-risk / OFFO

This file gives Claude Code (and human contributors) the context needed to work effectively in this codebase.

## Architecture Overview

OFFO is a Next.js 16 (App Router) + Supabase + Stripe SaaS that analyzes used EV listings.

### Core Request Flow

```
User pastes listing text
  → POST /api/receipt          (Next.js Route Handler, 60s timeout)
      → Saves lite receipt to Supabase (immediate)
      → Returns 200 to client with receipt_id
      → Fire-and-forget: POST /.netlify/functions/upgrade-receipt-background

Background Function (up to 15 min, runs outside sync window):
  → Calls AI pipeline (OpenAI + Anthropic + Grok via circuit breaker)
  → Updates receipt in Supabase (generation_status: lite → ai_upgraded)
  → Client polls /api/receipt/status until upgrade complete
```

### Auction Flow (Copart)

```
/app/copart → POST /api/auction/analyze (60s)
  → 4-stage pipeline: Grok classify → parallel (Gemini + GPT-4o) → Grok synthesis
  → Saves to auction_results table
  → POST /api/auction/save/[resultId] persists
```

### Key Architectural Invariants

- **Background functions use `.js` import extensions** — `tsconfig` for Netlify functions emits CommonJS with explicit `.js` paths. Do NOT remove `.js` from imports in `netlify/functions/*.ts` files (e.g., `import { foo } from "../../lib/bar.js"`).
- **Netlify function timeouts**: sync functions = 60s, background function (`upgrade-receipt-background`) = 900s (15 min), scheduled functions = 60s. Set in `netlify.toml`.
- **`next build` succeeds without runtime env vars** — `validateEnv()` in `instrumentation.ts` only fires at runtime (`NEXT_RUNTIME === "nodejs"`), not at build time.
- **Supabase client is the anon client** — `lib/supabase.ts` exports the public anon client. Admin operations use `getSupabaseAdmin()` from `lib/api-auth.ts` (service role key, server-only).

---

## Required Environment Variables

These must be set or the server will refuse to start (see `lib/env.ts`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-only, admin ops) |
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `UPGRADE_SECRET` | Shared secret between receipt route and background function |
| `ADMIN_API_KEY` | Protects `/api/admin/*` and `/api/analytics` endpoints |

## Optional Environment Variables

Missing these disables features but does not crash:

| Variable | Feature |
|----------|---------|
| `RESEND_API_KEY` | Transactional email (magic links, ops alerts, deletion confirmation) |
| `OPENAI_API_KEY` | GPT-4o for AI receipt generation |
| `ANTHROPIC_API_KEY` | Claude for AI generation |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (falls back to in-memory) |
| `PDF_RENDER_SECRET` | Protects the PDF render Netlify function |
| `OPS_ALERT_EMAIL` | Destination for scheduled function failure alerts |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile bot protection on receipt submit |
| `LOGTAIL_SOURCE_TOKEN` | BetterStack log drain |

---

## Test Commands

```bash
npm test                    # Run all tests (jest, __tests__/ and tests/)
npm test -- --watch         # Watch mode
npm test -- --testPathPattern="receipt"  # Run matching tests only
npm run lint                # ESLint
npx tsc --noEmit            # Type check without building
npm run build               # Full Next.js production build
```

Known pre-existing TS error: `__tests__/voice-compliance.test.ts` lines 211 and 233. Not introduced by this team — safe to ignore in CI.

## Running Locally

```bash
cp .env.local.example .env.local   # then fill in values
npm run dev                         # starts on :3000 (or :3002 if set)
```

### Testing Background Functions Locally

```bash
# Install Netlify CLI if needed
npm install -g netlify-cli

# Run with full Netlify context (env vars from .env.local, functions, etc.)
netlify dev
```

Background functions (`upgrade-receipt-background`) are invoked via fire-and-forget POST from the receipt route. Use `netlify dev` to test them end-to-end locally.

### Testing Stripe Webhooks Locally

The repo includes a pre-built `stripe.exe` (Windows) in the root. Or use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Then trigger test events:
stripe trigger checkout.session.completed
```

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/receipt/route.ts` | Main receipt generation (lite path + background enqueue) |
| `netlify/functions/upgrade-receipt-background.ts` | AI upgrade background function |
| `lib/providers/` | AI provider adapters (OpenAI, Anthropic, Grok, Gemini) |
| `lib/circuit-breaker.ts` | Provider failover with exponential backoff |
| `lib/turnstile.ts` | Bot protection — fails closed on network error |
| `lib/session-utils.ts` | Receipt token generation (crypto-secure, 96-bit hex) |
| `lib/api-logger.ts` | Structured JSON logger; use `getRequestId(req)` for correlation |
| `lib/env.ts` | Startup env validation |
| `middleware.ts` | Security headers, CSP, geo-detect region, correlation ID (`x-request-id`) |
| `netlify.toml` | Function timeouts, scheduled function cron expressions |
| `database/` | Supabase migration SQL files |

## Common Gotchas

1. **Don't remove `.js` from imports in `netlify/functions/`** — the TypeScript compiler for background functions targets CommonJS with explicit extensions. `import { foo } from "../../lib/bar"` will break at runtime even if it compiles.

2. **`supabase.auth.admin.*` requires service role key** — use `getSupabaseAdmin()` not the exported `supabase` client for any admin auth operations.

3. **Receipt tokens have two valid formats** — old base-36 format (`rt_<ts>_<8chars>`) and new hex format (`rt_<ts>_<24hex>`). The validator in `lib/session-utils.ts` accepts both.

4. **Turnstile is fail-closed** — a network error verifying Turnstile returns `passed: false`, blocking the request. This is intentional.

5. **`x-request-id` is set by middleware** — read it in route handlers via `getRequestId(req)` from `lib/api-logger.ts` and pass as `request_id` to `logApi()` for traceable logs.
