# OFFO - EV Routine Friction Analysis Tool

## Product Overview

**OFFO** (One Fewer Friction, One) is a web-based tool that helps prospective EV buyers understand the **real-world routine friction** they might encounter when switching to electric vehicles. Unlike traditional EV calculators that focus on range anxiety and cost savings, OFFO reveals the **hidden operational realities** that sellers often don't mention.

**Live URL**: https://offolab.com/

---

## Core Philosophy

### What OFFO Is NOT
- ❌ Not a "should you buy this EV?" recommendation engine
- ❌ Not a risk scoring system with red/yellow/green indicators
- ❌ Not a "good buy" or "bad buy" tool
- ❌ Not a range calculator or savings estimator

### What OFFO IS
- ✅ A **friction detector** that surfaces operational realities
- ✅ An **honest assessment** of routine-level challenges
- ✅ A **sentence-based output engine** that explains what usually surprises buyers
- ✅ A **context-aware analyzer** that considers your specific situation

---

## Key Features

### 1. **Flexible Vehicle Input** (Phase 1)

Users can provide vehicle information in two ways:

#### **Option A: Listing URL Scanner**
- Paste a vehicle listing URL from:
  - AutoTrader
  - Carvana
  - Cars.com
  - CarGurus
  - And other popular EV marketplaces
- Automatic extraction of:
  - Vehicle make, model, year
  - Current mileage
  - Price (if available)
  - VIN (if available)
- Fallback to manual entry if parsing fails

#### **Option B: Manual Entry**
- For users who:
  - Already own an EV
  - Don't have a listing link
  - Want to check a specific vehicle
- Required fields:
  - Year
  - Make
  - Model
- Optional fields:
  - Mileage
  - Battery health availability

#### **Photo Upload Placeholder** (Coming Soon)
- Disabled "Upload photos" button with honest "coming soon" messaging
- No fake interactions or misleading UI
- Clear communication about future functionality

---

### 2. **Sanity-Check Entry** (Phase 0.5 - Current)

A **7-question assessment** that replaces the traditional lengthy quiz with targeted questions about operational fit:

#### **Question 1: Primary Charging Access**
- Home charging (L1/L2)
- Apartment/shared parking
- Workplace/shared
- Public-only / mixed unreliable

#### **Question 2: Schedule Predictability**
- Predictable
- Some variability
- Often changes / unpredictable

#### **Question 3: Backup Tolerance**
- Easy fallback (second vehicle / rentals)
- Occasional fallback
- No fallback (single vehicle)

#### **Question 4: Infrastructure Dependency**
- Full control (private access)
- Shared chargers (apartment/work)
- Public network reliance

#### **Question 5: Execution-Time Uncertainty Tolerance** ⭐ NEW
"When something doesn't start immediately (charging/app/session), how disruptive is that for you?"
- **Low tolerance**: "I need it to work reliably / delays stress me"
- **Medium**: "I can handle occasional hiccups"
- **High tolerance**: "I'm fine troubleshooting or waiting sometimes"

#### **Question 6: Downtime Recovery Tolerance** ⭐ NEW
"If unexpected service downtime happens, how disruptive would that be to your routine?"
- **Low tolerance**: "Very disruptive / I rely on this vehicle daily"
- **Medium**: "Manageable with planning"
- **High tolerance**: "I have flexibility or alternatives"

#### **Question 7: ZIP Code**
- Used for climate and charging infrastructure context
- 5-digit US ZIP code

**Design Principles:**
- ✅ Completion time: < 30 seconds
- ✅ No progress bars or friction
- ✅ Single-page form (no multi-step wizard)
- ✅ Default values ("medium") for backward compatibility
- ✅ Clear, neutral language (no leading questions)

---

### 3. **Friction Sentence Output Engine**

After completing the sanity-check, users receive **3-6 targeted friction sentences** that describe operational realities specific to their situation.

#### **Sentence Selection Logic**

**Priority System:**
- **High Priority (Score: 95-100)**: Interaction sentences
  - Execution + shared/public dependency
  - Downtime + no backup
  - Downtime + unpredictable schedule
- **Medium Priority (Score: 50)**: Generic tolerance sentences
  - Low execution uncertainty tolerance
  - Low downtime recovery tolerance
- **Low Priority (Score: 30)**: Balanced/positive sentences
  - High execution uncertainty tolerance

**Selection Rules:**
1. **At most 1 execution sentence** (prevents bloat)
2. **At most 1 recovery sentence** (prevents bloat)
3. **3-6 total sentences** (maintains digestibility)
4. **Priority-first sorting** (interaction > generic > positive)
5. **Baseline fallbacks** if fewer than 3 matches

#### **17 Friction Sentences** (10 Original + 7 New)

**Original Sentences:**
1. **Shared Competition**: "Primary reliance on shared charging often introduces delays, queueing, or competition that isn't visible until you're living with it."
2. **Public Variability**: "When charging depends on the public network, reliability and availability can vary day to day, which makes routines harder to lock in."
3. **Schedule Rigidity**: "Unpredictable schedules tend to amplify charging friction, because planning becomes a requirement rather than a convenience."
4. **Variable Schedule Overhead**: "Even moderate schedule changes can make charging feel restrictive when timing starts to matter more than distance."
5. **No Backup Amplification**: "Limited backup options tend to amplify stress when something goes wrong—weather, charger downtime, or a last-minute plan change."
6. **Occasional Backup Fragility**: "Occasional access to a backup vehicle helps, but still leaves gaps during peak demand or unexpected disruptions."
7. **Full Control Stability**: "Having direct control over charging usually reduces day-to-day friction, even when schedules change."
8. **Apartment No Backup Compound**: "Shared charging combined with no easy fallback is where frustration tends to surface fastest."
9. **Work Charging Dependency**: "Workplace charging can work well—until access changes, policies shift, or demand increases."
10. **Public Unpredictable Peak**: "Public charging combined with unpredictable hours is where EV routines break most often, not because of range, but because of timing."

**New Tolerance-Based Sentences:** ⭐
11. **S_EXEC_001**: "If things don't start cleanly (apps, sessions, billing), even small delays can add stress — especially when you're tired, late, or it's cold."
12. **S_EXEC_002**: "If you're comfortable with occasional hiccups, execution-time friction (apps, sessions, retries) tends to feel less heavy."
13. **S_EXEC_003** (HIGH PRIORITY): "Relying on shared/public charging can create 'standing at the charger' uncertainty (apps, tariffs, session starts). Low tolerance for that uncertainty tends to amplify stress."
14. **S_REC_001**: "If unexpected downtime would be disruptive, the hardest part is often uncertainty (how long, how to fix, how to get back to normal), not the failure itself."
15. **S_REC_002** (HIGH PRIORITY): "Limited backup options can turn minor issues into major disruptions. When downtime tolerance is low, this tends to feel heavier in the first months."
16. **S_REC_003** (HIGH PRIORITY): "Unpredictable schedules + low tolerance for downtime can make disruptions feel costly because they remove your ability to 'plan around it.'"
17. **S_WHY_101**: "Why not 100%: this depends on how often you hit 'execution-time' moments (apps/session starts) and how disruptive downtime would be when life gets busy."

**Closing Line (Always Shown):**
> "These frictions most often surface during routine setup or after a disruption—such as a move, schedule change, charger outage, or seasonal shift—rather than on day one."

#### **Copy-to-Clipboard Feature**
- One-click copy of all friction sentences + closing line
- Visual feedback ("Copied!" with checkmark)
- No login required
- No email capture

---

### 4. **Fit Classification System** (Internal, De-Emphasized)

OFFO internally calculates a "fit context" but **does not prominently display it** or use it to make recommendations.

#### **Base Classification:**
- **Good Fit**: Full control + home charging + predictable/variable schedule + backup available
- **Conditional**: Shared/public dependency OR variable schedule OR occasional backup
- **High Friction**: Public dependency + unpredictable schedule + (none or occasional backup)

#### **Tolerance-Based Modifiers:** ⭐ NEW
1. **Conditional → High Friction**
   - IF: Base = "Conditional"
   - AND: Low execution uncertainty tolerance
   - AND: Shared or public charging dependency

2. **Good Fit → Conditional**
   - IF: Base = "Good Fit"
   - AND: Low downtime recovery tolerance
   - AND: No backup vehicle

**Display:**
- Shown at bottom of output screen in small, de-emphasized text
- Format: "Overall fit context: [label]"
- Never used for recommendations or color-coding

---

### 5. **Report Generation** (Phase 1)

After viewing friction sentences, users can continue to a full OFFO report that includes:

#### **Report Components:**
- **Vehicle Summary**: Make, model, year, mileage
- **Charging Context**: Based on ZIP code and answers
- **Battery Health Assessment**: If data available
- **Cost Analysis**: Ownership cost considerations
- **Warranty Information**: Coverage details
- **Market Score**: Relative market position
- **Confidence Factors**: Data completeness indicators
- **Risk Categories**: Organized by topic (Battery, Financial, etc.)

#### **Report Confidence Indicator:**
- 0-100% confidence score
- Factors affecting confidence:
  - Data completeness
  - Market data freshness
  - Owner reports available
  - Model history depth

#### **PDF Export:**
- Full report downloadable as PDF
- Includes all sections and analysis
- Shareable with family/advisors

---

## User Flow

### **Flow 1: URL-Based Entry**

```
1. User lands on homepage
   ↓
2. User pastes listing URL into scanner
   ↓
3. System extracts vehicle details
   ↓
4. User confirms extracted data
   ↓
5. User completes 7-question sanity-check
   ↓
6. User views 3-6 friction sentences
   ↓
7. User copies sentences (optional)
   ↓
8. User clicks "Continue to OFFO check"
   ↓
9. User views full report
   ↓
10. User exports PDF (optional)
```

### **Flow 2: Manual Entry**

```
1. User lands on homepage
   ↓
2. User clicks "Manual Entry" tab
   ↓
3. User enters: Year, Make, Model (+ optional fields)
   ↓
4. User completes 7-question sanity-check
   ↓
5. User views 3-6 friction sentences
   ↓
6. User copies sentences (optional)
   ↓
7. User clicks "Continue to OFFO check"
   ↓
8. User views full report
   ↓
9. User exports PDF (optional)
```

### **Flow 3: Parse Failure → Manual Entry Fallback**

```
1. User pastes listing URL
   ↓
2. System fails to parse URL
   ↓
3. System shows: "Can't parse link - need 3 quick details"
   ↓
4. User enters Year, Make, Model manually
   ↓
5. Continues to sanity-check (same as Flow 2)
```

---

## Technical Architecture

### **Frontend**
- **Framework**: Next.js 16.1.1 (App Router + Turbopack)
- **Language**: TypeScript with strict typing
- **UI Library**: React 18 + Tailwind CSS 3
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **PDF Generation**: @react-pdf/renderer

### **Backend**
- **API Routes**: Next.js serverless functions (Edge runtime)
- **Database**: Neon Postgres (@neondatabase/serverless)
- **Payment Processing**: Stripe integration
- **Deployment**: Netlify (auto-deploy from GitHub main branch)

### **Key Files**

#### **Sanity-Check System:**
- `lib/sanity-check-sentences.ts` - Sentence catalog + interface
- `lib/sanity-check-logic.ts` - Selection engine + fit calculation
- `components/FitQuizModal.tsx` - 7-question UI + output display

#### **Vehicle Input:**
- `components/VehicleInputTabs.tsx` - Tab switcher (URL vs Manual)
- `components/ListingUrlForm.tsx` - URL scanner UI
- `components/ManualEntryInlineForm.tsx` - Manual entry form
- `components/PhotoUploadPlaceholder.tsx` - Disabled upload button

#### **Report Generation:**
- `app/report/page.tsx` - Report display page
- `lib/scoring.ts` - Risk scoring engine
- `lib/compose-report-blocks.ts` - Report block generator

#### **Data Extraction:**
- `lib/listing-scraper.ts` - URL parsing and data extraction
- `lib/missing-data-generator.ts` - Missing data handling

#### **Analytics:**
- `app/api/track-event/route.ts` - Event tracking endpoint
- `app/api/track-visitor/route.ts` - Visitor tracking endpoint
- `app/admin/page.tsx` - Analytics dashboard UI
- `app/api/analytics/route.ts` - Analytics data endpoint

---

## Analytics & Tracking

### **Events Tracked:**

1. **entry_mode_selected**
   - When: User switches between URL vs Manual Entry tabs
   - Properties: `entry_mode` ("listing_url" | "manual_entry"), `context`

2. **manual_entry_submit**
   - When: User submits manual entry form
   - Properties: `has_mileage`, `has_battery_info`, `missing_fields_count`

3. **home_scan_submit**
   - When: User submits URL scanner
   - Properties: `url`, `context`

4. **url_autofill_attempt**
   - When: URL extraction completes (success or failure)
   - Properties: `url`, `success`, `extracted_data`, `error_message`

5. **sanity_check_completed** ⭐ UPDATED
   - When: User completes 7-question sanity-check
   - Properties:
     - `chargingAccess`
     - `schedule`
     - `backup`
     - `dependency`
     - `executionUncertaintyTolerance` (NEW)
     - `downtimeRecoveryTolerance` (NEW)
     - `risk_execution_uncertainty` (derived tag - NEW)
     - `risk_recovery_downtime` (derived tag - NEW)

6. **friction_sentences_copied**
   - When: User clicks copy button
   - Properties: `sentenceCount`

7. **report_generated**
   - When: User navigates to full report
   - Properties: `source`, `has_battery_info`, `missing_fields_count`

### **Admin Dashboard** (http://localhost:3000/admin)

Real-time analytics dashboard showing:
- Total reports (free/paid/draft)
- Conversion rate (free → paid)
- Revenue metrics
- User event analytics
- Website visitor tracking
- Report analytics (risk score distribution, top vehicles)
- User feedback (ratings, comments, recommendations)

---

## Design Principles

### **1. Honest UX**
- No fake buttons or misleading interactions
- "Coming soon" features clearly labeled as disabled
- No exaggerated claims or sensationalism
- Defaults favor neutral stance (e.g., "medium" tolerance)

### **2. No Tone Drift**
- All copy maintains neutral, factual tone
- No "you should" recommendations
- No "good buy" or "bad buy" language
- No pressure or urgency tactics

### **3. Fast Completion**
- 7-question sanity-check completes in < 30 seconds
- No unnecessary progress bars or friction
- Single-page form (no multi-step wizard)
- Minimal required fields

### **4. Privacy-First**
- No signup required
- No email capture before viewing results
- Listing URLs not stored
- Anonymous usage analytics

### **5. Minimal Bloat**
- At most 1 execution + 1 recovery sentence
- 3-6 total sentences (never more)
- No unnecessary explanations or tooltips
- Focus on what matters

### **6. Backward Compatible**
- Old report links work with defaults
- New fields default to "medium"
- Graceful degradation for missing data
- No breaking changes to existing flows

---

## Current Status (January 2026)

### **✅ Completed Features**

1. ✅ **Dual Input System** (URL Scanner + Manual Entry)
2. ✅ **7-Question Sanity-Check** (with tolerance questions)
3. ✅ **17 Friction Sentences** (with priority-based selection)
4. ✅ **Fit Classification Modifiers** (tolerance-aware upgrades/downgrades)
5. ✅ **Copy-to-Clipboard** (friction sentences + closing line)
6. ✅ **Photo Upload Placeholder** (disabled, "coming soon")
7. ✅ **Full Report Generation** (with PDF export)
8. ✅ **Analytics Tracking** (comprehensive event tracking + admin dashboard)
9. ✅ **Text Color Fix** (black text on white backgrounds for production)
10. ✅ **Netlify Auto-Deploy** (from GitHub main branch)

### **🚧 In Progress**

- None (all features deployed)

### **📋 Planned (Future Phases)**

1. **Photo Upload** (disabled placeholder ready)
   - Upload listing screenshots
   - Confirm extracted details visually
   - Manual correction interface

2. **Area Charging Context** (data model ready)
   - Local charging infrastructure density
   - Public charger availability by ZIP
   - Climate-specific considerations

3. **Pattern Detection** (API endpoints ready)
   - User behavior pattern analysis
   - Common friction point identification
   - Cohort-based insights

4. **Reddit Integration**
   - Routine fit analysis from Reddit discussions
   - Community-sourced friction points
   - Real owner experience summaries

---

## Deployment

### **Production URL**
- https://offolab.com/

### **GitHub Repository**
- https://github.com/frankajieh-ship-it/ev-risk

### **Deployment Pipeline**
1. Push to GitHub `main` branch
2. Netlify automatically detects commit
3. Runs `npm run build`
4. Deploys to production
5. ~2-3 minutes total deployment time

### **Environment Variables** (.env.local)
```env
# Database
POSTGRES_URL=<neon-postgres-connection-string>

# Stripe (Payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe-publishable-key>
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>

# Admin
ADMIN_API_KEY=<your-secret-admin-key>

# Optional: Analytics
NEXT_PUBLIC_POSTHOG_KEY=<posthog-key>
NEXT_PUBLIC_POSTHOG_HOST=<posthog-host>
```

---

## Success Metrics

### **Primary Metrics**
- ✅ Sanity-check completion rate (target: >80%)
- ✅ Time to complete sanity-check (target: <30s)
- ✅ Friction sentences copied (engagement signal)
- ✅ Report generation rate (conversion signal)

### **Quality Metrics**
- ✅ User feedback ratings (1-5 stars)
- ✅ Recommendation rate (would/wouldn't recommend)
- ✅ Sentence relevance (tracked via feedback)
- ✅ Missing data handling (completion despite gaps)

### **Business Metrics**
- ✅ Free → Paid conversion rate
- ✅ Average revenue per user
- ✅ Unique visitors (24h/7d/30d)
- ✅ Page views and top traffic sources

---

## Contact & Support

**Product Owner**: OFFO Team
**Technical Stack**: Next.js + TypeScript + Neon Postgres
**Deployment**: Netlify
**Version**: 1.0 (January 2026)

---

*Last Updated: January 13, 2026*
*Document Version: 1.0*
