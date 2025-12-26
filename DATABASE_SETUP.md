# Database Setup Guide

## 🎯 Current Status

✅ **Code Implementation**: 100% Complete
- All endpoints created
- Database schema defined
- PDF generation ready
- Payment flow updated

⏳ **Database Configuration**: Needs Vercel Postgres setup

---

## 📋 Quick Setup (5 minutes)

### Option 1: Vercel Postgres (Recommended)

**Step 1: Create Vercel Postgres Database**
```bash
# Visit: https://vercel.com/dashboard
# 1. Go to your project
# 2. Click "Storage" tab
# 3. Click "Create Database"
# 4. Select "Postgres"
# 5. Choose region (closest to you)
# 6. Click "Create"
```

**Step 2: Get Connection Strings**
```bash
# In Vercel dashboard:
# 1. Go to Storage → Your database
# 2. Click ".env.local" tab
# 3. Copy all environment variables
```

**Step 3: Add to .env.local**
```env
# Vercel Postgres (from dashboard)
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
POSTGRES_USER="..."
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="..."

# Existing Stripe keys
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

**Step 4: Create Tables**
```bash
cd /c/Dev/ev-risk

# Run setup script
npx tsx scripts/setup-database.ts
```

**Step 5: Restart Dev Server**
```bash
# Kill current server (Ctrl+C)
# Start fresh
npm run dev
```

---

### Option 2: Local PostgreSQL (Development Only)

**If you prefer local testing first:**

```bash
# Install PostgreSQL locally
# Windows: https://www.postgresql.org/download/windows/

# Create local database
createdb ev_risk

# Update .env.local
POSTGRES_URL="postgres://localhost:5432/ev_risk"

# Run setup script
npx tsx scripts/setup-database.ts
```

---

## 🧪 Test the Complete Flow

Once database is set up:

### 1. Generate Test Report
```bash
# Visit: http://localhost:3000
# Enter test data:
#   Year: 2021
#   Make: Tesla
#   Model: Model 3
#   State: CA
#   ZIP: 94103
# Click "Analyze Risk"
```

### 2. Create Draft Report
```bash
# After scoring completes:
# Click "Get Full Report - $15"
#
# Behind the scenes:
# ✅ POST /api/report/create → creates draft in DB
# ✅ POST /api/checkout → creates Stripe session
# ✅ Redirects to Stripe checkout page
```

### 3. Complete Payment
```bash
# Use Stripe test card:
Card: 4242 4242 4242 4242
Exp:  12/34
CVC:  123
ZIP:  90210
Email: test@example.com

# After payment:
# ✅ Webhook receives checkout.session.completed
# ✅ Database updates: status = 'paid'
# ✅ Redirects to /report/[reportId]?paid=true
```

### 4. Download PDF
```bash
# On report page:
# ✅ See success message
# ✅ Click "Download PDF Report"
# ✅ PDF generates and downloads instantly
```

---

## 🔍 Verify Database

Check reports table:

```sql
-- In Vercel Postgres console or psql:

-- See all reports
SELECT id, status, vehicle_year, vehicle_model, created_at, paid_at
FROM reports
ORDER BY created_at DESC;

-- Count by status
SELECT status, COUNT(*) FROM reports GROUP BY status;

-- See draft reports
SELECT id, vehicle_year, vehicle_model, created_at
FROM reports
WHERE status = 'draft';

-- See paid reports
SELECT id, vehicle_year, vehicle_model, customer_email, paid_at
FROM reports
WHERE status = 'paid';
```

---

## 📊 What Each Table Stores

### `reports` table:
```
id               | UUID (primary key, e.g., "a1b2c3d4-...")
status           | 'draft' or 'paid'
payload_json     | Full report data (JSONB)
created_at       | When draft was created
paid_at          | When payment completed (NULL for drafts)
stripe_session_id| Stripe checkout session ID
customer_email   | Buyer's email from Stripe
vehicle_year     | E.g., 2021
vehicle_model    | E.g., "Tesla Model 3"
```

---

## 🚨 Troubleshooting

### Error: "missing_connection_string"
```bash
# Solution: Add POSTGRES_URL to .env.local
# Get from: Vercel Dashboard → Storage → Database → .env.local tab
```

### Error: "relation 'reports' does not exist"
```bash
# Solution: Run setup script
npx tsx scripts/setup-database.ts
```

### PDF Download Shows "Payment required"
```bash
# Solution: Check database
SELECT status FROM reports WHERE id = 'your-report-id';

# If status is 'draft', payment didn't complete
# Check webhook logs for errors
```

### Webhook Not Updating Database
```bash
# Check webhook is running:
# Terminal should show: ✅ Order fulfilled: {...}

# Check database connection in webhook:
# Should see no connection errors in logs

# Verify POSTGRES_URL is in .env.local
```

---

## 🎉 Success Indicators

You'll know everything works when:

1. ✅ Report button creates draft in database
2. ✅ Stripe checkout page loads with reportId
3. ✅ Payment completes successfully
4. ✅ Webhook logs show "Order fulfilled"
5. ✅ Database shows status changed to 'paid'
6. ✅ Report page shows "Payment Successful"
7. ✅ PDF downloads with correct filename
8. ✅ PDF contains all 6 report sections

---

## 📚 File Reference

**Database:**
- Schema: `database/schema.sql`
- Setup script: `scripts/setup-database.ts`

**Endpoints:**
- Create report: `app/api/report/create/route.ts`
- Checkout: `app/api/checkout/route.ts`
- Webhook: `app/api/stripe/webhook/route.ts`
- PDF download: `app/api/report/[reportId]/pdf/route.ts`

**Pages:**
- Report view: `app/report/[reportId]/page.tsx`
- PDF template: `lib/pdf/ReportPdf.tsx`

---

## 🚀 Next Steps

After database setup:

1. **Test Payment Flow** (15 min)
   - Create test report
   - Complete payment
   - Verify database updates
   - Download PDF

2. **Polish UI** (optional)
   - Add loading states
   - Improve error messages
   - Enhance PDF styling

3. **Deploy to Vercel** (30 min)
   - Push to GitHub
   - Connect to Vercel
   - Database auto-connects
   - Update Stripe webhook URL

---

**Ready to set up the database?**

Run these commands:

```bash
# 1. Add POSTGRES_URL to .env.local (from Vercel dashboard)

# 2. Run setup
npx tsx scripts/setup-database.ts

# 3. Restart dev server
npm run dev

# 4. Test payment flow!
```
