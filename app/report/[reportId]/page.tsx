/**
 * EV-Risk™ Report View Page (Database-Backed)
 *
 * GET /report/[reportId]
 * Loads report from database and redirects to legacy report page
 */

import { sql } from "@vercel/postgres";
import { notFound, redirect } from "next/navigation";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ paid?: string; canceled?: string; session_id?: string }>;
}) {
  const { reportId } = await params;
  const search = await searchParams;

  try {
    // Load report from database
    const result = await sql`
      SELECT
        id,
        status,
        payload_json,
        created_at,
        paid_at,
        vehicle_year,
        vehicle_model
      FROM reports
      WHERE id = ${reportId}
    `;

    if (result.rowCount === 0) {
      notFound();
    }

    const report = result.rows[0];
    const isPaid = report.status === "paid";
    const justPaid = search.paid === "true";

    // For now, redirect to the existing report page with data param
    // This ensures the existing UI works while we implement the new page
    const reportDataString = JSON.stringify(report.payload_json);
    const dataParam = encodeURIComponent(reportDataString);

    // Redirect to legacy report page
    redirect(`/report?data=${dataParam}${justPaid ? '&paid=true' : ''}`);

  } catch (error) {
    console.error("Error loading report:", error);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Error Loading Report
          </h1>
          <p className="text-gray-600 mb-4">
            Unable to load report. Please try again later.
          </p>
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }
}
