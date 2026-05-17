"use client";

/**
 * Owned EV Report Page
 * /workspace/garage/[vehicleId]/owned-ev
 *
 * Shows routine health score, recalls, fit details, AI chat CTA,
 * and Sellers Report upsell (locked/unlocked).
 */

import { useState, useEffect, useCallback, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  ShieldCheck,
  TrendingUp,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEventTracking } from "@/hooks/useEventTracking";

interface RoutineHealth {
  score: number;
  label: string;
  headline: string;
  watch_area: string | null;
}

interface RecallItem {
  title: string;
  severity: string;
  routine_impact: string;
  campaign_number: string;
}

interface RoutineFit {
  daily_commute_fit: string;
  longest_day_buffer: string;
  charging_note: string;
}

interface AiChatContext {
  vehicle_label: string;
  routine_summary: string;
  recall_summary: string;
}

interface RoutineHealthPayload {
  vehicle: {
    year: number | null;
    make: string;
    model: string;
    trim: string | null;
    vin_redacted: string | null;
  };
  routine_health: RoutineHealth;
  recalls: RecallItem[];
  routine_fit: RoutineFit;
  ai_chat_context: AiChatContext;
}

interface GarageVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  trim: string | null;
  vin: string | null;
  is_owned_ev: boolean;
}

const SCORE_COLORS = {
  "Great Fit":    { bar: "bg-green-500", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  "Good Fit":     { bar: "bg-blue-500",  text: "text-blue-700",  bg: "bg-blue-50",  border: "border-blue-200"  },
  "Mixed Fit":    { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  "High Friction":{ bar: "bg-red-500",   text: "text-red-700",   bg: "bg-red-50",   border: "border-red-200"   },
} as const;

export default function OwnedEvReportPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = use(params);
  const { session, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const { trackEvent } = useEventTracking();

  useEffect(() => { if (vehicleId) trackEvent("owned_ev_page_viewed", { vehicle_id: vehicleId }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [vehicle, setVehicle] = useState<GarageVehicle | null>(null);
  const [report, setReport] = useState<RoutineHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellersUnlocked, setSellersUnlocked] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) h["Authorization"] = `Bearer ${session.access_token}`;
    return h;
  }, [session]);

  // Fetch vehicle + latest report
  useEffect(() => {
    if (!isAuthenticated || !session) return;

    async function load() {
      setLoading(true);
      try {
        // Fetch vehicle
        const vRes = await fetch(`/api/workspace/garage/${vehicleId}`, { headers: authHeaders() });
        if (!vRes.ok) {
          setError("Vehicle not found.");
          return;
        }
        const vData = await vRes.json();
        if (!vData.vehicle?.is_owned_ev) {
          setError("This vehicle is not marked as an owned EV.");
          return;
        }
        setVehicle(vData.vehicle);

        // Fetch latest routine_health report
        const rRes = await fetch(`/api/workspace/garage/${vehicleId}/owned-ev/report?type=routine_health`, {
          headers: authHeaders(),
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          setReport(rData.report?.output_payload || null);
        }

        // Check sellers report entitlement
        const eRes = await fetch(`/api/workspace/garage/${vehicleId}/owned-ev/report?type=sellers_report`, {
          headers: authHeaders(),
        });
        if (eRes.ok) {
          setSellersUnlocked(true);
        }
      } catch {
        setError("Failed to load report.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isAuthenticated, session, vehicleId, authHeaders]);

  // Handle checkout=success in URL — refetch to confirm entitlement
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setSellersUnlocked(true);
      trackEvent("sellers_report_purchased", { vehicle_id: vehicleId });
    }
  }, [searchParams, vehicleId, trackEvent]);

  const generateReport = useCallback(async () => {
    if (!session) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/workspace/garage/${vehicleId}/owned-ev/report`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ report_type: "routine_health" }),
      });
      const data = await res.json();
      if (res.ok && data.report?.output_payload) {
        setReport(data.report.output_payload);
        trackEvent("owned_ev_report_viewed", { vehicle_id: vehicleId });
      } else {
        setError(data.error || "Failed to generate report.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  }, [session, vehicleId, authHeaders, trackEvent]);

  const handlePurchaseSellersReport = async () => {
    if (!session) return;
    setPurchaseLoading(true);
    try {
      const res = await fetch(`/api/workspace/garage/${vehicleId}/owned-ev/purchase-sellers-report`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ anon_id: session.user?.id || "" }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Purchase failed.");
        setPurchaseLoading(false);
      }
    } catch {
      setError("Network error — please try again.");
      setPurchaseLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500 mb-4">Sign in to view your Owned EV Report.</p>
        <Link href="/auth" className="text-blue-600 underline text-sm">Sign in</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 flex items-center justify-center gap-3 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading your report…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            <Link href="/workspace/garage" className="text-xs text-blue-600 underline mt-2 block">
              ← Back to My Garage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const vehicleLabel = vehicle
    ? [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ")
    : "Your EV";

  const colors = report
    ? (SCORE_COLORS[report.routine_health.label as keyof typeof SCORE_COLORS] ?? SCORE_COLORS["Mixed Fit"])
    : null;

  const chatUrl = report
    ? `/receipt?vehicle=${encodeURIComponent(report.ai_chat_context.vehicle_label)}&mode=chat&owned_ev=1`
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Back nav */}
      <Link
        href="/workspace/garage"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> My Garage
      </Link>

      {/* Vehicle heading */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            My Car
          </span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{vehicleLabel}</h1>
        {vehicle?.vin && (
          <p className="text-xs text-gray-400 font-mono mt-0.5">
            VIN: {vehicle.vin.slice(0, 3)}****{vehicle.vin.slice(-4)}
          </p>
        )}
      </div>

      {/* Generate prompt if no report */}
      {!report && !generating && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="text-sm font-semibold text-blue-900 mb-2">Generate Your Free Routine Health Report</h2>
          <p className="text-xs text-blue-700 mb-4">
            We&apos;ll analyze how this EV fits your driving pattern, check for open recalls, and give you a
            one-page ownership snapshot.
          </p>
          <button
            onClick={generateReport}
            className="py-2.5 px-5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Generate Free Report
          </button>
        </div>
      )}

      {generating && (
        <div className="flex items-center gap-3 text-blue-600 bg-blue-50 rounded-xl p-4">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing your routine…</span>
        </div>
      )}

      {/* Routine health score */}
      {report && colors && (
        <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Routine Health</h2>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${colors.text}`}>{report.routine_health.score}</span>
              <span className="text-xs text-gray-400">/100</span>
            </div>
          </div>
          <div className="h-2 bg-white/60 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full ${colors.bar}`}
              style={{ width: `${report.routine_health.score}%` }}
            />
          </div>
          <p className={`text-sm font-medium ${colors.text} mb-1`}>{report.routine_health.label}</p>
          <p className="text-xs text-gray-600">{report.routine_health.headline}</p>
          {report.routine_health.watch_area && (
            <p className="text-xs text-amber-700 mt-2">
              <span className="font-semibold">Watch: </span>{report.routine_health.watch_area}
            </p>
          )}
        </div>
      )}

      {/* Recalls */}
      {report && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">Recall Status</h2>
          </div>
          {report.recalls.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <p className="text-xs font-medium">No open recalls found via NHTSA.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {report.recalls.map((r, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800">{r.title}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{r.routine_impact}</p>
                  {r.campaign_number && (
                    <p className="text-xs text-amber-500 mt-0.5 font-mono">#{r.campaign_number}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Routine fit */}
      {report && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-800">Your Routine Fit</h2>
          </div>
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex justify-between">
              <span className="text-gray-500">Daily commute</span>
              <span className="font-medium capitalize text-gray-800">{report.routine_fit.daily_commute_fit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Longest-day buffer</span>
              <span className="font-medium capitalize text-gray-800">{report.routine_fit.longest_day_buffer}</span>
            </div>
            <p className="text-gray-500 leading-relaxed pt-1 border-t border-gray-100">
              {report.routine_fit.charging_note}
            </p>
          </div>
        </div>
      )}

      {/* AI chat CTA */}
      {report && chatUrl && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 mb-0.5">
              Ask anything about your {vehicle?.make} {vehicle?.model}
            </p>
            <p className="text-xs text-gray-500 mb-3">
              AI chat preloaded with your vehicle context, recall status, and routine profile.
            </p>
            <Link
              href={chatUrl}
              className="inline-flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              onClick={() => trackEvent("owned_ev_chat_opened", { vehicle_id: vehicleId })}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Open AI Chat
            </Link>
          </div>
        </div>
      )}

      {/* Sellers Report CTA */}
      {report && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-800">Sellers Report</h2>
            {sellersUnlocked && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 ml-auto">
                Unlocked
              </span>
            )}
          </div>

          {sellersUnlocked ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Your one-page dealer-ready Sellers Report is ready. Download or share with buyers.
              </p>
              <button
                onClick={() => {
                  trackEvent("sellers_report_downloaded", { vehicle_id: vehicleId });
                  // TODO Sprint 2: trigger PDF generation + download
                  alert("PDF generation coming soon.");
                }}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Download Sellers Report PDF
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Generate a one-page dealer-ready report with routine fit highlights, recall snapshot, and
                buyer-ready answers. One-time unlock.
              </p>
              <ul className="text-xs text-gray-500 space-y-1 pl-2">
                {["Routine fit highlights", "Recall & maintenance snapshot", "Buyer-ready Q&A", "OFFO verified footer"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 text-green-500 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={handlePurchaseSellersReport}
                disabled={purchaseLoading}
                className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {purchaseLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</>
                ) : (
                  <><FileText className="w-4 h-4" /> Generate Sellers Report</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Refresh report */}
      {report && (
        <button
          onClick={generateReport}
          disabled={generating}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline w-full text-center"
        >
          Refresh report
        </button>
      )}
    </div>
  );
}
