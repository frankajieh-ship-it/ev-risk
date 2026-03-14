# OFFO Security Scope & Threat Model

## Systems in Scope

| System | Description |
|--------|-------------|
| Web app | Next.js 15 App Router, React 19, deployed on Netlify |
| API layer | Next.js serverless API routes (`app/api/`) |
| Database | Supabase (Postgres) — receipts, purchases, garage, events, dealer data |
| Auth | Supabase Auth — magic link / OTP; app-owned anon tokens (`receipt_token`, `psess_*`) |
| Payments | Stripe Checkout + webhooks |
| AI | OpenAI (GPT-4o) for receipt analysis and deep-dive generation |
| Share links | Public routine share links (`/share/routine/[token]`), receipt share |
| Storage | Supabase Storage (if used for uploads) |

## Data Classification

| Tier | Examples |
|------|---------|
| **Public** | Landing pages, blog content, anonymised fit scores |
| **Sensitive** | User email, ZIP/postcode, routine profile (charging habits, driving patterns), saved vehicles, VINs |
| **High Sensitivity** | Payment metadata (Stripe customer/session IDs), auth tokens, uploaded documents, dealer messages |

> Rule: treat VIN + user identity linkage as high sensitivity.

## Crown Jewels

1. **Auth** — magic link tokens, session cookies, anon session tokens
2. **Database access** — Supabase service role key, RLS enforcement
3. **Payments** — Stripe secret key, webhook secret, purchase records
4. **Dealer messaging** — inquiry threads contain personal contact details
5. **Public share links** — routine profiles exposed via token; tokens must be unguessable and owner-controlled

## Threat Model Summary

### Threat Actors
- **Unauthenticated web users** — can call all API routes; anon_id is the only identity signal
- **Malicious listing submitters** — may attempt prompt injection via vehicle make/model/description fields
- **Credential scrapers** — may attempt to enumerate receipts or purchases via predictable IDs
- **Compromised clients** — XSS could exfiltrate localStorage tokens (anon_id, receipt_token)

### Attack Surface
- API routes accept `anon_id` / `receipt_token` from request body — client-controlled, no cryptographic binding
- No RLS: a leaked Supabase anon key + direct DB query returns all rows
- Stripe checkout endpoint has no rate limit — can generate unlimited sessions
- Routine share endpoint had conditional ownership check (fixed)
- OpenAI prompts include raw user input — prompt injection risk

### Trust Boundaries
| Boundary | Trust Level |
|----------|------------|
| Supabase service role key | Fully trusted — server-only, never exposed to client |
| Supabase anon key | Untrusted — treat as public; RLS must enforce all access |
| `anon_id` / `receipt_token` | Low trust — client-generated, validated by format/age server-side |
| Stripe webhook | Trusted after `constructEvent()` signature verification |
| User-supplied text fields | Untrusted — sanitized before prompt interpolation |

## Known Gaps & Mitigations

| Gap | Severity | Status | Mitigation |
|-----|----------|--------|-----------|
| No RLS on any table | CRITICAL | Fixed — `database/migrations/enable-rls.sql` | RLS enabled; service role bypass policy added |
| Routine share ownership bypass | HIGH | Fixed — `app/api/share/routine/route.ts` | `anon_session_id` now required; check always runs |
| No rate limit on `/api/payments/checkout` | HIGH | Fixed — checkout route | 5 req/min/IP limit applied |
| `receipt_token` in localStorage (XSS risk) | MEDIUM | Partial — server-side format/age validation added | Full migration to HttpOnly cookie tracked as P1 |
| Prompt injection via user fields | MEDIUM | Fixed — prompt builder | Input stripped and capped at 200 chars before interpolation |
| CSP `unsafe-eval` | LOW | Open | Required by Next.js dev tooling; review in prod build |

## P1 Backlog (Next Round)

- Migrate `receipt_token` and `psess_*` from localStorage to HttpOnly, SameSite=Lax cookies
- Add per-user rate limits on routine run endpoint (`/api/routine/run`)
- Add CSRF protection on state-mutating API routes
- Rotate any secrets exposed in incident review
- Implement `app.anon_id` Postgres session variable for full per-row RLS policies
- Audit OpenAI response parsing for indirect prompt injection (model output reflected to DB)
