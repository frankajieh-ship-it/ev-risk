"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, ExternalLink, Loader2, AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

interface PaidReport {
  purchase_id: string;
  receipt_id: string;
  purchased_at: string;
  amount: number | null;
  pack_tier: string | null;
  listing_url: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  verdict: string | null;
}

function verdictStyle(verdict: string | null) {
  switch (verdict?.toLowerCase()) {
    case "good deal":  return "bg-[#00d97e]/15 text-[#00d97e] border-[#00d97e]/30";
    case "fair":       return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
    case "overpriced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default:           return "bg-white/[0.06] text-white/40 border-white/[0.10]";
  }
}

export default function WorkspaceReceiptsPage() {
  const { session } = useAuth();
  const [reports, setReports] = useState<PaidReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/workspace/receipts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError("Failed to load reports."); return; }
      setReports(data.reports);
    } catch {
      setError("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-400/50" />
        <p className="text-sm text-white/40">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">My Reports</h1>
        <p className="text-sm text-white/40 mt-1">All your purchased OFFO reports — click any to reopen.</p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <FileText className="w-7 h-7 text-white/20" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/50">No paid reports yet</p>
            <p className="text-xs text-white/30 mt-1">Run a check on any EV listing to get started.</p>
          </div>
          <Link
            href="/receipt"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Check a Listing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const vehicleLabel = [report.year, report.make, report.model].filter(Boolean).join(" ") || "Unknown Vehicle";
            const purchaseDate = new Date(report.purchased_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

            return (
              <Link
                key={report.purchase_id}
                href={`/receipt?id=${report.receipt_id}`}
                className="block bg-[#161b22] border border-white/[0.08] rounded-2xl p-4 hover:border-white/20 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{vehicleLabel}</p>
                      {report.verdict && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${verdictStyle(report.verdict)}`}>
                          {report.verdict}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                      {report.price != null && (
                        <span className="text-xs text-white/40">${report.price.toLocaleString()}</span>
                      )}
                      {report.mileage != null && (
                        <span className="text-xs text-white/40">{report.mileage.toLocaleString()} mi</span>
                      )}
                      {report.vin && (
                        <span className="text-xs font-mono text-white/30">{report.vin}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/25 mt-1.5">Purchased {purchaseDate}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-[#00d97e] transition-colors shrink-0 mt-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
