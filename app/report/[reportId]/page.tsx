/**
 * EV-Risk™ Report View Page (Database-Backed)
 *
 * GET /report/[reportId]
 * Loads report from database and displays based on payment status
 */

import { sql } from "@vercel/postgres";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { reportId: string };
  searchParams: { paid?: string; canceled?: string; session_id?: string };
}) {
  const { reportId } = params;

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
    const justPaid = searchParams.paid === "true";
    const wasCanceled = searchParams.canceled === "true";

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          {/* Success Message */}
          {justPaid && (
            <div className="mb-6 p-4 bg-green-100 border border-green-400 rounded-lg">
              <h2 className="text-lg font-semibold text-green-800 mb-1">
                ✅ Payment Successful!
              </h2>
              <p className="text-green-700">
                Your full report is now available. You can download it as a PDF
                below.
              </p>
            </div>
          )}

          {/* Cancel Message */}
          {wasCanceled && !isPaid && (
            <div className="mb-6 p-4 bg-yellow-100 border border-yellow-400 rounded-lg">
              <h2 className="text-lg font-semibold text-yellow-800 mb-1">
                Payment Canceled
              </h2>
              <p className="text-yellow-700">
                You can complete your purchase anytime by clicking "Get Full
                Report" below.
              </p>
            </div>
          )}

          {/* Report Content */}
          <ReportView
            reportData={report.payload_json}
            reportId={reportId}
            isPaid={isPaid}
            justPaid={justPaid}
          />

          {/* PDF Download Button (only for paid reports) */}
          {isPaid && (
            <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Download Your Report
              </h3>
              <p className="text-gray-600 mb-4">
                Get a professionally formatted PDF of your complete EV risk
                analysis.
              </p>
              <a
                href={`/api/report/${reportId}/pdf`}
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                📄 Download PDF Report
              </a>
              <p className="text-xs text-gray-500 mt-3">
                Report ID: {reportId.slice(0, 8)}...
              </p>
            </div>
          )}

          {/* Purchase Button (only for unpaid reports) */}
          {!isPaid && (
            <div className="mt-8 p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg text-center">
              <h3 className="text-2xl font-bold mb-2">
                Unlock Full Report - $15
              </h3>
              <p className="text-blue-100 mb-4">
                Get complete risk analysis, dealer questions, and downloadable
                PDF
              </p>
              <button
                onClick={async () => {
                  try {
                    // Report already exists, just create checkout session
                    const checkoutResponse = await fetch("/api/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ reportId }),
                    });

                    const checkoutData = await checkoutResponse.json();

                    if (checkoutData.url) {
                      window.location.href = checkoutData.url;
                    } else {
                      alert("Failed to create checkout session");
                    }
                  } catch (error) {
                    console.error("Checkout error:", error);
                    alert("Failed to start checkout");
                  }
                }}
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md"
              >
                Get Full Report - $15
              </button>
              <p className="text-xs text-blue-200 mt-3">
                Instant access • Secure payment via Stripe
              </p>
            </div>
          )}

          {/* Report Metadata */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Report created:{" "}
              {new Date(report.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            {isPaid && report.paid_at && (
              <p>
                Purchased:{" "}
                {new Date(report.paid_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>
      </div>
    );
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
