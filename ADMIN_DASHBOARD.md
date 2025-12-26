# EV-Risk Admin Analytics Dashboard

## Overview

The admin dashboard provides comprehensive analytics for the EV-Risk application, including:

- Site traffic and report generation metrics
- Revenue and conversion tracking
- User feedback analysis
- Vehicle model popularity
- Risk score distribution
- Daily activity trends
- Willingness to pay by vehicle model

## Access

**URL:** `/admin`

**Authentication:** Requires admin API key

### Local Development

1. The admin API key is stored in `.env.local`:
   ```
   ADMIN_API_KEY=ev-risk-admin-2025-secure-key
   ```

2. Navigate to `http://localhost:3002/admin` (or your local dev URL)

3. Enter the API key from your `.env.local` file

### Production

1. Set the `ADMIN_API_KEY` environment variable in Netlify:
   - Go to Netlify Dashboard > Site Settings > Environment Variables
   - Add: `ADMIN_API_KEY` = `your-secure-production-key`

2. Navigate to `https://offolab.com/admin`

3. Enter your production admin key

## Features

### Time Period Filters
- **All Time:** View all historical data
- **Today:** View today's activity
- **Week:** Last 7 days
- **Month:** Last 30 days

### Metrics Tracked

#### Overview Metrics
- Total reports generated
- Free reports vs paid reports
- Draft reports (abandoned checkouts)
- Unique customers

#### Conversion Metrics
- Total reports generated
- Number converted to paid
- Conversion rate percentage

#### Revenue Metrics
- Total paid reports
- Total revenue ($15 per report)
- Revenue trends

#### Feedback Metrics
- Total feedback submissions
- Average rating (1-5 stars)
- Recommendation rate
- Rating distribution

#### Vehicle Analytics
- Top 20 most searched vehicle models
- Reports per model (free vs paid)
- Conversion rate by vehicle model
- Willingness to pay analysis

#### Risk Distribution
- Green (70-100): Low risk vehicles
- Yellow (40-69): Moderate risk vehicles
- Red (0-39): High risk vehicles
- Conversion rates by risk category

#### Recent Feedback
- Last 10 feedback submissions with text
- Star ratings
- Would recommend flag
- Vehicle information
- Submission date

#### Daily Trends
- Last 30 days of activity
- Free vs paid reports per day
- Activity patterns

## API Endpoint

**Endpoint:** `GET /api/analytics`

**Authentication:** Bearer token in Authorization header

**Query Parameters:**
- `period` (optional): `all`, `today`, `week`, or `month`

**Example Request:**
```bash
curl -H "Authorization: Bearer ev-risk-admin-2025-secure-key" \
  "http://localhost:3002/api/analytics?period=week"
```

**Response Format:**
```json
{
  "period": "week",
  "generated_at": "2025-12-26T12:00:00.000Z",
  "overview": {
    "total_reports": 100,
    "free_reports": 75,
    "paid_reports": 20,
    "draft_reports": 5,
    "unique_customers": 18
  },
  "conversion": {
    "total_generated": 100,
    "converted_to_paid": 20,
    "conversion_rate": 20.0
  },
  "revenue": {
    "paid_count": 20,
    "total_revenue": 300,
    "price_per_report": 15
  },
  "feedback": {
    "total_feedback": 45,
    "avg_rating": 4.2,
    "would_recommend": 38,
    "would_not_recommend": 7,
    "recommendation_rate": 84.44,
    "rating_distribution": [...]
  },
  "top_vehicles": [...],
  "willingness_to_pay": [...],
  "risk_distribution": [...],
  "recent_feedback": [...],
  "daily_trend": [...]
}
```

## Security

### Authentication
- API key-based authentication
- Key stored in environment variables (never in code)
- Session storage for convenience (client-side only)
- Logout clears session storage

### Best Practices
1. Use a strong, unique admin key in production
2. Never commit `.env.local` to git
3. Rotate the admin key periodically
4. Limit access to the admin key to authorized personnel only
5. Consider adding IP whitelist for production access

### Production Setup
```bash
# Generate a secure random key
openssl rand -base64 32

# Add to Netlify environment variables
ADMIN_API_KEY=<your-secure-key>
```

## Data Insights

### Key Metrics to Monitor

1. **Conversion Rate**: Track if free users convert to paid
   - Target: 15-25% is typical for freemium models
   - Low rate? Consider value proposition, pricing, or UX

2. **Average Rating**: User satisfaction indicator
   - Target: 4.0+ is excellent
   - Low rating? Review feedback text for issues

3. **Recommendation Rate**: Net Promoter Score proxy
   - Target: 70%+ is strong
   - High rate indicates product-market fit

4. **Top Vehicles**: Most searched models
   - Focus marketing on popular models
   - Ensure data accuracy for top models

5. **Willingness to Pay by Model**: Which users convert
   - High-end EVs may have higher conversion
   - Tailor messaging to different segments

6. **Risk Distribution**: What users are searching
   - Most should be Green/Yellow for healthy market
   - Many Red scores may indicate targeting older EVs

## Troubleshooting

### "Invalid admin key" error
- Check `.env.local` has `ADMIN_API_KEY` set
- Verify key matches exactly (no extra spaces)
- For production, check Netlify environment variables

### No data showing
- Verify database connection is working
- Check if any reports exist in database
- Try different time period filters

### Slow loading
- Large datasets may take time to aggregate
- Consider adding database indexes (already included)
- Use specific time periods instead of "All Time"

## Future Enhancements

Potential additions:
- Export data to CSV/Excel
- Email reports on schedule
- Alert thresholds (e.g., conversion rate drops)
- User segmentation analysis
- Geographic analytics (by ZIP code)
- Cohort analysis
- A/B test tracking
