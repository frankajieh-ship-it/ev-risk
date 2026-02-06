/**
 * EV-Risk™ Report View Page (Database-Backed)
 *
 * GET /report/[reportId]
 * Loads report from database and redirects to legacy report page
 */

import { supabase } from "@/lib/supabase";
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

  // Load report from database
  let report;
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, status, payload_json, created_at, paid_at, vehicle_year, vehicle_model")
      .eq("id", reportId)
      .single();

    if (error) throw error;
    report = data;
  } catch (error) {
    console.error("Database error loading report:", error);
    console.error("Report ID:", reportId);
    console.error("Error details:", error instanceof Error ? error.message : String(error));

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Error Loading Report
          </h1>
          <p className="text-gray-600 mb-4">
            Unable to load report. Please try again later.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-4 p-4 bg-red-50 text-left text-xs text-red-900 rounded">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          )}
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

  // Check if report exists
  if (!report) {
    notFound();
  }

  const justPaid = search.paid === "true";

  // Prepare data for redirect to legacy report page
  const reportDataString = JSON.stringify(report.payload_json);

  // Build query string with reportId for PDF download
  const queryParams = new URLSearchParams();
  queryParams.set('data', reportDataString);
  queryParams.set('reportId', reportId);
  if (justPaid) {
    queryParams.set('paid', 'true');
  }

  // Redirect to legacy report page
  // Note: redirect() throws internally - this is expected Next.js behavior
  redirect(`/report?${queryParams.toString()}`);
}
