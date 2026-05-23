# OFFO Lab — Data Flows, Sub-Processors & Retention Policies

Last updated: 2026-05-23

---

## Sub-Processors

| Processor | Purpose | Data shared | Retention / DPA |
|-----------|---------|-------------|-----------------|
| **Supabase** | Primary database + user authentication | All user data, receipts, events, audit logs | Retained until deletion request; SOC 2 Type II certified |
| **Stripe** | Payment processing + subscription management | Email, payment method token, subscription metadata | Stripe DPA; PCI DSS compliant; no raw card data stored by OFFO |
| **Resend** | Transactional + CRM email delivery | Email address, email content | 30-day log retention; GDPR DPA available |
| **OpenAI** | AI receipt analysis, scoring | Vehicle listing text (no PII) | Zero data retention policy (API usage); no training on OFFO data |
| **Anthropic** | AI chat advisor (Ask OFFO) | Conversation messages (no PII required) | Zero data retention policy (API usage) |
| **xAI / Grok** | Chat routing classifier | Conversation messages (no PII required) | API usage only; no persistent storage |
| **Netlify** | Hosting, CDN, serverless functions | Request logs, edge IP addresses | 30-day log retention; SOC 2 Type II certified |
| **Cloudflare** | Bot protection (Turnstile) | Browser fingerprint, IP address | Cloudflare DPA; data not used for tracking |

---

## Data Flows

### 1. Receipt Generation
```
User pastes listing URL / text
  → /api/receipt/fetch (extracts vehicle data, no PII)
  → /api/score (AI scoring via OpenAI — vehicle data only)
  → receipts table (stored with schema_version, vehicle info)
  → audit_events table (receipt.viewed logged on access)
  → user_events table (receipt_result_viewed event)
```

### 2. User Authentication
```
User enters email
  → Supabase Auth (magic link via email)
  → Resend (delivers magic link)
  → Supabase session token issued (JWT, expires per Supabase config)
  → user_profiles table (created on first login)
```

### 3. Payment Flow
```
User selects paid report
  → /api/payments/checkout → Stripe Checkout session created
  → Stripe processes payment (OFFO never sees card data)
  → /api/stripe/webhook → purchase record created
  → Resend sends confirmation email
```

### 4. CRM Email
```
Scheduled job → /api/email/*/send
  → crm_email_preferences checked (suppression)
  → crm_email_sends checked (daily cap + idempotency)
  → Resend delivers email
  → crm_email_sends row inserted (status, resend_message_id)
```

### 5. Dealer Inquiry
```
Buyer submits inquiry from receipt page
  → /api/workspace/inquiries (POST)
  → inquiries table (receipt_id, dealership_id, message)
  → lib/crm-email.ts sendLeadNotification → Resend → dealer email
  → dealer_acquisition CRM sequence triggered for non-dealer buyers
```

### 6. Audit Logging
```
Any data access event (receipt view, dealer dashboard access)
  → lib/audit-logger.ts audit() [fire-and-forget]
  → audit_events table (actor_id, action, resource, result, ts)
  → RLS: service role only — no end-user access
```

---

## Retention Policies

| Data type | Retention | Deletion behavior |
|-----------|-----------|-------------------|
| `receipts` | Until account deletion | Hard-deleted on DELETE /api/user/account |
| `user_profiles` | Until account deletion | Cascade-deleted via FK on Supabase auth.users delete |
| `user_events` | Indefinite (analytics) | Pseudonymized on account deletion (IP → "0.0.0.0", event_data → {}) |
| `audit_events` | Permanent | Never deleted — immutable compliance record |
| `crm_email_sends` | Indefinite | Hard-deleted on account deletion |
| `crm_email_preferences` | Until account deletion | Hard-deleted on account deletion |
| `garage_vehicles` | Until account deletion or manual delete | Hard-deleted on account deletion |
| `purchases` | Indefinite (financial records) | Not deleted on account deletion (financial compliance) |
| `account_deletions` | Permanent | Tombstone record — never deleted |
| Supabase Auth session logs | Per Supabase config | Managed by Supabase |
| Netlify access logs | 30 days | Managed by Netlify |
| Resend delivery logs | 30 days | Managed by Resend |

---

## Security Controls

| Control | Implementation |
|---------|---------------|
| **Row-Level Security (RLS)** | Enabled on all Supabase tables; users can only read/write their own rows |
| **Service role key** | Server-only (`SUPABASE_SERVICE_ROLE_KEY`); never exposed to client |
| **Admin API key** | All `/api/admin/*` routes require `Authorization: Bearer ${ADMIN_API_KEY}` |
| **User auth** | All `/api/workspace/*` and `/api/dealer/*` routes call `requireAuth()` |
| **Bot protection** | Cloudflare Turnstile on receipt generation and report creation endpoints |
| **Rate limiting** | IP-based + session-based rate limiters on all critical API routes |
| **Cookie consent** | Analytics (GA4) only loads after explicit user consent (`offo_cookie_consent = granted`) |
| **Data export** | GDPR Art. 20 — `GET /api/user/export` (rate-limited: 3/24h) |
| **Right to erasure** | GDPR Art. 17 — `DELETE /api/user/account` (pseudonymization + hard delete) |
| **HTTPS only** | Enforced by Netlify; HSTS headers set |
| **SSRF protection** | `/api/receipt/fetch` blocks private IPs, localhost, non-HTTPS schemes |
