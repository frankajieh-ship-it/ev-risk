"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

interface FeedbackRow {
  id: string;
  created_at: string;
  rating: number;
  feedback_text: string | null;
  would_recommend: boolean | null;
  report_id: string | null;
  receipts: {
    listing_url: string | null;
    vin: string | null;
    listing_summary: Record<string, unknown> | null;
  } | null;
}

const RATING_FILTER = [
  { label: "All", value: "" },
  { label: "👍 Helpful", value: "5" },
  { label: "😐 Okay", value: "3" },
  { label: "👎 Not useful", value: "1" },
];

function ratingLabel(r: number) {
  return r === 5 ? "👍 Helpful" : r === 3 ? "😐 Okay" : "👎 Not useful";
}

function ratingColor(r: number) {
  return r === 5 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : r === 3 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function AdminFeedbackPage() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [filter, setFilter] = useState("");
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: string, rating: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = rating ? `?rating=${rating}` : "";
      const res = await fetch(`/api/admin/feedback${qs}`, { headers: { "x-api-key": key } });
      const data = await res.json();
      if (data.success) setRows(data.feedback);
      else setError(data.error ?? "Failed to load");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load(apiKey, filter);
  }, [authed, filter, apiKey, load]);

  const counts = {
    total: rows.length,
    helpful: rows.filter(r => r.rating === 5).length,
    okay: rows.filter(r => r.rating === 3).length,
    notUseful: rows.filter(r => r.rating === 1).length,
    withText: rows.filter(r => r.feedback_text).length,
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-white">Admin — Feedback</h1>
          <input
            type="password"
            placeholder="Admin API key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && apiKey && setAuthed(true)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-[#00d97e]/50"
          />
          <button
            onClick={() => apiKey && setAuthed(true)}
            className="w-full bg-[#00d97e] text-[#0d1117] font-bold py-2.5 rounded-lg text-sm"
          >
            View Feedback
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">User Feedback</h1>
          <p className="text-sm text-white/40 mt-0.5">{counts.total} responses · {counts.withText} with comments</p>
        </div>
        <button onClick={() => load(apiKey, filter)} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
          <div className="text-xl font-black text-emerald-400">{counts.helpful}</div>
          <div className="text-[10px] text-emerald-400/60 font-semibold uppercase tracking-wider mt-0.5">Helpful</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
          <div className="text-xl font-black text-yellow-400">{counts.okay}</div>
          <div className="text-[10px] text-yellow-400/60 font-semibold uppercase tracking-wider mt-0.5">Okay</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
          <div className="text-xl font-black text-red-400">{counts.notUseful}</div>
          <div className="text-[10px] text-red-400/60 font-semibold uppercase tracking-wider mt-0.5">Not useful</div>
        </div>
        {counts.total > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
            <div className="text-xl font-black text-white">{Math.round((counts.helpful / counts.total) * 100)}%</div>
            <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">Positive</div>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {RATING_FILTER.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f.value
                ? "bg-[#00d97e]/10 border-[#00d97e]/30 text-[#00d97e]"
                : "border-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feedback list */}
      {loading ? (
        <div className="text-white/30 text-sm py-12 text-center">Loading…</div>
      ) : error ? (
        <div className="text-red-400 text-sm py-12 text-center">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-white/30 text-sm py-12 text-center">No feedback found</div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const ls = row.receipts?.listing_summary;
            const vehicleLabel = ls
              ? [ls.year, ls.make, ls.model].filter(Boolean).join(" ")
              : null;
            const listingUrl = row.receipts?.listing_url;
            const vin = row.receipts?.vin;

            return (
              <div key={row.id} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ratingColor(row.rating)}`}>
                      {ratingLabel(row.rating)}
                    </span>
                    {row.would_recommend !== null && (
                      <span className="text-xs text-white/30">
                        {row.would_recommend ? "Would recommend" : "Wouldn't recommend"}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/25 shrink-0">{timeAgo(row.created_at)}</span>
                </div>

                {row.feedback_text && (
                  <p className="text-sm text-white/80 mb-2 leading-relaxed">
                    &ldquo;{row.feedback_text}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-3 flex-wrap text-xs text-white/30">
                  {vehicleLabel && <span className="text-white/50 font-medium">{vehicleLabel}</span>}
                  {vin && <span className="font-mono">{vin}</span>}
                  {listingUrl && (
                    <a
                      href={listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-white/60 transition-colors"
                    >
                      Listing <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                  {row.report_id && (
                    <a
                      href={`/receipt?id=${row.report_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-white/60 transition-colors"
                    >
                      View report <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
