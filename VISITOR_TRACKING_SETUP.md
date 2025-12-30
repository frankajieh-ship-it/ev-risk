# 🌐 Visitor Tracking Setup Guide

**OFFO Lab Website Visitor Tracking**

## Overview

Visitor tracking has been added to track unique visitors to `www.offolab.com` (runs on `http://localhost:3000/`) and display analytics in the admin dashboard at `http://localhost:3000/admin`.

---

## 🗄️ Database Setup

### 1. Run the Database Migration

Execute the updated schema to create the visitor tracking tables:

```bash
# If using Vercel Postgres (recommended)
# The tables will be created automatically on first API call

# Or manually run the SQL schema
psql $DATABASE_URL < database/schema.sql
```

### New Tables Created:

1. **`visitors`** - Stores unique visitor information
   - `visitor_id` - Unique fingerprint
   - `ip_address`, `user_agent`, `referrer`
   - `page_path`, `country`, `city`
   - `first_visit`, `last_visit`
   - `visit_count`, `session_count`

2. **`page_views`** - Detailed page view logs
   - `visitor_id`, `page_path`, `referrer`
   - `timestamp`, `session_duration`

---

## 📁 Files Added

### Backend
- **`database/schema.sql`** - Updated with visitor tracking tables
- **`app/api/track-visitor/route.ts`** - API endpoint for tracking & stats

### Frontend
- **`hooks/useVisitorTracking.ts`** - React hook for automatic tracking
- **`app/page.tsx`** - Added tracking to homepage
- **`app/admin/page.tsx`** - Display visitor stats

---

## 🚀 How It Works

### 1. Automatic Tracking on Homepage

When a user visits `http://localhost:3000/` (offolab.com):

```tsx
// Automatically tracks:
// - Page views
// - Session duration
// - Referrer source
// - Browser fingerprint
useVisitorTracking({
  enabled: true,
  trackPageViews: true,
  trackSessionDuration: true,
});
```

### 2. Visitor Fingerprinting

Each visitor gets a unique ID based on:
- Browser user agent
- Screen resolution
- Language
- Timezone offset
- Color depth

### 3. Data Collected

**Per Visit:**
- Page path (e.g., `/`, `/report`, `/admin`)
- Referrer URL (where they came from)
- IP address (for geo-location)
- Timestamp
- Session duration

**Per Visitor:**
- Total visit count
- First visit date
- Last visit date
- Session count

---

## 📊 Admin Dashboard

### Accessing Visitor Stats

1. Go to `http://localhost:3000/admin`
2. Log in with your admin API key
3. Scroll down to **🌐 Website Visitor Tracking** section

### Available Metrics

**Summary Cards:**
- **Unique Visitors** - Total unique visitors in timeframe
- **Total Page Views** - All page views recorded
- **Top Page** - Most visited page

**Timeframe Filters:**
- Last 24 Hours
- Last 7 Days
- Last 30 Days
- All Time

**Detailed Tables:**
- **Recent Visitors (Last 20)** - Latest visitor activity
  - Visitor ID (fingerprint)
  - Page visited
  - Referrer source
  - First/Last visit timestamps
  - Total visit count

- **Top Pages (Top 5)** - Most popular pages
  - Page path
  - View count
  - Unique visitors

---

## 🔧 Configuration

### Enable/Disable Tracking

Edit `app/page.tsx`:

```tsx
useVisitorTracking({
  enabled: true,        // Set to false to disable
  trackPageViews: true, // Track page navigation
  trackSessionDuration: true, // Track time on page
});
```

### Add Tracking to Other Pages

To track visitors on other pages (e.g., `/report`):

```tsx
// In app/report/page.tsx
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

export default function ReportPage() {
  useVisitorTracking(); // Add this line
  // ... rest of component
}
```

---

## 🛠️ API Endpoints

### POST `/api/track-visitor`

Logs a visitor page view.

**Request Body:**
```json
{
  "pagePath": "/",
  "referrer": "https://google.com",
  "fingerprint": "fp-abc123",
  "sessionDuration": 45
}
```

**Response:**
```json
{
  "success": true,
  "visitorId": "visitor-unique-id",
  "message": "Visit tracked successfully"
}
```

### GET `/api/track-visitor?timeframe=30d`

Fetches visitor statistics (for admin dashboard).

**Query Parameters:**
- `timeframe`: `24h`, `7d`, `30d`, `all`

**Response:**
```json
{
  "success": true,
  "timeframe": "30d",
  "stats": {
    "uniqueVisitors": 150,
    "totalPageViews": 425,
    "topPages": [...],
    "recentVisitors": [...],
    "visitorsByDay": [...]
  }
}
```

---

## 🧪 Testing

### 1. Test Visitor Tracking

```bash
# Start dev server
npm run dev

# Visit homepage
open http://localhost:3000

# Check browser console for tracking logs
# Check database for new visitor entry
```

### 2. Test Admin Dashboard

```bash
# Visit admin page
open http://localhost:3000/admin

# Log in with admin API key
# Check "Website Visitor Tracking" section
# Verify visitor data appears
```

### 3. Manual API Test

```bash
# Track a test visit
curl -X POST http://localhost:3000/api/track-visitor \
  -H "Content-Type: application/json" \
  -d '{
    "pagePath": "/",
    "referrer": "https://google.com",
    "fingerprint": "test-fp-123"
  }'

# Fetch visitor stats
curl http://localhost:3000/api/track-visitor?timeframe=all
```

---

## 🔒 Privacy Considerations

### What's Tracked
✅ Page views and navigation
✅ Browser fingerprint (anonymous)
✅ Referrer source
✅ Session duration
✅ IP address (for geo-location)

### What's NOT Tracked
❌ Personal information
❌ Cookies (uses browser fingerprinting)
❌ Form inputs or user data
❌ Passwords or sensitive info

### GDPR Compliance
- Tracking is anonymous (no PII)
- No cookies required
- Users can opt-out by blocking JavaScript
- Data retention can be configured

---

## 📈 Analytics Features

### Current Features
- ✅ Unique visitor tracking
- ✅ Page view counting
- ✅ Referrer tracking
- ✅ Session duration
- ✅ Real-time dashboard
- ✅ Time-based filtering

### Future Enhancements
- 🔲 Geo-location mapping (country/city)
- 🔲 Visitor journey visualization
- 🔲 Conversion funnel tracking
- 🔲 Bounce rate calculation
- 🔲 Device/browser breakdown
- 🔲 Export to CSV

---

## 🐛 Troubleshooting

### Visitors Not Showing Up

1. **Check database connection**
   ```bash
   # Verify DATABASE_URL env variable
   echo $DATABASE_URL
   ```

2. **Check API endpoint**
   ```bash
   # Test API directly
   curl http://localhost:3000/api/track-visitor?timeframe=all
   ```

3. **Check browser console**
   - Open DevTools → Console
   - Look for tracking errors
   - Verify API calls in Network tab

### Admin Dashboard Not Loading Stats

1. **Verify API key**
   - Check `.env.local` for `ADMIN_API_KEY`
   - Ensure it matches login key

2. **Check visitor stats fetch**
   - Look for errors in browser console
   - Verify `/api/track-visitor` GET endpoint works

3. **Database query errors**
   - Check server logs for SQL errors
   - Verify tables exist in database

---

## 🎯 Next Steps

1. **Run Database Migration**
   ```bash
   psql $DATABASE_URL < database/schema.sql
   ```

2. **Test Locally**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   # Check admin dashboard
   ```

3. **Deploy to Production**
   ```bash
   git add .
   git commit -m "Add visitor tracking"
   git push origin main
   # Vercel will auto-deploy
   ```

4. **Monitor Analytics**
   - Check admin dashboard daily
   - Track visitor trends
   - Identify popular pages

---

## 📞 Support

If you encounter issues:
1. Check database connection
2. Verify environment variables
3. Review server logs
4. Test API endpoints manually

**Visitor tracking is now live! Visit `http://localhost:3000/admin` to see the analytics.**
