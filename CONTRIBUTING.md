# Contributing to OFFO (ev-risk)

## Prerequisites

- Node.js 20+
- A Supabase project (see `.env.local.example`)
- Stripe CLI (for testing webhooks locally)

## Getting started locally

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.local.example .env.local

# 3. Start dev server
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment variables

See `CLAUDE.md` for the full variable reference. At minimum you need:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
UPGRADE_SECRET=
ADMIN_API_KEY=
```

## Running tests

```bash
# Unit + integration (all test directories)
npm test

# Watch mode
npm run test:watch
```

Tests live in `__tests__/` (unit/integration) and `tests/` (golden sets, performance). Both directories are picked up automatically by `jest.config.js`.

## Testing Stripe webhooks locally

The repo includes a Stripe CLI binary at `stripe.zip`. Unzip it, then:

```bash
# Forward Stripe events to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger a specific event
stripe trigger checkout.session.completed
```

The `STRIPE_WEBHOOK_SECRET` for local dev is printed by `stripe listen` on startup (starts with `whsec_`).

## Testing background functions locally

Background functions (PDF generation, AI upgrade pipeline) require Netlify CLI:

```bash
npm install -g netlify-cli
netlify dev
```

The background function endpoint will be available at `http://localhost:8888/.netlify/functions/upgrade-receipt-background`.

**Important Netlify constraints:**
- Synchronous functions: 60-second timeout
- Background functions: 900-second timeout
- Background functions use `.mts` extension (ESM) — import paths require `.js` extension even for TypeScript files

## Branch and PR workflow

- Branch from `main`: `git checkout -b feat/my-feature`
- Keep PRs focused — one logical change per PR
- All PRs must pass CI (lint + type check + unit tests + build) before merge
- Squash merge preferred to keep `main` history clean

## Pre-commit hooks

Husky runs `eslint --fix` on staged `.ts`/`.tsx` files automatically on commit. If ESLint reports unfixable errors, the commit is blocked. Fix the reported issues, re-stage, and commit again.

## Key invariants

1. **Never skip the receipt token check** — `isValidReceiptToken()` in `lib/session-utils.ts` is the gating mechanism for all AI generation
2. **Turnstile must fail closed** — if `guardTurnstile()` throws, it returns `passed: false` (not `true`)
3. **Admin routes require `ADMIN_API_KEY`** — no fallback defaults; missing key = 401
4. **Supabase admin client** (`getSupabaseAdmin()`) bypasses RLS — never expose it to client-side code
5. **Background function payload** — must include `input`, `receipt_id`, `receipt_token`, `rule_signals`, `is_pro`

## Adding a blog post

1. Add an entry to `lib/blog.ts` `BLOG_POSTS` array (newest first)
2. Create `app/blog/[your-slug]/` with `page.tsx` (content) and `layout.tsx` (metadata + JSON-LD)
3. Use `getPostBySlug("your-slug")` in `layout.tsx` to populate OG tags and BlogPosting structured data
4. The sitemap updates automatically

## Common gotchas

- **`supabase` (anon) vs `getSupabaseAdmin()`** — anon client respects RLS; admin bypasses it. Use admin only in server-side API routes that have already authenticated the user.
- **`is_internal` flag** — user events from internal team members have `is_internal: true`. Admin analytics exclude these automatically.
- **`receipt_cost_estimate` events** — AI generation costs are logged to `user_events` with `event_name: "receipt_cost_estimate"`. This powers the cost spike alerting in `/api/admin/summary`.
- **Netlify `.mts` imports** — background functions use `.mts` (ESM). When importing local modules, use `.js` extension: `import { foo } from "./lib/foo.js"`.
