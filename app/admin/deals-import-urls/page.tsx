"use client";

import { useState, useRef } from "react";
import { ExternalLink, CheckCircle, XCircle, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ImportUrlResult } from "@/app/api/admin/deals-import-urls/route";

const VERDICT_COLOR: Record<string, string> = {
  GREEN: "text-emerald-400",
  YELLOW: "text-yellow-400",
  RED: "text-red-400",
};

const VERDICT_BG: Record<string, string> = {
  GREEN: "bg-emerald-400/10 border-emerald-400/20",
  YELLOW: "bg-yellow-400/10 border-yellow-400/20",
  RED: "bg-red-400/10 border-red-400/20",
};

function parseUrls(raw: string): string[] {
  // Accept newline-separated, comma-separated, or space-separated URLs
  return raw
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
}

export default function DealsImportUrlsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportUrlResult[] | null>(null);
  const [summary, setSummary] = useState<{ imported: number; skipped: number } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Batch processing state
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const abortRef = useRef(false);

  const parsedUrls = parseUrls(urlInput);
  const urlCount = parsedUrls.length;

  async function handleImport() {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    if (urlCount === 0) { alert("Paste at least one listing URL"); return; }

    setImporting(true);
    setResults(null);
    setSummary(null);
    setBatchError(null);
    abortRef.current = false;

    const BATCH_SIZE = 5; // process 5 at a time to stay under timeout
    const batches: string[][] = [];
    for (let i = 0; i < parsedUrls.length; i += BATCH_SIZE) {
      batches.push(parsedUrls.slice(i, i + BATCH_SIZE));
    }

    setBatchProgress({ done: 0, total: parsedUrls.length });

    const allResults: ImportUrlResult[] = [];
    let totalImported = 0;
    let totalSkipped = 0;

    for (const batch of batches) {
      if (abortRef.current) break;

      try {
        const res = await fetch("/api/admin/deals-import-urls", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminKey}`,
          },
          body: JSON.stringify({ urls: batch }),
        });

        const data = await res.json();

        if (!res.ok) {
          setBatchError(data.error ?? `HTTP ${res.status}`);
          break;
        }

        allResults.push(...(data.results ?? []));
        totalImported += data.imported ?? 0;
        totalSkipped += data.skipped ?? 0;
        setBatchProgress({ done: allResults.length, total: parsedUrls.length });
      } catch (e) {
        setBatchError(e instanceof Error ? e.message : "Network error");
        break;
      }
    }

    setResults(allResults);
    setSummary({ imported: totalImported, skipped: totalSkipped });
    setBatchProgress(null);
    setImporting(false);
  }

  function handleStop() {
    abortRef.current = true;
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/deals"
          className="text-white/40 hover:text-white/70 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Import Deals from URLs</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Paste CarGurus (or other marketplace) URLs — system scrapes, scores with OFFO, and adds to the deals feed automatically.
          </p>
        </div>
      </div>

      {/* Auth */}
      <div className="mb-5">
        <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Admin API Key</label>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="sk-..."
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
        />
      </div>

      {/* URL input */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-white/40 uppercase tracking-wider">
            Listing URLs
          </label>
          {urlCount > 0 && (
            <span className="text-xs text-white/30">{urlCount} URL{urlCount !== 1 ? "s" : ""} detected</span>
          )}
        </div>
        <textarea
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder={`Paste one URL per line, e.g.:\nhttps://www.cargurus.com/Cars/listing/...#listing=...\nhttps://www.cargurus.com/Cars/listing/...#listing=...`}
          rows={8}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 font-mono resize-y"
        />
        <p className="text-xs text-white/25 mt-1.5">
          Supports newline, comma, or space separated. Max 20 URLs per batch — larger lists are automatically batched.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5 text-xs text-white/40 space-y-1">
        <p className="text-white/60 font-medium mb-2">What happens when you click Import:</p>
        <p>1. Each URL is fetched and vehicle data extracted (year, make, model, price, mileage, location, VIN)</p>
        <p>2. Signals are inferred from the listing (VIN present, title status, mileage, DCFC, etc.)</p>
        <p>3. OFFO deterministic scoring runs — generates verdict (GREEN/YELLOW/RED), fit score, evidence score, risk flags</p>
        <p>4. Deal photo is auto-fetched from local CSV or Auto.dev</p>
        <p>5. Deal is upserted into <code className="bg-white/[0.06] px-1 rounded">curated_deals</code> and immediately visible on <code className="bg-white/[0.06] px-1 rounded">/deals</code></p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handleImport}
          disabled={importing || urlCount === 0 || !adminKey}
          className="flex items-center gap-2 px-4 py-2 bg-[#00d97e] text-black text-sm font-semibold rounded-lg hover:bg-[#00c270] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Importing...
            </>
          ) : (
            `Import & Score ${urlCount > 0 ? `${urlCount} URL${urlCount !== 1 ? "s" : ""}` : "URLs"}`
          )}
        </button>

        {importing && (
          <button
            onClick={handleStop}
            className="px-4 py-2 border border-white/[0.12] text-white/60 text-sm rounded-lg hover:border-white/20 hover:text-white/80 transition-colors"
          >
            Stop
          </button>
        )}

        <Link
          href="/admin/deals"
          className="px-4 py-2 border border-white/[0.08] text-white/40 text-sm rounded-lg hover:border-white/12 hover:text-white/60 transition-colors"
        >
          View Deals Table
        </Link>
      </div>

      {/* Batch progress */}
      {batchProgress && (
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
            <span>Processing… {batchProgress.done} / {batchProgress.total}</span>
            <span>{Math.round((batchProgress.done / batchProgress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00d97e] rounded-full transition-all duration-300"
              style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Batch-level error */}
      {batchError && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {batchError}
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="flex gap-3 mb-5">
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{summary.imported}</div>
            <div className="text-xs text-white/40 mt-0.5">Imported</div>
          </div>
          <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white/60">{summary.skipped}</div>
            <div className="text-xs text-white/40 mt-0.5">Skipped / Errors</div>
          </div>
          <div className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white/60">{(results ?? []).length}</div>
            <div className="text-xs text-white/40 mt-0.5">Total Processed</div>
          </div>
        </div>
      )}

      {/* Per-URL results */}
      {results && results.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-white/60 mb-3">Results</h2>
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3 ${
                r.status === "imported"
                  ? r.verdict
                    ? VERDICT_BG[r.verdict] ?? "bg-white/[0.04] border-white/[0.08]"
                    : "bg-white/[0.04] border-white/[0.08]"
                  : r.status === "error"
                  ? "bg-red-500/5 border-red-500/15"
                  : "bg-white/[0.03] border-white/[0.06]"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {r.status === "imported" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : r.status === "error" ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Vehicle label */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">
                      {r.vehicle_label ?? "Unknown vehicle"}
                    </span>
                    {r.verdict && (
                      <span className={`text-xs font-semibold ${VERDICT_COLOR[r.verdict]}`}>
                        {r.verdict}
                      </span>
                    )}
                    {r.extraction_confidence && (
                      <span className="text-xs text-white/30">
                        {r.extraction_confidence} confidence
                      </span>
                    )}
                  </div>

                  {/* Scores row */}
                  {r.status === "imported" && (
                    <div className="flex gap-4 mt-1 text-xs text-white/40">
                      {r.fit_score != null && <span>Fit {r.fit_score}</span>}
                      {r.evidence_score != null && <span>Evidence {r.evidence_score}</span>}
                      {r.risk_points != null && <span>Risk {r.risk_points}pts</span>}
                      {r.deal_quality_score != null && (
                        <span className="text-white/60">Quality {r.deal_quality_score}</span>
                      )}
                    </div>
                  )}

                  {/* Error message */}
                  {r.error && (
                    <p className="text-xs text-red-400/80 mt-1">{r.error}</p>
                  )}

                  {/* URL */}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-white/25 hover:text-white/50 transition-colors mt-1 truncate"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{r.url}</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state after run */}
      {results && results.length === 0 && (
        <div className="text-center py-10 text-white/30 text-sm">
          No URLs were processed.
        </div>
      )}
    </div>
  );
}
