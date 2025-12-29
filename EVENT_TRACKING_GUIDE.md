# 📊 Event Tracking Implementation Guide

**Comprehensive User Interaction Analytics**

## Overview

Event tracking has been added to capture **every user interaction** on the site, providing detailed analytics on user behavior, conversion funnels, and feature usage.

---

## 🎯 Events Being Tracked

### 1. **Form Submission Events** (`form_submit`)

**Tracks:** Every time a user clicks "Get My Risk Score"

**Success Data Captured:**
```json
{
  "success": true,
  "formData": {
    "model": "Tesla Model 3",
    "year": 2022,
    "dailyMiles": 30,
    "homeCharging": true,
    "usedUrlExtraction": true,
    "autoFilledFields": ["model", "year", "mileage"]
  }
}
```

**Failure Data Captured:**
```json
{
  "success": false,
  "formData": {
    "model": "Tesla Model 3",
    "year": 2022
  },
  "error": "Failed to calculate score"
}
```

**Questions This Answers:**
- How many users successfully submit the form?
- How many fail and why?
- What percentage of successful submissions used URL autofill?
- What fields were auto-filled vs manually entered?

---

### 2. **URL Autofill Events** (`url_autofill_attempt`)

**Tracks:** Every time a user tries to extract data from a listing URL

**Success Data Captured:**
```json
{
  "url": "https://www.carvana.com/vehicle/...",
  "success": true,
  "extractedData": {
    "make": "Tesla",
    "model": "Model 3",
    "year": 2022,
    "trim": "Long Range",
    "vin": "5YJ3E1EB...",
    "mileage": 25000,
    "fieldsExtracted": ["model", "year", "trim", "vin", "mileage"]
  }
}
```

**Failure Data Captured:**
```json
{
  "url": "https://www.carvana.com/vehicle/...",
  "success": false,
  "extractedData": null,
  "error": "Failed to extract listing data"
}
```

**Questions This Answers:**
- How many users try URL autofill?
- What's the success rate?
- Which sites work vs fail?
- What data gets extracted most often?
- Which makes/models are being researched?

---

### 3. **Blog Link Clicks** (`blog_link_click`)

**Tracks:** Every time someone clicks the blog link

**Data Captured:**
```json
{
  "source": "homepage",
  "destination": "/blog"
}
```

**Questions This Answers:**
- How many users click through to the blog?
- Which pages drive blog traffic?
- What's the conversion rate from homepage → blog?

---

### 4. **Button Clicks** (`button_click`)

**Tracks:** All major button interactions

**Data Captured:**
```json
{
  "buttonName": "Get My Risk Score",
  "context": "main_form"
}
```

**Other Buttons Tracked:**
- Form submit button
- URL autofill button (if applicable)
- Future: Report download, share buttons

**Questions This Answers:**
- Which buttons get clicked most?
- Where do users drop off in the flow?

---

### 5. **Page Views** (via `useVisitorTracking`)

**Tracks:** Every page visit

**Data Captured:**
- Page path
- Referrer source
- Session duration
- Visitor ID (fingerprint)

---

## 📈 Analytics Available in Admin Dashboard

### Access Event Analytics

**Endpoint:** `/admin` → Scroll to "User Event Analytics" section

### Metrics Displayed

#### **1. Event Summary**
- Total events recorded
- Events by type (form_submit, url_autofill_attempt, blog_click, etc.)
- Unique users per event type

#### **2. Form Submission Analytics**
- Total attempts
- Successful submissions
- Failed submissions
- Unique users
- Success rate %

#### **3. URL Autofill Analytics**
- Total attempts
- Successful extractions
- Failed extractions
- Success rate %
- Unique URLs tried
- **Most extracted vehicles** (top 10 makes/models)

#### **4. Blog Analytics**
- Total blog link clicks
- Unique users who clicked
- Click sources (homepage, report page, etc.)

#### **5. Conversion Funnel**
```
Total Visitors
    ↓
Tried URL Autofill (X%)
    ↓
Submitted Form (X%)
    ↓
Generated Report (X%)
    ↓
Clicked Blog (X%)
```

#### **6. Recent Events** (Last 50)
- Real-time event stream
- Event name, data, visitor ID, timestamp
- Useful for debugging and live monitoring

---

## 🗄️ Database Schema

### Table: `user_events`

```sql
CREATE TABLE user_events (
  id UUID PRIMARY KEY,
  event_name TEXT NOT NULL,
  event_data JSONB,
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  page_path TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Indexes
- `event_name` - Fast filtering by event type
- `visitor_id` - User journey tracking
- `timestamp` - Time-based queries
- `session_id` - Session analysis
- `event_data` (GIN) - JSON field queries

---

## 🔧 API Endpoints

### POST `/api/track-event`

**Logs a user event**

```bash
curl -X POST http://localhost:3000/api/track-event \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "form_submit",
    "eventData": {
      "success": true,
      "formData": {...}
    },
    "visitorId": "fp-abc123",
    "sessionId": "session-xyz",
    "pagePath": "/",
    "timestamp": "2025-12-29T12:00:00Z"
  }'
```

### GET `/api/track-event?timeframe=30d`

**Fetches event analytics**

**Query Parameters:**
- `timeframe`: `24h`, `7d`, `30d`, `all`
- `event`: Filter by event name (optional)

**Response:**
```json
{
  "success": true,
  "timeframe": "30d",
  "stats": {
    "totalEvents": 1250,
    "eventsByName": [...],
    "formSubmissions": {...},
    "urlAutofill": {...},
    "blogClicks": {...},
    "conversionFunnel": {...},
    "recentEvents": [...],
    "extractedDataSummary": [...]
  }
}
```

---

## 📊 Key Analytics Questions Answered

### **User Behavior**
✅ How many visitors try URL autofill vs manual entry?
✅ What's the success/failure rate of URL extraction?
✅ Which vehicle listings get researched most?
✅ What data fields are most successfully extracted?

### **Conversion Funnel**
✅ How many visitors click "Get My Risk Score"?
✅ How many successfully generate reports?
✅ Where do users drop off?
✅ What percentage used URL autofill vs manual?

### **Content Performance**
✅ How many users click the blog link?
✅ What's the conversion rate to blog?
✅ Which pages drive most engagement?

### **Feature Usage**
✅ Is URL autofill being used? (Yes/No + frequency)
✅ Which features get clicked most?
✅ What's the typical user journey?

### **Data Quality**
✅ What makes/models are being queried?
✅ Which listing sites work vs fail?
✅ What errors occur most frequently?

---

## 🧪 Testing Event Tracking

### 1. **Test Form Submit**

```bash
# Visit homepage
open http://localhost:3000

# Fill out form
# Click "Get My Risk Score"

# Check events
curl http://localhost:3000/api/track-event?timeframe=all | jq '.stats.formSubmissions'
```

### 2. **Test URL Autofill**

```bash
# Visit homepage
# Paste a Carvana/CarMax URL
# Click "Auto-fill from URL"

# Check events
curl http://localhost:3000/api/track-event?timeframe=all | jq '.stats.urlAutofill'
```

### 3. **Test Blog Click**

```bash
# Visit homepage
# Click "Read: Why EV regret isn't about range →"

# Check events
curl http://localhost:3000/api/track-event?timeframe=all | jq '.stats.blogClicks'
```

### 4. **View All Events in Admin**

```bash
# Open admin dashboard
open http://localhost:3000/admin

# Log in
# Scroll to "User Event Analytics" section
# See real-time event data
```

---

## 📈 Admin Dashboard Display (✅ IMPLEMENTED)

The admin dashboard has been updated to display comprehensive event analytics. The implementation includes:

```tsx
{/* User Event Analytics */}
{eventStats && (
  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
    <h2 className="text-2xl font-bold mb-4">📊 User Event Analytics</h2>

    {/* Form Submissions */}
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">Form Submissions</h3>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-gray-600">Total Attempts</p>
          <p className="text-2xl font-bold">{eventStats.formSubmissions.total_attempts}</p>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <p className="text-sm text-gray-600">Successful</p>
          <p className="text-2xl font-bold text-green-600">{eventStats.formSubmissions.successful}</p>
        </div>
        <div className="bg-red-50 p-4 rounded">
          <p className="text-sm text-gray-600">Failed</p>
          <p className="text-2xl font-bold text-red-600">{eventStats.formSubmissions.failed}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <p className="text-sm text-gray-600">Success Rate</p>
          <p className="text-2xl font-bold text-purple-600">
            {((eventStats.formSubmissions.successful / eventStats.formSubmissions.total_attempts) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>

    {/* URL Autofill */}
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">URL Autofill</h3>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-gray-600">Total Attempts</p>
          <p className="text-2xl font-bold">{eventStats.urlAutofill.total_attempts}</p>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <p className="text-sm text-gray-600">Successful</p>
          <p className="text-2xl font-bold text-green-600">{eventStats.urlAutofill.successful}</p>
        </div>
        <div className="bg-red-50 p-4 rounded">
          <p className="text-sm text-gray-600">Failed</p>
          <p className="text-2xl font-bold text-red-600">{eventStats.urlAutofill.failed}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <p className="text-sm text-gray-600">Success Rate</p>
          <p className="text-2xl font-bold text-purple-600">
            {((eventStats.urlAutofill.successful / eventStats.urlAutofill.total_attempts) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>

    {/* Conversion Funnel */}
    <div>
      <h3 className="text-lg font-semibold mb-2">Conversion Funnel</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
          <span>Total Visitors</span>
          <span className="font-bold">{eventStats.conversionFunnel.totalVisitors}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
          <span>Tried URL Autofill</span>
          <span className="font-bold">{eventStats.conversionFunnel.triedAutofill} ({eventStats.conversionFunnel.autofillConversion}%)</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-green-50 rounded">
          <span>Submitted Form</span>
          <span className="font-bold">{eventStats.conversionFunnel.submittedForm} ({eventStats.conversionFunnel.formConversion}%)</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
          <span>Generated Report</span>
          <span className="font-bold">{eventStats.conversionFunnel.generatedReport} ({eventStats.conversionFunnel.reportConversion}%)</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-orange-50 rounded">
          <span>Clicked Blog</span>
          <span className="font-bold">{eventStats.conversionFunnel.clickedBlog} ({eventStats.conversionFunnel.blogConversion}%)</span>
        </div>
      </div>
    </div>
  </div>
)}
```

---

## 🚀 Next Steps

1. **Run Database Migration** ⚠️ REQUIRED
   ```bash
   psql $DATABASE_URL < database/schema.sql
   ```
   This creates the `user_events` table required for event tracking.

2. **Test Event Tracking**
   - Visit homepage at `http://localhost:3000`
   - Try URL autofill with a vehicle listing URL
   - Submit the form to generate a report
   - Click the blog link
   - Check `/admin` dashboard for event analytics

3. **Monitor & Iterate** ✅
   - Check event data daily in admin dashboard
   - Identify user behavior patterns
   - Track conversion funnel drop-off points
   - Optimize UX based on real user data

---

**✅ IMPLEMENTATION COMPLETE**

All user interactions are now tracked and displayed in the admin dashboard:
- Form submissions (success/failure tracking)
- URL autofill attempts (with extracted vehicle data)
- Blog link clicks (with source tracking)
- Button clicks
- Complete conversion funnel visualization
