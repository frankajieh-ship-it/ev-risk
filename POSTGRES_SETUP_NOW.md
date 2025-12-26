# Quick Postgres Setup - DO THIS NOW

## Step 1: Get a Free Neon Database

Visit: https://console.neon.tech/signup

1. **Sign up** (use GitHub or email)
2. **Create a project** - name it "ev-risk"
3. **Region**: Choose US East or closest to you
4. Click "Create Project"

## Step 2: Get Connection String

After project creation:
1. Click on "Dashboard"
2. Look for "Connection string" or "Connection Details"
3. You'll see something like:
   ```
   postgres://username:password@ep-xyz.us-east-1.aws.neon.tech/dbname
   ```

## Step 3: Add to .env.local

Open `C:\Dev\ev-risk\.env.local` and add:

```env
# Neon Postgres Database
POSTGRES_URL="postgres://username:password@ep-xyz.us-east-1.aws.neon.tech/dbname?sslmode=require"

# Keep your existing Stripe keys
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Step 4: Run Database Setup

```bash
cd C:\Dev\ev-risk
npx tsx scripts/setup-database.ts
```

You should see:
```
✅ Created reports table
✅ Created status index
✅ Created stripe_session_id index
✅ Created created_at index
✅ Database setup complete!
```

## Step 5: Start Dev Server

```bash
npm run dev
```

## Step 6: Test Payment Flow

1. Visit http://localhost:3000 (or whatever port it shows)
2. Enter test vehicle data
3. Click "Get Full Report - $15"
4. Use test card: 4242 4242 4242 4242
5. Complete payment
6. Verify database stored the report
7. Download PDF!

---

## Alternative: Supabase (If you prefer)

Visit: https://supabase.com/dashboard

1. Create new project
2. Get connection string from Settings → Database
3. Add to .env.local as POSTGRES_URL
4. Run setup script

---

**Next Step**: Go to https://console.neon.tech/signup and create your free database!
