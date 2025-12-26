# EV-Risk Security Documentation

## 🔒 Security Architecture

### Trust Boundaries

```
[ Public Browser ]
        |
        | HTTPS
        v
[ offolab.com (Next.js) ]
        |
        | Server-side API calls
        v
[ Backend APIs ]
        |
        | Secure Webhooks (Stripe)
        v
[ Stripe ]
        |
        v
[ Neon Postgres ]
```

### Golden Rule
**Admin, payments, and reports NEVER trust client input**

---

## ✅ Implemented Security Measures

### 1. Transport & Network Security

#### HTTPS Enforcement
- ✅ HTTPS enforced on all routes (production)
- ✅ HSTS header with 2-year max-age
- ✅ Automatic HTTP → HTTPS redirect

#### Security Headers (middleware.ts)
```typescript
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: geolocation=(), microphone=(), camera=()
- Content-Security-Policy: (See middleware.ts)
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### 2. Admin Panel Security

#### Authentication
- ✅ API key-based authentication (server-side only)
- ✅ Key stored in environment variables
- ✅ Session storage for convenience (client-side cache only)
- ✅ Automatic logout on invalid key

#### IP Restriction (Optional)
```bash
# .env.local
ADMIN_ALLOWED_IPS=192.168.1.100,203.0.113.45
```

If set, only listed IPs can access `/admin`

#### Route Protection
- ✅ Middleware-level access control
- ✅ IP validation before route handler
- ✅ Failed access attempts logged

### 3. Stripe Security

#### Webhook Verification
- ✅ Stripe signature verification (stripe-signature header)
- ✅ Reject unsigned requests
- ✅ Failed verifications logged
- ✅ Never trust query params like `paid=true`

#### Metadata Trust
Only trust from verified Stripe events:
- `client_reference_id`
- `metadata.reportId`

**Never from browser redirects**

### 4. Report & Data Security

#### Access Control
- ✅ Reports require `status === 'paid'` OR `status === 'free'`
- ✅ UUIDs prevent guessing
- ✅ Server-side validation only
- ✅ Access denials logged with IP

#### Cache Prevention
```typescript
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
```

### 5. Database Security

#### Connection Security
- ✅ SSL/TLS enforced for all Neon connections
- ✅ Connection strings in environment variables only
- ✅ Service role key server-side only

#### Query Security
- ✅ Parameterized queries (SQL injection prevention)
- ✅ No raw string concatenation
- ✅ Status check constraints at database level

### 6. Environment Variable Hygiene

#### Server-Only Variables
```bash
STRIPE_SECRET_KEY=sk_...          # ✅ Server only
STRIPE_WEBHOOK_SECRET=whsec_...   # ✅ Server only
POSTGRES_URL=postgresql://...      # ✅ Server only
ADMIN_API_KEY=...                  # ✅ Server only
```

#### Public Variables
```bash
NEXT_PUBLIC_*=...                  # Only for non-sensitive data
```

**Never:**
- ❌ Commit .env.local to git
- ❌ Log secrets
- ❌ Return secrets in API responses

### 7. Security Monitoring & Logging

#### Events Logged
```typescript
- Failed admin login attempts
- Successful admin access
- IP-based access denials
- Stripe webhook failures
- Report access failures (401, 402, 404)
- Suspicious activity
```

#### Log Format
```json
{
  "timestamp": "2025-12-26T12:00:00.000Z",
  "type": "admin_login_failed",
  "ip": "203.0.113.45",
  "details": "Invalid admin API key"
}
```

#### Future Integration
- Datadog
- Sentry
- CloudWatch
- Custom monitoring service

---

## 🚀 Production Deployment Checklist

### Before Going Live

#### Environment Variables (Netlify)
- [ ] Set `ADMIN_API_KEY` (strong random value)
- [ ] Set `STRIPE_SECRET_KEY` (live key: `sk_live_...`)
- [ ] Set `STRIPE_WEBHOOK_SECRET` (live webhook secret)
- [ ] Set `POSTGRES_URL` (Neon production database)
- [ ] Optional: Set `ADMIN_ALLOWED_IPS` (your IP addresses)

#### Stripe Configuration
- [ ] Switch to live mode in Stripe Dashboard
- [ ] Create live webhook endpoint: `https://offolab.com/api/stripe/webhook`
- [ ] Copy webhook secret to `STRIPE_WEBHOOK_SECRET`
- [ ] Test live webhook delivery

#### Domain & HTTPS
- [ ] Domain points to Netlify
- [ ] HTTPS enabled and working
- [ ] HSTS header present (check headers)
- [ ] Force HTTPS enabled in Netlify settings

#### Security Headers
- [ ] Check headers at [securityheaders.com](https://securityheaders.com)
- [ ] Verify CSP doesn't block legitimate resources
- [ ] Test admin panel access with IP restriction

#### Testing
- [ ] Test free report flow end-to-end
- [ ] Test paid report flow with test card
- [ ] Verify PDF download requires paid/free status
- [ ] Test admin panel authentication
- [ ] Verify security logs appear for failed access

---

## 🔐 Security Best Practices

### Admin Access
1. **Use a strong admin key** (32+ characters, random)
   ```bash
   # Generate with:
   openssl rand -base64 32
   ```

2. **Rotate keys periodically** (every 90 days)

3. **Limit access** to authorized personnel only

4. **Enable IP restriction** for production

5. **Monitor logs** for suspicious activity

### Incident Response

If compromised:

1. **Immediately**:
   - [ ] Rotate `ADMIN_API_KEY`
   - [ ] Rotate `STRIPE_SECRET_KEY`
   - [ ] Disable admin access temporarily

2. **Investigate**:
   - [ ] Check security logs for timeline
   - [ ] Audit Stripe dashboard for fraud
   - [ ] Review database for unauthorized changes

3. **Notify**:
   - [ ] Inform affected users (if data exposed)
   - [ ] Update security documentation
   - [ ] Implement additional controls

### Database Access
- Never expose service role key
- Never run admin queries from client
- Always validate report status server-side
- Log all access failures

### Payment Security
- Never trust client-side payment confirmation
- Always verify via Stripe webhook
- Log all webhook failures
- Monitor for replay attacks

---

## 📊 Security Monitoring

### Key Metrics to Monitor

1. **Failed admin login attempts**
   - Threshold: >5 from same IP in 1 hour
   - Action: Temporarily block IP

2. **Unpaid report access attempts**
   - Threshold: >10 from same IP in 1 hour
   - Action: Review for suspicious patterns

3. **Webhook verification failures**
   - Threshold: Any failure
   - Action: Investigate immediately

4. **Unusual traffic patterns**
   - Large volume from single IP
   - Rapid sequential requests
   - Access to non-existent reports

### Log Analysis
```bash
# Find failed admin logins
grep "admin_login_failed" logs/security.log

# Find report access denials
grep "report_access_denied" logs/security.log

# Find webhook failures
grep "webhook_verification_failed" logs/security.log
```

---

## 🛡️ Security Maturity Roadmap

### Current: Basic Protection ✅
- HTTPS + Security headers
- Admin API key auth
- Stripe webhook verification
- Report access control
- Security logging

### Next: Enhanced Protection (After 50 users)
- [ ] 2FA for admin access
- [ ] Rate limiting (5 req/sec per IP)
- [ ] Advanced monitoring alerts
- [ ] Automated threat detection

### Future: Advanced Protection (After $5k revenue)
- [ ] WAF (Cloudflare)
- [ ] DDoS protection
- [ ] Geographic access controls
- [ ] SOC2-lite compliance

### Enterprise (For B2B customers)
- [ ] SSO integration
- [ ] Audit logs retention
- [ ] Compliance certifications
- [ ] Penetration testing

---

## 📝 Security Contact

For security vulnerabilities, please email:
**security@offolab.com**

Do NOT disclose publicly until we've had a chance to address it.

We commit to:
- Acknowledge within 24 hours
- Fix critical issues within 72 hours
- Provide credit for responsible disclosure

---

## 🔍 Security Audit History

| Date | Auditor | Findings | Status |
|------|---------|----------|--------|
| 2025-12-26 | Internal | Initial security implementation | ✅ Complete |

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Stripe Security Best Practices](https://stripe.com/docs/security)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Last Updated**: 2025-12-26
**Version**: 1.0.0
**Maintainer**: EV-Risk Security Team
