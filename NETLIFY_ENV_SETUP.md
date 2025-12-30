# Netlify Environment Variable Setup

## Problem
URL extraction works on localhost but fails on production (https://offolab.com) because the serverless function can't determine the correct base URL for the proxy fetch endpoint.

## Solution
Add the `NEXT_PUBLIC_BASE_URL` environment variable to Netlify.

## Steps

### Option 1: Via Netlify Dashboard (Recommended)
1. Go to https://app.netlify.com
2. Select your `ev-risk` site
3. Go to **Site settings** → **Environment variables**
4. Click **Add a variable**
5. Set:
   - **Key**: `NEXT_PUBLIC_BASE_URL`
   - **Value**: `https://offolab.com`
   - **Scopes**: Check all (Production, Deploy previews, Branch deploys)
6. Click **Create variable**
7. **Trigger a new deploy** for the changes to take effect:
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Clear cache and deploy site**

### Option 2: Via netlify.toml (Alternative)
Add this to your `netlify.toml` file (if it exists, otherwise create it in the project root):

```toml
[build.environment]
  NEXT_PUBLIC_BASE_URL = "https://offolab.com"
```

Then commit and push:
```bash
git add netlify.toml
git commit -m "Add NEXT_PUBLIC_BASE_URL for production extraction"
git push origin main
```

## Verification

After deployment completes:

### 1. Check environment variables
```bash
curl -H "x-api-key: ev-risk-admin-2025-secure-key" \
     https://offolab.com/api/debug-env
```

Should show:
```json
{
  "environment": {
    "NEXT_PUBLIC_BASE_URL": "https://offolab.com",
    "computedProxyBaseUrl": "https://offolab.com"
  }
}
```

### 2. Test URL extraction
1. Go to https://offolab.com
2. Paste an AutoTrader URL in the "Paste AutoTrader URL" tab
3. Click "Extract Data"
4. Should auto-fill: Year, Make, Model, Mileage, VIN

### 3. Check Netlify function logs
Should see:
```
[Listing Scraper] DEBUG - Environment check:
  - NEXT_PUBLIC_BASE_URL: https://offolab.com
[Listing Scraper] Server-side proxy URL: https://offolab.com/api/proxy-fetch
[Listing Scraper] Proxy fetch successful, HTML length: 396508
```

## Why This Works

- `NEXT_PUBLIC_BASE_URL` is explicitly set, so it has top priority
- The proxy URL becomes `https://offolab.com/api/proxy-fetch`
- The serverless function can now call its own proxy endpoint
- Proxy endpoint rotates user agents and bypasses bot detection
- Extraction succeeds with full HTML content

## Troubleshooting

If extraction still fails after setting the variable:

1. **Clear Netlify cache** and redeploy
2. **Check function logs** for the actual proxy URL being used
3. **Verify env var is set** using the debug endpoint
4. **Check for typos** in the variable name (must be exact)

## Alternative: Hardcode for Quick Fix

If you need an immediate fix, you can hardcode the URL in `lib/listing-scraper.ts`:

```typescript
const baseUrl = 'https://offolab.com';  // Hardcoded
```

But using the environment variable is better for:
- Deploy previews (Netlify branch deployments)
- Local development
- Future domain changes
