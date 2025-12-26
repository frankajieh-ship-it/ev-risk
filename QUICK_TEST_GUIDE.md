# Quick Test Guide - Stripe Payment Flow

## 🎯 End-to-End Payment Test

### Prerequisites (Already Running ✅):
- ✅ Dev server: http://localhost:3000
- ✅ Webhook listener: `./stripe.exe listen --forward-to localhost:3000/api/stripe/webhook`

---

## 📝 Step-by-Step Test

### 1. Generate a Test Report
1. Open browser: http://localhost:3000
2. Enter test data:
   - **Year:** 2021
   - **Make:** Tesla
   - **Model:** Model 3
   - **State:** CA
   - **ZIP:** 94103
3. Click **"Analyze Risk"**
4. Wait for free preview to load

### 2. Click "Get Full Report"
- Look for the **"Get Full Report - $15"** button
- Click it to initiate checkout
- Should redirect to Stripe Checkout page

### 3. Complete Test Payment
Use these **test card details**:

```
Card Number:    4242 4242 4242 4242
Expiration:     12/34 (any future date)
CVC:            123 (any 3 digits)
ZIP:            90210 (any 5 digits)
Email:          test@example.com
```

**Other test cards:**
- ✅ Success: `4242 4242 4242 4242`
- ❌ Decline: `4000 0000 0000 0002`
- ⚠️ 3D Secure: `4000 0027 6000 3184`

### 4. Verify Success
After payment:
- ✅ Redirected to `/report?payload=...&paid=true`
- ✅ Full report visible (no paywall)
- ✅ Check terminal for webhook logs

### 5. Check Webhook Logs
In your terminal running `stripe listen`, you should see:
```
--> checkout.session.completed [evt_...]
<-- [200] POST http://localhost:3000/api/stripe/webhook
```

In the dev server terminal, you should see:
```
✅ Order fulfilled: {
  sessionId: 'cs_test_...',
  reportId: '...',
  customerEmail: 'test@example.com',
  amountPaid: '$15',
  timestamp: '...'
}
```

---

## 🔍 What to Check

### ✅ Success Indicators:
- [ ] Stripe Checkout page loads
- [ ] Payment processes without errors
- [ ] Redirects to report page
- [ ] URL contains `?paid=true`
- [ ] Full report content visible
- [ ] Webhook returns 200 OK
- [ ] Fulfillment logs appear in terminal
- [ ] No console errors

### ⚠️ Common Issues:

**Checkout doesn't load:**
- Check dev server is running on :3000
- Check console for errors
- Verify STRIPE_SECRET_KEY in .env.local

**Payment succeeds but no webhook:**
- Check `stripe listen` is running
- Verify STRIPE_WEBHOOK_SECRET matches
- Check terminal for webhook errors

**Signature verification fails:**
- Restart dev server after updating .env.local
- Ensure webhook secret is correct
- Check no extra spaces in .env.local

---

## 🧪 Additional Tests

### Test 1: Declined Card
```
Card: 4000 0000 0000 0002
Expected: Payment declined, stays on Stripe page
```

### Test 2: Cancel Payment
```
1. Start checkout
2. Click browser back button
3. Should return to /report?canceled=true
```

### Test 3: Multiple Reports
```
1. Generate report for 2020 Nissan Leaf
2. Purchase ($15)
3. Generate report for 2022 Ford Mach-E
4. Purchase ($15)
5. Check webhook received 2 fulfillment logs
```

---

## 📊 Stripe Dashboard

Check your test payments:
1. Visit: https://dashboard.stripe.com/test/payments
2. You should see all test payments
3. Click on a payment to see details
4. Check webhook delivery under "Events"

---

## 🎉 What Success Looks Like

### Terminal Output:
```
Dev Server:
 POST /api/checkout 200 in 3.9s
 POST /api/stripe/webhook 200 in 9ms
✅ Order fulfilled: {...}

Stripe CLI:
2025-12-26 06:45:51   --> checkout.session.completed
2025-12-26 06:45:51  <--  [200] POST http://localhost:3000/api/stripe/webhook
```

### Browser:
```
Before payment: /report?payload=... (paywall visible)
After payment:  /report?payload=...&paid=true (full content)
```

---

## 🔗 Quick Links

- **Test App:** http://localhost:3000
- **Stripe Dashboard:** https://dashboard.stripe.com/test/dashboard
- **Payments:** https://dashboard.stripe.com/test/payments
- **Webhooks:** https://dashboard.stripe.com/test/webhooks
- **API Keys:** https://dashboard.stripe.com/test/apikeys

---

## 🚨 Emergency Commands

**Restart dev server:**
```bash
# Kill current server
taskkill //F //PID <pid>

# Start new server
cd /c/Dev/ev-risk && npm run dev
```

**Restart webhook listener:**
```bash
# Kill current listener (Ctrl+C in terminal)

# Start new listener
cd /c/Dev/ev-risk && ./stripe.exe listen --forward-to localhost:3000/api/stripe/webhook
```

**Check what's running:**
```bash
# Check port 3000
netstat -ano | findstr ":3000"

# Check Stripe processes
tasklist | findstr "stripe"
```

---

## 📝 Notes

- All test payments use **test mode** (no real money)
- Test data is visible only in test mode dashboard
- Test webhooks are isolated from production
- You can refund test payments (practice for production)

---

**Last Updated:** 2025-12-26 06:50 PST
**Status:** Ready for Testing ✅
