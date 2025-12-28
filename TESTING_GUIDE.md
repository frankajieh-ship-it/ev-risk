# EV-Risk Testing Guide

## Quick Test Checklist

### ✅ Features Ready to Test

1. **URL Listing Extraction** - Homepage URL input with auto-fill
2. **Data Quality Display** - "What we know vs. don't know" component
3. **Rate Limiting** - API endpoint protection
4. **Health Check** - System status endpoint
5. **Security Logging** - Admin access tracking

---

## Test Scenarios

### 1. Homepage URL Extraction

**Test**: Paste a vehicle listing URL and auto-fill form

**Steps**:
1. Open http://localhost:3000
2. Find the "Quick Start: Paste a Listing URL" section
3. Paste a test URL (see examples below)
4. Click "Auto-Fill"
5. Verify form fields populate
6. Check for warnings if data is incomplete

**Test URLs** (will gracefully fail but test the flow):
```
https://www.autotrader.com/cars-for-sale/vehicledetails.xhtml?listingId=12345
https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?sourceContext=test
https://www.cars.com/vehicledetail/test
```

**Expected Behavior**:
- Shows "Extracting..." status
- Returns graceful error or partial data
- Displays warnings for missing fields
- Allows manual completion

**Test with Invalid URL**:
```
not-a-valid-url
http://example.com
```

**Expected**: Clear error message "Invalid URL format"

---

### 2. Rate Limiting

**Test**: Trigger rate limit on extraction endpoint

**Steps**:
1. Make 10+ extraction requests rapidly
2. After 10th request, should see rate limit error

**Automated Test**:
```bash
# Run 12 extraction requests
for i in {1..12}; do
  curl -X POST http://localhost:3000/api/extract-listing \
    -H "Content-Type: application/json" \
    -d '{"url":"https://www.autotrader.com/test"}' \
    -w "\nStatus: %{http_code}\n"
  echo "Request $i complete"
done
```

**Expected Output**:
- Requests 1-10: 200 or 400 status
- Requests 11-12: 429 status (Rate limit exceeded)

---

### 3. Health Check Endpoint

**Test**: Verify system health

**Steps**:
```bash
curl http://localhost:3000/api/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-27T...",
  "uptime": 3600,
  "environment": "development",
  "version": "1.0.0",
  "services": {
    "database": "ok",
    "api": "ok"
  }
}
```

---

### 4. Processing Status Endpoint

**Test**: Check status tracking

**Steps**:
```bash
# This will return 404 since we don't have an active process
curl http://localhost:3000/api/status/test-process-id
```

**Expected Response**:
```json
{
  "error": "Process not found"
}
```

---

### 5. Admin Dashboard (with Security Logging)

**Test**: Admin access with rate limiting

**Steps**:
1. Open http://localhost:3000/admin
2. Enter admin key: `ev-risk-admin-2025-secure-key`
3. Click "Access Dashboard"
4. Try different time period filters
5. Check terminal for security logs

**Expected Security Logs**:
```
[SECURITY] 2025-12-27... {
  timestamp: '...',
  type: 'admin_login_success',
  ip: '::1',
  userId: 'analytics_access'
}
```

**Test Invalid Key**:
- Enter wrong key
- Should see security log for failed attempt

---

### 6. Complete Report Generation Flow

**Test**: Full user journey from URL to report

**Steps**:
1. Go to http://localhost:3000
2. Paste test URL: `https://www.autotrader.com/test`
3. Click "Auto-Fill" (will show warnings)
4. Manually fill: Model, Year, Mileage, ZIP Code
5. Complete form and submit
6. View generated report

**Expected**: Report shows risk score and breakdown

---

## API Endpoint Tests

### Manual API Tests

#### 1. Extract Listing
```bash
curl -X POST http://localhost:3000/api/extract-listing \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.autotrader.com/cars-for-sale/vehicledetails.xhtml?listingId=12345"
  }'
```

**Expected**: JSON response with extraction result

#### 2. Generate Score
```bash
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Tesla Model 3",
    "year": 2022,
    "currentMileage": 45000,
    "zipCode": "94103",
    "dailyMiles": 30,
    "homeCharging": true,
    "riskTolerance": "moderate"
  }'
```

**Expected**: Risk score and breakdown

#### 3. Analytics (requires admin key)
```bash
curl http://localhost:3000/api/analytics?period=all \
  -H "Authorization: Bearer ev-risk-admin-2025-secure-key"
```

**Expected**: Analytics data

#### 4. Health Check
```bash
curl http://localhost:3000/api/health
```

**Expected**: System health status

---

## Browser DevTools Tests

### 1. Network Tab Inspection

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to http://localhost:3000
4. Paste URL and click "Auto-Fill"
5. Inspect POST request to `/api/extract-listing`

**Check**:
- Request payload contains URL
- Response has extraction result
- Status code 200 or 400
- Response headers include rate limit info

### 2. Console Errors

**Check**: No JavaScript errors in console

**Expected**: Clean console (or only expected warnings)

---

## Performance Tests

### URL Extraction Speed

**Target**: < 5 seconds per extraction

**Test**:
```bash
time curl -X POST http://localhost:3000/api/extract-listing \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.autotrader.com/test"}'
```

**Expected**: Response within 5 seconds

### Report Generation Speed

**Target**: < 2 seconds total

**Test using browser**:
1. Open DevTools Performance tab
2. Fill form and submit
3. Check total time from click to report display

**Expected**: < 2000ms

---

## Error Handling Tests

### 1. Invalid Input Tests

#### Missing Required Fields
```bash
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{"model": "Tesla"}'
```

**Expected**: 400 error with clear message

#### Invalid Data Types
```bash
curl -X POST http://localhost:3000/api/extract-listing \
  -H "Content-Type: application/json" \
  -d '{"url": 12345}'
```

**Expected**: 400 error "URL is required"

### 2. Network Failure Simulation

**Test**: Extraction with unreachable URL

```bash
curl -X POST http://localhost:3000/api/extract-listing \
  -H "Content-Type: application/json" \
  -d '{"url":"https://this-domain-does-not-exist-12345.com"}'
```

**Expected**: Graceful error message

---

## Security Tests

### 1. Rate Limiting

- ✅ Extraction: 10 requests / 15 min
- ✅ Reports: 50 requests / 15 min
- ✅ Analytics: 30 requests / min

**Test**: See "Rate Limiting" section above

### 2. Admin Access Control

**Test Invalid Key**:
```bash
curl http://localhost:3000/api/analytics?period=all \
  -H "Authorization: Bearer wrong-key"
```

**Expected**: 401 Unauthorized

### 3. Security Headers

```bash
curl -I http://localhost:3000
```

**Check headers include**:
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Content-Security-Policy: ...

---

## Data Quality Tests

### What We Know vs. Don't Know

**Test**: Verify data quality tracking

1. Submit report with minimal data
2. Check that unknowns are properly listed
3. Verify importance levels (critical/high/medium)
4. Check "how to find" guidance is clear

**Expected Unknowns** (always present):
- Battery State of Health (CRITICAL)
- Charging History (HIGH)
- Service History (HIGH)
- Climate Exposure History (MEDIUM)

---

## Regression Tests

### After Each Code Change

1. ✅ Homepage loads without errors
2. ✅ URL extraction still works
3. ✅ Manual form submission works
4. ✅ Reports generate correctly
5. ✅ Admin dashboard accessible
6. ✅ No new console errors

---

## Production Readiness Checklist

Before deploying to production:

### Environment Variables
- [ ] ADMIN_API_KEY set in Netlify
- [ ] STRIPE_SECRET_KEY set (live mode)
- [ ] STRIPE_WEBHOOK_SECRET set
- [ ] POSTGRES_URL set

### Testing
- [ ] All API endpoints tested
- [ ] Rate limiting verified
- [ ] Error handling confirmed
- [ ] Security headers present
- [ ] Admin access controlled

### Performance
- [ ] URL extraction < 5 sec
- [ ] Report generation < 2 sec
- [ ] No memory leaks
- [ ] Cleanup functions working

### Documentation
- [ ] README updated
- [ ] API docs current
- [ ] Security docs reviewed
- [ ] Feature docs complete

---

## Troubleshooting

### Common Issues

**Issue**: "URL extraction failed"
**Fix**: Check network connectivity, verify URL format

**Issue**: "Rate limit exceeded"
**Fix**: Wait 15 minutes or restart dev server (clears memory)

**Issue**: "Admin key invalid"
**Fix**: Check `.env.local` has correct ADMIN_API_KEY

**Issue**: "Database connection error"
**Fix**: Verify POSTGRES_URL in .env.local

---

## Quick Test Commands

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test extraction (will gracefully fail)
curl -X POST http://localhost:3000/api/extract-listing \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.autotrader.com/test"}'

# Test rate limiting (run 12 times)
for i in {1..12}; do curl -X POST http://localhost:3000/api/extract-listing \
  -H "Content-Type: application/json" \
  -d '{"url":"https://test.com"}'; done

# Check security logs
# Look in terminal where dev server is running for [SECURITY] logs
```

---

**Last Updated**: 2025-12-27
**Status**: All features ready for testing
**Next**: Test with real AutoTrader/CarGurus URLs
