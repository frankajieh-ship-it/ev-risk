"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, ArrowUpDown, ExternalLink, Upload, Download, Link2, Cpu } from "lucide-react";
import Link from "next/link";

interface DealRow {
  id: string;
  listing_url: string;
  url_domain: string | null;
  vehicle_label: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  price: number | null;
  mileage: number | null;
  verdict: "GREEN" | "YELLOW" | "RED" | null;
  fit_score: number | null;
  evidence_score: number | null;
  risk_points: number | null;
  deal_quality_score: number | null;
  risk_flags: string[] | null;
  receipt_id: string | null;
  last_analyzed_at: string | null;
  is_active: boolean;
  created_at: string | null;
}

type SortKey = keyof DealRow;
type SortDir = "asc" | "desc";

const VERDICT_COLOR: Record<string, string> = {
  GREEN: "text-emerald-400",
  YELLOW: "text-yellow-400",
  RED: "text-red-400",
};

export default function AdminDealsPage() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("deal_quality_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adminKey, setAdminKey] = useState("");
  const authHeader = adminKey ? `Bearer ${adminKey}` : "";
  const [rescoring, setRescoring] = useState(false);
  const rescoringPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const [rescopeDate, setRescopeDate] = useState(todayStr);
  const [rescopeOnly, setRescopeOnly] = useState(true);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/deals-debug", { headers: { Authorization: authHeader } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDeals(data.deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  const handleExport = (format: "csv" | "template") => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    // Use direct browser navigation with key as query param — avoids fetch+blob issues
    window.location.href = `/api/admin/deals-export?format=${format}&key=${encodeURIComponent(adminKey)}`;
  };

  const handleToggleActive = async (id: string, newActive: boolean) => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    try {
      const res = await fetch("/api/admin/deals-toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ id, is_active: newActive }),
      });
      const data = await res.json();
      if (data.success) {
        setDeals((prev) => prev.map((d) => d.id === id ? { ...d, is_active: newActive } : d));
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch {
      alert("Toggle failed");
    }
  };

  const handleCheckSold = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    const active = deals.filter((d) => d.is_active).length;
    if (!confirm(`Check all ${active} active listings for sold/removed status? This may take a couple of minutes.`)) return;
    setImportStatus("⏳ Sold check started — table refreshes every 15s...");
    setRescoring(true);
    try {
      await fetch("/api/admin/deals-check-sold", { method: "POST", headers: { Authorization: authHeader } });
      rescoringPollRef.current = setInterval(fetchDeals, 15000);
      setTimeout(() => {
        if (rescoringPollRef.current) clearInterval(rescoringPollRef.current);
        setRescoring(false);
        setImportStatus("✓ Sold check complete — check table for deactivated rows");
        fetchDeals();
      }, 3 * 60 * 1000);
    } catch {
      setImportStatus("✗ Failed to start sold check");
      setRescoring(false);
    }
  };

  const handleBackfillPhotos = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    if (!confirm("Fetch photos for all active deals with missing images? This may take a while.")) return;
    setImportStatus("Backfilling photos...");
    try {
      const res = await fetch("/api/admin/deals-backfill-photos", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`✓ Backfilled photos: ${data.updated} updated, ${data.failed} failed (${data.total} rows processed)`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Backfill failed");
    }
  };

  const handleRescoreAll = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    const since = rescopeOnly && rescopeDate ? rescopeDate : undefined;
    const scopeLabel = since ? `from ${since}` : `all ${deals.length}`;
    const rowsInScope = since
      ? deals.filter((d) => d.created_at && d.created_at.startsWith(since)).length
      : deals.length;
    if (!confirm(`Re-score ${rowsInScope} deal${rowsInScope !== 1 ? "s" : ""} ${scopeLabel} with AI? This activates all rescored rows.`)) return;
    setRescoring(true);
    setImportStatus(`⏳ Rescore job started${since ? ` for ${since}` : ""} — table refreshes every 15s...`);
    try {
      const res = await fetch("/api/admin/deals-rescore-all", {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ since }),
      });
      const data = await res.json();
      if (!data.ok) {
        setImportStatus(`✗ ${data.error}`);
        setRescoring(false);
        return;
      }
      // If dev mode returned inline results, show them immediately
      if (data.rescored !== undefined) {
        setImportStatus(`✓ Rescored ${data.rescored} deals (${data.failed ?? 0} failed)`);
        setRescoring(false);
        fetchDeals();
        return;
      }
      // Prod: poll every 15s for up to 10 minutes
      rescoringPollRef.current = setInterval(fetchDeals, 15000);
      setTimeout(() => {
        if (rescoringPollRef.current) clearInterval(rescoringPollRef.current);
        setRescoring(false);
        setImportStatus("✓ Rescore job finished (check Netlify logs for details)");
        fetchDeals();
      }, 10 * 60 * 1000);
    } catch {
      setImportStatus("✗ Failed to start rescore job");
      setRescoring(false);
    }
  };

  const handleActivateAll = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    const inactive = deals.filter((d) => !d.is_active);
    if (inactive.length === 0) { alert("No inactive deals to activate"); return; }
    if (!confirm(`Activate all ${inactive.length} inactive deals?`)) return;
    try {
      const res = await fetch("/api/admin/deals-toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ bulk: true, is_active: true }),
      });
      const data = await res.json();
      if (data.success) {
        setDeals((prev) => prev.map((d) => ({ ...d, is_active: true })));
        setImportStatus(`✓ Activated ${data.updated ?? inactive.length} deals`);
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch {
      alert("Bulk activate failed");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/deals-import", { method: "POST", headers: { Authorization: authHeader }, body: formData });
      const data = await res.json();
      if (data.success) {
        const deactivatedNote = data.deactivated > 0 ? `, ${data.deactivated} deactivated (not in CSV)` : "";
        setImportStatus(`✓ Imported ${data.imported} deals (${data.skipped} skipped${deactivatedNote})`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = deals.filter((d) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      d.vehicle_label?.toLowerCase().includes(q) ||
      d.make?.toLowerCase().includes(q) ||
      d.model?.toLowerCase().includes(q) ||
      d.verdict?.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(k)}
      className="flex items-center gap-1 hover:text-white transition-colors whitespace-nowrap"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-[#00d97e]" : "text-white/20"}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Deals Debug</h1>
            <p className="text-xs text-white/40 mt-0.5">{sorted.length} of {deals.length} listings</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <input
              type="password"
              placeholder="Admin API key..."
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 w-44 focus:outline-none focus:border-[#00d97e]/40"
            />
            <input
              type="text"
              placeholder="Filter by make, model, verdict..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 w-56 focus:outline-none focus:border-[#00d97e]/40"
            />
            <Link
              href="/admin/deals-import-urls"
              className="flex items-center gap-1.5 text-xs text-[#00d97e] hover:text-[#00c270] border border-[#00d97e]/30 hover:border-[#00d97e]/50 rounded-lg px-3 py-2 transition-colors font-medium"
            >
              <Link2 className="w-3.5 h-3.5" />
              Import from URLs
            </Link>
            {/* Date-scoped rescore controls */}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={rescopeDate}
                onChange={(e) => setRescopeDate(e.target.value)}
                className="bg-[#161b22] border border-white/[0.08] text-white/60 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-[#00d97e]/40 w-32"
              />
              <label className="flex items-center gap-1 text-xs text-white/40 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={rescopeOnly}
                  onChange={(e) => setRescopeOnly(e.target.checked)}
                  className="accent-[#00d97e] w-3 h-3"
                />
                date only
              </label>
            </div>
            <button
              onClick={handleRescoreAll}
              disabled={rescoring}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${rescoring ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-[#00d97e] border-white/[0.08]"}`}
            >
              <Cpu className={`w-3.5 h-3.5 ${rescoring ? "animate-pulse" : ""}`} />
              {rescoring ? "Rescoring..." : rescopeOnly && rescopeDate ? `Rescore ${rescopeDate.slice(5)} (AI)` : "Rescore All (AI)"}
            </button>
            <button onClick={handleActivateAll}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-emerald-400 border border-white/[0.08] rounded-lg px-3 py-2 transition-colors">
              Activate All
            </button>
            <button onClick={handleCheckSold} disabled={rescoring}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${rescoring ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-red-400 border-white/[0.08]"}`}>
              Check Sold
            </button>
            <button onClick={handleBackfillPhotos}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[#00d97e] border border-white/[0.08] rounded-lg px-3 py-2 transition-colors">
              Backfill Photos
            </button>
            <button onClick={() => handleExport("template")}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[#00d97e] border border-white/[0.08] rounded-lg px-3 py-2 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Template
            </button>
            <button onClick={() => handleExport("csv")}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[#00d97e] border border-white/[0.08] rounded-lg px-3 py-2 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <label className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 cursor-pointer transition-colors ${importing ? "text-white/20 border-white/[0.04]" : "text-white/40 hover:text-[#00d97e] border-white/[0.08]"}`}>
              <Upload className="w-3.5 h-3.5" />
              {importing ? "Importing..." : "Import CSV"}
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
            </label>
            <button onClick={fetchDeals} disabled={loading}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 border border-white/[0.08] rounded-lg px-3 py-2 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {importStatus && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${importStatus.startsWith("✓") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
            {importStatus}
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#161b22] text-white/40">
                <th className="text-left px-4 py-3"><SortBtn k="vehicle_label" label="Vehicle" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="created_at" label="Added" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="price" label="Price" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="mileage" label="Miles" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="verdict" label="Verdict" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="fit_score" label="Fit" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="evidence_score" label="Evidence" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="risk_points" label="Risk Pts" /></th>
                <th className="text-right px-3 py-3"><SortBtn k="deal_quality_score" label="Quality" /></th>
                <th className="text-left px-3 py-3 min-w-[200px]">Flags</th>
                <th className="text-center px-3 py-3"><SortBtn k="is_active" label="Active" /></th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {Array.from({ length: 12 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-white/30">No deals found</td>
                </tr>
              ) : (
                sorted.map((d) => (
                  <tr key={d.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="font-medium text-white/80 truncate">{d.vehicle_label ?? `${d.year} ${d.make} ${d.model}`}</div>
                      <div className="text-white/30 text-[10px] mt-0.5">{d.url_domain}</div>
                    </td>
                    <td className="px-3 py-3 text-right text-white/40 text-[10px] whitespace-nowrap">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-white/60">
                      {d.price ? `$${d.price.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-white/50">
                      {d.mileage ? d.mileage.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`font-semibold ${d.verdict ? VERDICT_COLOR[d.verdict] : "text-white/30"}`}>
                        {d.verdict ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono">
                      <span className={d.fit_score != null ? (d.fit_score >= 72 ? "text-emerald-400" : d.fit_score >= 45 ? "text-yellow-400" : "text-red-400") : "text-white/30"}>
                        {d.fit_score ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-white/60">{d.evidence_score ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-white/60">{d.risk_points ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-mono text-white/70 font-semibold">{d.deal_quality_score ?? "—"}</td>
                    <td className="px-3 py-3 text-white/30 text-[10px] max-w-[200px]">
                      <div className="line-clamp-2">{d.risk_flags?.join(", ") ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(d.id, !d.is_active)}
                        title={d.is_active ? "Click to deactivate" : "Click to activate"}
                        className={`font-semibold transition-colors cursor-pointer ${d.is_active ? "text-emerald-400 hover:text-red-400" : "text-white/20 hover:text-emerald-400"}`}
                      >
                        {d.is_active ? "✓" : "✗"}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {d.receipt_id && (
                          <a href={`/receipt?id=${d.receipt_id}`} target="_blank" rel="noopener noreferrer"
                            className="text-white/30 hover:text-white/70 transition-colors" title="View receipt">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a href={d.listing_url} target="_blank" rel="noopener noreferrer"
                          className="text-white/30 hover:text-white/70 transition-colors" title="View listing">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
