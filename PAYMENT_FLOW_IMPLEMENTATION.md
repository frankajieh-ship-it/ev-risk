# Payment Flow Implementation Plan

## Architecture Decision: Vercel Postgres + @react-pdf/renderer

### Why this stack:
- ✅ Vercel Postgres: Free tier, serverless-native, perfect for Next.js
- ✅ @react-pdf/renderer: No headless browser, works in Edge runtime
- ✅ Production-ready: Scales automatically, no file system reliance
- ✅ Secure: Database-backed, proper access control

---

## Implementation Steps

### Phase 1: Database Setup (30 min)

**1.1 Install dependencies:**
```bash
npm install @vercel/postgres
npm install @react-pdf/renderer
npm install uuid
npm install @types/uuid --save-dev
```

**1.2 Create database schema:**
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('draft', 'paid')),
  payload_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  stripe_session_id TEXT,
  customer_email TEXT,
  vehicle_year INTEGER,
  vehicle_model TEXT
);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_stripe_session ON reports(stripe_session_id);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
```

**1.3 Add environment variables to `.env.local`:**
```env
# Vercel Postgres
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
POSTGRES_USER="..."
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="..."
```

---

### Phase 2: Report Creation Flow

**File: `app/api/report/create/route.ts`**

Creates draft report BEFORE payment:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportData } = body;

    if (!reportData || !reportData.confidence) {
      return NextResponse.json(
        { error: "Invalid report data" },
        { status: 400 }
      );
    }

    // Generate UUID for report
    const reportId = uuidv4();

    // Store as draft
    await sql`
      INSERT INTO reports (id, status, payload_json, vehicle_year, vehicle_model)
      VALUES (
        ${reportId},
        'draft',
        ${JSON.stringify(reportData)},
        ${reportData.input.year},
        ${reportData.input.model}
      )
    `;

    return NextResponse.json({
      reportId,
      status: "draft",
    });
  } catch (error) {
    console.error("Report creation error:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: Updated Checkout Flow

**File: `app/api/checkout/route.ts`** (modified)

```typescript
// Add reportId to checkout session
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  client_reference_id: reportId, // ← Link to database record
  line_items: [/* ... */],
  success_url: `${origin}/report/${reportId}?paid=true&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/report/${reportId}?canceled=true`,
  metadata: {
    reportId: reportId,
  },
});
```

---

### Phase 4: Webhook Updates Report Status

**File: `app/api/stripe/webhook/route.ts`** (add to fulfillOrder)

```typescript
async function fulfillOrder(session: Stripe.Checkout.Session) {
  const reportId = session.client_reference_id;
  const customerEmail = session.customer_details?.email;

  if (!reportId) {
    console.error("No reportId in session");
    return false;
  }

  try {
    // Mark report as paid in database
    const result = await sql`
      UPDATE reports
      SET
        status = 'paid',
        paid_at = NOW(),
        stripe_session_id = ${session.id},
        customer_email = ${customerEmail || null}
      WHERE id = ${reportId}
      AND status = 'draft'
      RETURNING id
    `;

    if (result.rowCount === 0) {
      console.error(`Report ${reportId} not found or already paid`);
      return false;
    }

    console.log("✅ Order fulfilled:", {
      reportId,
      sessionId: session.id,
      customerEmail,
      amountPaid: `$${(session.amount_total ?? 0) / 100}`,
    });

    return true;
  } catch (error) {
    console.error("Fulfillment error:", error);
    return false;
  }
}
```

---

### Phase 5: Report View Page

**File: `app/report/[reportId]/page.tsx`**

```typescript
import { sql } from "@vercel/postgres";
import { notFound, redirect } from "next/navigation";
import { ReportView } from "@/components/ReportView";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { reportId: string };
  searchParams: { paid?: string };
}) {
  const { reportId } = params;

  // Load report from database
  const result = await sql`
    SELECT status, payload_json, created_at, paid_at
    FROM reports
    WHERE id = ${reportId}
  `;

  if (result.rowCount === 0) {
    notFound();
  }

  const report = result.rows[0];
  const isPaid = report.status === "paid";
  const justPaid = searchParams.paid === "true";

  return (
    <div>
      <ReportView
        reportData={report.payload_json}
        reportId={reportId}
        isPaid={isPaid}
        justPaid={justPaid}
      />

      {isPaid && (
        <div className="mt-8 text-center">
          <a
            href={`/api/report/${reportId}/pdf`}
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700"
          >
            📄 Download PDF Report
          </a>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 6: PDF Template

**File: `lib/pdf/ReportPdf.tsx`**

(Full template as specified in your requirements)

---

### Phase 7: PDF Download API

**File: `app/api/report/[reportId]/pdf/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { pdf } from "@react-pdf/renderer";
import { ReportPdf } from "@/lib/pdf/ReportPdf";

export const runtime = "nodejs"; // Required for @react-pdf

export async function GET(
  _req: Request,
  { params }: { params: { reportId: string } }
) {
  const { reportId } = params;

  try {
    // Load report from database
    const result = await sql`
      SELECT status, payload_json, vehicle_year, vehicle_model
      FROM reports
      WHERE id = ${reportId}
    `;

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const report = result.rows[0];

    // Verify payment
    if (report.status !== "paid") {
      return NextResponse.json(
        { error: "Payment required" },
        { status: 402 }
      );
    }

    // Transform data for PDF
    const pdfData = transformReportForPDF(report.payload_json);

    // Generate PDF
    const instance = <ReportPdf data={pdfData} />;
    const buf = await pdf(instance).toBuffer();

    // Return PDF
    const filename = `EV-Risk-${report.vehicle_year}-${report.vehicle_model.replace(/\s+/g, "-")}-${reportId.slice(0, 8)}.pdf`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

function transformReportForPDF(reportData: any) {
  // Transform your report structure to match ReportPayload interface
  return {
    reportId: reportData.reportId || "N/A",
    level: reportData.confidence.rating.toLowerCase(),
    score: reportData.confidence.overall_score,
    summaryVerdict: reportData.confidence.recommendation,
    batteryRiskExplanation: [
      reportData.confidence.battery_risk.details,
      `Estimated degradation: ${reportData.confidence.battery_risk.degradation_percent}%`,
      `Replacement cost estimate: $${reportData.confidence.battery_risk.estimated_replacement_cost.toLocaleString()}`,
    ],
    platformRecallRisk: [
      reportData.confidence.platform_risk.details,
      `Total recalls: ${reportData.confidence.platform_risk.total_recalls}`,
      `Critical recalls: ${reportData.confidence.platform_risk.critical_recalls}`,
    ],
    ownershipFit: [
      reportData.confidence.ownership_fit.details,
      `Climate impact: ${reportData.confidence.ownership_fit.climate_impact}`,
      `Charger density: ${reportData.confidence.ownership_fit.charger_density}`,
    ],
    dealerQuestions: [
      "Has the battery been replaced or serviced?",
      "Are all recalls completed?",
      "Can you provide battery health report (SoH %)?",
      "What is the remaining manufacturer warranty?",
      "Has this vehicle been in any accidents?",
    ],
    walkAwayTriggers: [
      "Battery health below 80%",
      "Uncompleted safety recalls",
      "No service history available",
      "Seller refuses independent inspection",
      "Price significantly above market value",
    ],
  };
}
```

---

## Updated User Flow

### Before Payment:
1. User fills form → `POST /api/score` → gets risk analysis
2. Frontend calls `POST /api/report/create` → gets `reportId`
3. User clicks "Get Full Report" → `POST /api/checkout` with `reportId`
4. Stripe checkout opens

### After Payment:
5. Stripe webhook → marks report `paid` in database
6. User redirected to `/report/{reportId}?paid=true`
7. Page loads from database, shows "Download PDF" button
8. User clicks → `/api/report/{reportId}/pdf` → instant download

---

## Security Checklist

- [x] Report IDs are UUIDs (not guessable)
- [x] PDF endpoint checks `status = 'paid'`
- [x] No PII in URLs (email stored in database only)
- [x] No full payload in success URLs
- [x] Cache-Control: no-store on PDFs
- [x] Database queries use parameterized SQL (SQL injection safe)

---

## Testing Checklist

- [ ] Create draft report → verify database record
- [ ] Complete payment → verify status changes to 'paid'
- [ ] Attempt PDF download before payment → 402 error
- [ ] Download PDF after payment → success
- [ ] PDF contains all 6 sections
- [ ] Filename includes year/model
- [ ] Invalid reportId → 404 error

---

## Deployment Checklist (Vercel)

1. Set up Vercel Postgres:
   - Visit Vercel dashboard → Storage → Create Database
   - Copy connection strings to `.env.local`

2. Run database migration:
   ```sql
   -- Run in Vercel Postgres console
   CREATE TABLE reports (...);
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

4. Environment variables:
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - POSTGRES_URL (auto-populated by Vercel)

---

**Estimated implementation time:** 3-4 hours

**Ready to implement?** Let me know and I'll start with Phase 1!
