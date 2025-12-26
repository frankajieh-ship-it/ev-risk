# EV-Risk™ Day 2 Launch Checklist

## Current Status: ✅ Day 1 Complete

### What's Working:
- ✅ Scoring system validated (2018 Leaf = RED, Bolt shows recalls)
- ✅ All critical fixes implemented (air-cooled battery, recalls, no-home penalty)
- ✅ Input form functional with realistic defaults
- ✅ Results page displaying scores correctly
- ✅ Stripe integration code ready (needs API keys)
- ✅ Dev server running on localhost:3002

---

## DAY 2 TASKS

### MORNING (9 AM - 12 PM): Results Page Polish

#### 1. Score Context Enhancements (30 min)
**File:** [app/report/page.tsx](app/report/page.tsx)

- [ ] Add percentile comparison ("Better than 60% of similar vehicles")
- [ ] Add typical score range for model/year
- [ ] Add visual score bars with colors (green/yellow/red)
- [ ] Add vehicle header with icons (mileage, location, age)

**Reference:** [RESULTS_PAGE_ROADMAP.md](RESULTS_PAGE_ROADMAP.md) lines 27-95

#### 2. Component Score Cards (45 min)
- [ ] Enhance battery risk card with visual bar + key factors
- [ ] Add emoji indicators (⚠️ for high risk, ✅ for good)
- [ ] Improve replacement cost display with context
- [ ] Add platform risk flags for critical recalls
- [ ] Enhance ownership fit with climate/charging details

**Reference:** [RESULTS_PAGE_ROADMAP.md](RESULTS_PAGE_ROADMAP.md) lines 97-184

#### 3. Quick Wins (15 min)
- [ ] Test mobile responsiveness
- [ ] Verify print/PDF functionality
- [ ] Test share button on mobile/desktop
- [ ] Check all emoji rendering correctly

---

### AFTERNOON (1 PM - 4 PM): Stripe Setup & Testing

#### 4. Stripe Configuration (30 min)
**Follow:** [STRIPE_SETUP_GUIDE.md](STRIPE_SETUP_GUIDE.md)

```bash
# Install SDK
npm install stripe

# Create .env.local
cp .env.local.example .env.local

# Add your keys (from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Restart dev server
# (Stop current server, then: npm run dev)
```

- [ ] Install Stripe SDK
- [ ] Create Stripe test account
- [ ] Add API keys to .env.local
- [ ] Restart dev server
- [ ] Verify `/api/checkout` returns `stripe_enabled: true`

#### 5. Webhook Testing (30 min)
```bash
# Install Stripe CLI
scoop install stripe  # or download from GitHub

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3002/api/stripe/webhook
# Copy the webhook secret (whsec_...) to .env.local
```

- [ ] Install Stripe CLI
- [ ] Run `stripe listen --forward-to localhost:3002/api/stripe/webhook`
- [ ] Copy webhook secret to .env.local
- [ ] Restart dev server
- [ ] Test: `stripe trigger checkout.session.completed`
- [ ] Verify server logs show "✅ Order fulfilled"

#### 6. End-to-End Payment Test (30 min)
- [ ] Generate test report (Tesla Model 3, 2021, ZIP 94103)
- [ ] Click "Get Full Report - $15"
- [ ] Verify redirect to Stripe Checkout
- [ ] Pay with test card: `4242 4242 4242 4242` (exp: 12/34, CVC: 123)
- [ ] Verify redirect to report with `?paid=true`
- [ ] Verify webhook logs "✅ Order fulfilled"
- [ ] Test cancel flow (click back button on Stripe)

---

### LATE AFTERNOON (4 PM - 6 PM): Trust & Credibility

#### 7. Enhanced Paid Upsell CTA (45 min)
**File:** [app/report/page.tsx](app/report/page.tsx) line 283

- [ ] Replace existing CTA with enhanced version from roadmap
- [ ] Add gradient background with pattern
- [ ] Add 6 features + 3 "Why Upgrade" benefits
- [ ] Add social proof ("450+ buyers", 4.9★ rating)
- [ ] Add trust signals (secure checkout, instant delivery, PDF format)
- [ ] Add money-back guarantee text

**Reference:** [RESULTS_PAGE_ROADMAP.md](RESULTS_PAGE_ROADMAP.md) lines 251-379

#### 8. Trust Indicators Footer (30 min)
- [ ] Add 4-column trust grid (data updated, data points, privacy, disclaimer)
- [ ] Enhance data sources section with 3-column breakdown
- [ ] Add professional disclaimer with warning icon
- [ ] Add "Full methodology →" link (optional page)

**Reference:** [RESULTS_PAGE_ROADMAP.md](RESULTS_PAGE_ROADMAP.md) lines 448-592

#### 9. Optional: Testimonials Section (30 min)
- [ ] Add 3-card testimonial grid
- [ ] Use realistic buyer personas (John M., Sarah K., David L.)
- [ ] Add 5-star ratings
- [ ] Add "Verified Buyer" badges

**Reference:** [RESULTS_PAGE_ROADMAP.md](RESULTS_PAGE_ROADMAP.md) lines 381-423

---

### EVENING (6 PM - 8 PM): Final Testing & Launch Prep

#### 10. Comprehensive Testing

**Technical:**
- [ ] All 5 test vehicles return realistic scores
- [ ] 2018 Leaf AZ scores RED (38/100) ✅
- [ ] 2020 Bolt MI shows 1 critical recall ✅
- [ ] 2021 Model 3 CA scores GREEN (86/100) ✅
- [ ] 2019 i3 NYC applies no-home penalty ✅
- [ ] 2022 Mach-E TX scores borderline (75/100) ✅
- [ ] No vehicles from year 2025+ possible in dropdown
- [ ] Current mileage affects degradation correctly
- [ ] Climate zones work for all test ZIPs
- [ ] Recall detection working (Bolt, Mach-E)

**UX:**
- [ ] Mobile responsive on iPhone/Android
- [ ] Print functionality works (Command/Ctrl+P)
- [ ] Share button functional (native share API + clipboard fallback)
- [ ] Score bars animate smoothly
- [ ] All placeholder text replaced with real content
- [ ] Emoji rendering correctly (🟢🟡🔴)
- [ ] No console errors in browser DevTools

**Monetization:**
- [ ] Stripe checkout functional (test mode)
- [ ] Payment succeeds with test card 4242 4242 4242 4242
- [ ] Paid report CTA visible and compelling
- [ ] Pricing clearly displayed ($15)
- [ ] Trust indicators prominent
- [ ] Money-back guarantee mentioned

**Legal:**
- [ ] Professional disclaimer on report page
- [ ] Data source citations complete
- [ ] "Not financial/legal advice" warning present
- [ ] "Always get professional inspection" in bold

**Performance:**
- [ ] Page load < 3 seconds
- [ ] Scoring calculation < 500ms
- [ ] No memory leaks (check DevTools Performance tab)
- [ ] Lighthouse score > 90 (run in Incognito mode)

#### 11. Pre-Launch Data Review
- [ ] Review all CSV files for completeness
- [ ] Verify ZIP prefixes quoted correctly
- [ ] Check recall severity classifications
- [ ] Verify battery chemistry map covers common models
- [ ] Ensure range data includes top 30 EVs

#### 12. Create Launch Announcement Draft
```markdown
# EV-Risk™ Launch Announcement

**We're live!** EV-Risk™ helps used EV buyers assess battery risk, recalls, and ownership fit in 2 minutes.

🎯 **Free Features:**
- Overall risk score (0-100) with GREEN/YELLOW/RED verdict
- Battery degradation estimate
- Critical recall detection
- Climate impact assessment
- Charging infrastructure analysis

💎 **$15 Full Report:**
- Printable detailed analysis
- Price negotiation script
- Pre-purchase inspection checklist
- Dealer questions guide
- Battery health verification steps
- 5-year TCO estimate

🔬 **Data Sources:**
- 10,000+ owner reports
- NHTSA recall database
- Geotab battery study (6,300 vehicles)
- NOAA climate data
- US DOE charging infrastructure

⚠️ **Always get a professional inspection** from a certified EV technician before purchasing.

Try it now: [link]
```

---

## Success Criteria

### Minimum Viable Launch:
- ✅ Scoring system accurate (validated with 5 real scenarios)
- ✅ Stripe payments functional (test mode working)
- ✅ Results page professional and trustworthy
- ✅ Mobile responsive
- ✅ No major bugs or console errors
- ✅ Legal disclaimers in place

### Nice-to-Have (Can Add Post-Launch):
- Email fulfillment (webhook logs are enough Day 1)
- PDF generation (browser print works fine)
- Database storage (can add after first sales)
- Analytics (GA/Plausible can wait)
- A/B testing (test pricing later)

---

## Launch Blockers (Must Fix Before Live)

### Critical Issues (HALT if found):
- [ ] Scoring wildly inaccurate for common models
- [ ] Payment processing fails with test card
- [ ] Mobile completely broken
- [ ] Legal disclaimer missing
- [ ] Site crashes on common browsers

### Non-Blockers (Can Fix Post-Launch):
- Minor UI polish
- Additional test coverage
- Email notifications
- PDF generation
- Advanced analytics

---

## Post-Launch Monitoring (Week 1)

### Metrics to Track:
- [ ] Unique visitors
- [ ] Reports generated (free)
- [ ] Conversion rate (free → paid)
- [ ] Revenue
- [ ] Average score by model
- [ ] Most common ZIP codes
- [ ] Payment failures (if any)

### User Feedback Channels:
- [ ] Add feedback form link
- [ ] Monitor support email
- [ ] Watch for social media mentions
- [ ] Check Stripe dispute rate (should be 0%)

---

## Emergency Contacts

**Stripe Support:**
- Dashboard: https://dashboard.stripe.com
- Support: https://support.stripe.com
- Docs: https://stripe.com/docs

**Hosting/Deployment:**
- Vercel Dashboard: [if using Vercel]
- Domain Registrar: [where domain is registered]

---

## Day 2 Time Budget

| Task | Estimated Time | Priority |
|------|----------------|----------|
| Results page polish | 1.5 hours | High |
| Stripe setup | 1.5 hours | High |
| Enhanced CTA | 45 min | High |
| Trust indicators | 30 min | Medium |
| Testimonials | 30 min | Low (skip if tight) |
| Final testing | 2 hours | Critical |
| **TOTAL** | **6-7 hours** | - |

**Recommended Schedule:**
- 9 AM - 12 PM: Results page (3 hours)
- 12 PM - 1 PM: Lunch break
- 1 PM - 4 PM: Stripe setup (3 hours)
- 4 PM - 6 PM: Testing (2 hours)
- **Launch:** 6 PM or next morning

---

## Ready to Launch Checklist

Before announcing publicly:

- [ ] Free scoring works for 10+ different vehicles
- [ ] Paid checkout works with test card
- [ ] Mobile tested on real devices (not just DevTools)
- [ ] Legal disclaimers reviewed
- [ ] Stripe webhook confirmed working
- [ ] Domain pointing to production (if custom domain)
- [ ] Analytics installed (optional but recommended)
- [ ] Support email configured
- [ ] Launch announcement draft ready

---

**Status:** ✅ Day 1 Complete, Ready for Day 2
**Next Action:** Start with results page enhancements tomorrow morning
**Estimated Launch:** End of Day 2 (tomorrow evening) or Day 3 morning
