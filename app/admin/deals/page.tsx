"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, ArrowUpDown, ExternalLink, Upload, Download, Link2 } from "lucide-react";
import Link from "next/link";

interface VinHistorySummary {
  salvage: boolean;
  theft: boolean;
  accident_count: number;
  sale_count: number;
}

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
  vin: string | null;
  title_status: "clean" | "salvage" | "rebuilt" | "unknown" | null;
  battery_report: "yes" | "no" | null;
  service_records: "yes" | "no" | null;
  vin_audit_summary: VinHistorySummary | null;
  extracted_signals: string[] | null;
  receipt_id: string | null;
  last_analyzed_at: string | null;
  is_active: boolean;
  sold_report_count: number | null;
  created_at: string | null;
  verdict: "GREEN" | "YELLOW" | "RED" | null;
  // v4 fields
  dcfc_kw_max: number | null;
  ac_charger_kw: number | null;
  charge_port_type: string | null;
  epa_range_mi: number | null;
  estimated_real_range_mi: number | null;
  seller_type: "private" | "dealer" | "cpo" | "auction" | null;
  days_on_market: number | null;
  exterior_color: string | null;
  heated_seats: boolean | null;
  heat_pump: boolean | null;
  tow_hitch: boolean | null;
  climate_zone: "hot" | "cold" | "temperate" | "humid" | null;
  warranty_remaining_months: number | null;
  supercharger_access: boolean | null;
  ota_capable: boolean | null;
  // v4b fields
  drivetrain: string | null;
  interior_color: string | null;
  doors: number | null;
  front_legroom_in: number | null;
  rear_legroom_in: number | null;
  cargo_volume_cuft: number | null;
  charge_time_notes: string | null;
  additional_notes: string | null;
  // v4c fields
  body_type: string | null;
  towing_capacity_lbs: number | null;
}

interface RescoredDiff {
  id: string;
  label: string;
  old_verdict: string | null;
  new_verdict: string;
  changed: boolean;
}

type SortKey = keyof DealRow;
type SortDir = "asc" | "desc";

function VerdictPill({ verdict }: { verdict: string | null | undefined }) {
  if (!verdict) return <span className="text-white/15">—</span>;
  const cls =
    verdict === "GREEN"
      ? "bg-[#00d97e]/15 text-[#00d97e]"
      : verdict === "RED"
      ? "bg-red-500/15 text-red-400"
      : "bg-yellow-400/15 text-yellow-400";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${cls}`}>
      {verdict}
    </span>
  );
}

export default function AdminDealsPage() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showFlagged, setShowFlagged] = useState(false);
  const [generatingReceipts, setGeneratingReceipts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adminKey, setAdminKey] = useState("");
  const authHeader = adminKey ? `Bearer ${adminKey}` : "";
  const [extracting, setExtracting] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [qaChecking, setQaChecking] = useState(false);
  const [qaDiffs, setQaDiffs] = useState<RescoredDiff[] | null>(null);
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [syncingDealers, setSyncingDealers] = useState(false);
  const [clearingGenericPhotos, setClearingGenericPhotos] = useState(false);
  const [clearingImageCache, setClearingImageCache] = useState(false);
  const [clearingBadPhotos, setClearingBadPhotos] = useState(false);
  const [nukingImageCache, setNukingImageCache] = useState(false);
  const extractPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const [rescopeDate, setRescopeDate] = useState(todayStr);
  const [rescopeOnly, setRescopeOnly] = useState(true);
  const [isLocal, setIsLocal] = useState<boolean | null>(null);

  useEffect(() => {
    setIsLocal(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  }, []);

  const fetchDeals = useCallback(async () => {
    // On production, require admin key before fetching
    const isProduction = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
    if (isProduction && !adminKey) {
      setLoading(false);
      return;
    }
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
    setExtracting(true);
    try {
      await fetch("/api/admin/deals-check-sold", { method: "POST", headers: { Authorization: authHeader } });
      extractPollRef.current = setInterval(fetchDeals, 15000);
      setTimeout(() => {
        if (extractPollRef.current) clearInterval(extractPollRef.current);
        setExtracting(false);
        setImportStatus("✓ Sold check complete — check table for deactivated rows");
        fetchDeals();
      }, 3 * 60 * 1000);
    } catch {
      setImportStatus("✗ Failed to start sold check");
      setExtracting(false);
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

  const handleClearGenericPhotos = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    if (!confirm("Clear all generic stock photos (proxied Wikimedia URLs) so real listing photos can be restored? This is a one-time cleanup.")) return;
    setClearingGenericPhotos(true);
    setImportStatus("Clearing generic stock photos...");
    try {
      const res = await fetch("/api/admin/deals-clear-generic-photos", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`✓ Cleared ${data.cleared} generic photos — run Backfill Photos to restore real images`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Clear failed");
    } finally {
      setClearingGenericPhotos(false);
    }
  };

  const handleClearImageCache = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    if (!confirm("Delete all marketplace CDN entries from the vehicle_images cache? This forces /deals to re-derive photos from local CSV / Wikimedia instead of stale CarGurus/CarMax URLs.")) return;
    setClearingImageCache(true);
    setImportStatus("Clearing stale image cache...");
    try {
      const res = await fetch("/api/admin/deals-clear-image-cache", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`✓ Cleared ${data.cleared} stale image cache entries — reload /deals to see corrected photos`);
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Cache clear failed");
    } finally {
      setClearingImageCache(false);
    }
  };

  const handleNukeImageCache = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    if (!confirm("NUKE the entire vehicle_images cache? This deletes ALL cached photo entries and forces /api/photos to re-derive from the static Wikimedia map. Use after wrong-car photo poisoning.")) return;
    setNukingImageCache(true);
    setImportStatus("Nuking entire vehicle_images cache...");
    try {
      const res = await fetch("/api/admin/deals-clear-image-cache?nuke=1", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`✓ Nuked ${data.cleared} image cache entries — photos will now use static Wikimedia map`);
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Nuke failed");
    } finally {
      setNukingImageCache(false);
    }
  };

  const handleClearBadPhotos = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    setClearingBadPhotos(true);
    setImportStatus("Clearing known-bad photo URLs...");
    try {
      const res = await fetch("/api/admin/deals-clear-bad-photos", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`✓ Cleared ${data.cleared} bad photos (${data.details?.join(", ") ?? ""}) — run Fill Missing (CSV) to refill`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Clear bad photos failed");
    } finally {
      setClearingBadPhotos(false);
    }
  };

  const handleSyncLocalPhotos = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    setSyncingPhotos(true);
    setImportStatus("Syncing local CSV photos...");
    try {
      const res = await fetch("/api/admin/deals-sync-local-photos", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`✓ Synced photos: ${data.updated} updated, ${data.skipped} skipped (${data.total} total)`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Sync failed");
    } finally {
      setSyncingPhotos(false);
    }
  };

  const handleSyncDealerInventory = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    setSyncingDealers(true);
    setImportStatus("Syncing dealer inventory to deals page...");
    try {
      const res = await fetch("/api/admin/sync-dealer-inventory", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (data.success) {
        setImportStatus(`✓ Dealer sync: ${data.upserted} listings synced, ${data.skipped} skipped (${data.dealerships} dealers)`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Dealer sync failed");
    } finally {
      setSyncingDealers(false);
    }
  };

  const handleExtract = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    const since = rescopeOnly && rescopeDate ? rescopeDate : undefined;
    const scopeLabel = since ? `from ${since}` : "all active listings";
    if (!confirm(`Extract info (VIN, title, mileage, etc.) for ${scopeLabel}?\n\nThis scrapes each listing URL (~30s per listing). Sold listings will be auto-deactivated.`)) return;
    setExtracting(true);
    setImportStatus(`⏳ Extracting${since ? ` ${since}` : ""} listings — table refreshes every 15s...`);
    try {
      const res = await fetch("/api/admin/deals-extract", {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ since }),
      });
      const data = await res.json();
      if (!data.ok) {
        setImportStatus(`✗ ${data.error}`);
        setExtracting(false);
        return;
      }
      // Poll every 15s — extraction runs async server-side
      extractPollRef.current = setInterval(fetchDeals, 15000);
      setTimeout(() => {
        if (extractPollRef.current) clearInterval(extractPollRef.current);
        setExtracting(false);
        setImportStatus("✓ Extraction finished — VIN, title, mileage columns updated.");
        fetchDeals();
      }, 10 * 60 * 1000);
    } catch {
      setImportStatus("✗ Failed to start extraction");
      setExtracting(false);
    }
  };

  const handleGenerateReceipts = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    const noReceipt = deals.filter((d) => d.is_active && !d.receipt_id).length;
    if (noReceipt === 0) { alert("All active deals already have receipts"); return; }
    if (!confirm(`Generate receipts for ${noReceipt} active deals without one? This uses AI credits.`)) return;
    setGeneratingReceipts(true);
    setImportStatus("⏳ Generating receipts...");
    try {
      const res = await fetch(`/api/admin/deals-generate-receipts?batch=50`, {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (res.ok) {
        setImportStatus(`✓ Generated ${data.generated} receipts (${data.failed} failed, ${data.skipped} skipped)`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Receipt generation failed");
    } finally {
      setGeneratingReceipts(false);
    }
  };

  const handleQaCheck = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    setQaChecking(true);
    setImportStatus("⏳ Running QA check — comparing stored vs re-scored verdicts...");
    try {
      const res = await fetch("/api/admin/deals-rescore?qa=true&batch=100", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (res.ok) {
        setQaDiffs(data.diffs ?? []);
        const changed = (data.diffs ?? []).filter((d: RescoredDiff) => d.changed).length;
        setImportStatus(`✓ QA complete — ${changed} of ${data.total} verdicts would change`);
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ QA check failed");
    } finally {
      setQaChecking(false);
    }
  };

  const handleRescore = async () => {
    if (!adminKey) { alert("Enter your admin API key first"); return; }
    const active = deals.filter((d) => d.is_active).length;
    if (!confirm(`Re-score all ${active} active deals using the deterministic pipeline? This is fast (no AI) and will overwrite stored verdicts.`)) return;
    setRescoring(true);
    setImportStatus("⏳ Re-scoring active deals...");
    try {
      const res = await fetch("/api/admin/deals-rescore?batch=100", {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      const data = await res.json();
      if (res.ok) {
        setImportStatus(`✓ Re-scored ${data.rescored} deals — ${data.changed} verdicts changed, ${data.unchanged} unchanged, ${data.failed} failed`);
        fetchDeals();
      } else {
        setImportStatus(`✗ ${data.error}`);
      }
    } catch {
      setImportStatus("✗ Re-score failed");
    } finally {
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
        const dealersNote = data.dealers_upserted > 0 ? `, ${data.dealers_upserted} dealer prospects upserted` : "";
        const rescoreNote = data.rescore_started ? " — AI rescore started (refresh in ~1 min per listing)" : "";
        setImportStatus(`✓ Imported ${data.imported} deals (${data.skipped} skipped${deactivatedNote}${dealersNote})${rescoreNote}`);
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

  useEffect(() => { fetchDeals(); }, [fetchDeals, adminKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const flaggedCount = deals.filter((d) => (d.sold_report_count ?? 0) > 0).length;

  const filtered = deals.filter((d) => {
    if (showFlagged && (d.sold_report_count ?? 0) === 0) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      d.vehicle_label?.toLowerCase().includes(q) ||
      d.make?.toLowerCase().includes(q) ||
      d.model?.toLowerCase().includes(q)
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
        {/* Environment indicator */}
        {isLocal !== null && (
          <div className={`mb-5 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
            isLocal
              ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              : "bg-green-500/10 text-green-400 border border-green-500/20"
          }`}>
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${isLocal ? "bg-yellow-400" : "bg-green-400"}`} />
            {isLocal
              ? "Local — changes here do NOT appear on offolab.com. Open offolab.com/admin/deals to update the live site."
              : "Production — changes are live on offolab.com"}
          </div>
        )}

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
              placeholder="Filter by make, model..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-[#161b22] border border-white/[0.08] text-white/70 text-xs rounded-lg px-3 py-2 w-56 focus:outline-none focus:border-[#00d97e]/40"
            />
            <button
              onClick={() => setShowFlagged((v) => !v)}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${showFlagged ? "text-red-400 border-red-400/30 bg-red-400/10" : "text-white/40 hover:text-red-400 border-white/[0.08]"}`}
            >
              🚩 Flagged{flaggedCount > 0 ? ` (${flaggedCount})` : ""}
            </button>
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
              onClick={handleExtract}
              disabled={extracting}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${extracting ? "text-blue-400 border-blue-400/20 cursor-not-allowed" : "text-white/40 hover:text-blue-400 border-white/[0.08]"}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${extracting ? "animate-spin" : ""}`} />
              {extracting ? "Extracting..." : rescopeOnly && rescopeDate ? `Extract ${rescopeDate.slice(5)}` : "Extract All"}
            </button>
            <button onClick={handleActivateAll}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-emerald-400 border border-white/[0.08] rounded-lg px-3 py-2 transition-colors">
              Activate All
            </button>
            <button onClick={handleCheckSold} disabled={extracting}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${extracting ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-red-400 border-white/[0.08]"}`}>
              Check Sold
            </button>
            <button onClick={handleClearGenericPhotos} disabled={clearingGenericPhotos}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${clearingGenericPhotos ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-orange-400 border-white/[0.08]"}`}>
              {clearingGenericPhotos ? "Clearing..." : "Clear Generic Photos"}
            </button>
            <button onClick={handleClearImageCache} disabled={clearingImageCache}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${clearingImageCache ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-red-400 border-white/[0.08]"}`}>
              {clearingImageCache ? "Clearing..." : "Clear Image Cache"}
            </button>
            <button onClick={handleClearBadPhotos} disabled={clearingBadPhotos}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${clearingBadPhotos ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-yellow-400 border-white/[0.08]"}`}>
              {clearingBadPhotos ? "Clearing..." : "Clear Bad Photos"}
            </button>
            <button onClick={handleNukeImageCache} disabled={nukingImageCache}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${nukingImageCache ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-red-500/70 hover:text-red-400 border-red-500/30 hover:border-red-400/50"}`}>
              {nukingImageCache ? "Nuking..." : "Nuke Image Cache"}
            </button>
            <button onClick={handleSyncLocalPhotos} disabled={syncingPhotos}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${syncingPhotos ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-[#00d97e] border-white/[0.08]"}`}>
              {syncingPhotos ? "Syncing..." : "Fill Missing (CSV)"}
            </button>
            <button onClick={handleSyncDealerInventory} disabled={syncingDealers}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${syncingDealers ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-[#00d97e] border-white/[0.08]"}`}>
              {syncingDealers ? "Syncing..." : "Sync Dealers"}
            </button>
            <button onClick={handleBackfillPhotos}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-[#00d97e] border border-white/[0.08] rounded-lg px-3 py-2 transition-colors">
              Backfill Photos
            </button>
            <button onClick={handleGenerateReceipts} disabled={generatingReceipts}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${generatingReceipts ? "text-white/20 border-white/[0.04] cursor-not-allowed" : "text-white/40 hover:text-purple-400 border-white/[0.08]"}`}>
              {generatingReceipts ? "Generating..." : "Generate Receipts"}
            </button>
            <button onClick={handleQaCheck} disabled={qaChecking || rescoring}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${qaChecking ? "text-yellow-400 border-yellow-400/20 cursor-not-allowed" : "text-white/40 hover:text-yellow-400 border-white/[0.08]"}`}>
              {qaChecking ? "QA..." : "QA Check"}
            </button>
            <button onClick={handleRescore} disabled={rescoring || qaChecking}
              className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-2 transition-colors ${rescoring ? "text-[#00d97e] border-[#00d97e]/20 cursor-not-allowed" : "text-white/40 hover:text-[#00d97e] border-white/[0.08]"}`}>
              {rescoring ? "Re-scoring..." : "Re-score All"}
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

        {!adminKey && isLocal === false && (
          <div className="mb-4 px-4 py-3 bg-[#161b22] border border-white/[0.08] rounded-lg text-white/50 text-sm">
            Enter your admin API key above to load deals.
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* QA Diff Modal */}
        {qaDiffs && (
          <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-500/10">
              <span className="text-xs font-semibold text-yellow-400">
                QA Diff — {qaDiffs.filter((d) => d.changed).length} of {qaDiffs.length} would change verdict
              </span>
              <button onClick={() => setQaDiffs(null)} className="text-white/30 hover:text-white/60 text-xs">✕ Close</button>
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 border-b border-white/[0.06]">
                    <th className="text-left px-4 py-2">Vehicle</th>
                    <th className="text-center px-3 py-2">Old</th>
                    <th className="text-center px-3 py-2">New</th>
                    <th className="text-center px-3 py-2">Changed</th>
                  </tr>
                </thead>
                <tbody>
                  {qaDiffs.filter((d) => d.changed).map((d) => (
                    <tr key={d.id} className="border-b border-white/[0.04]">
                      <td className="px-4 py-2 text-white/70 truncate max-w-[300px]">{d.label}</td>
                      <td className="px-3 py-2 text-center">
                        <VerdictPill verdict={d.old_verdict} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <VerdictPill verdict={d.new_verdict} />
                      </td>
                      <td className="px-3 py-2 text-center text-yellow-400 font-semibold">→</td>
                    </tr>
                  ))}
                  {qaDiffs.filter((d) => d.changed).length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-white/30">No verdicts would change</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                <th className="text-center px-3 py-3">VIN</th>
                <th className="text-center px-3 py-3"><SortBtn k="title_status" label="Title" /></th>
                <th className="text-center px-3 py-3">Bat. Report</th>
                <th className="text-center px-3 py-3">Svc Records</th>
                <th className="text-center px-3 py-3"><SortBtn k="epa_range_mi" label="Range" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="dcfc_kw_max" label="DCFC" /></th>
                <th className="text-center px-3 py-3">Port</th>
                <th className="text-center px-3 py-3"><SortBtn k="seller_type" label="Seller" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="days_on_market" label="DOM" /></th>
                <th className="text-center px-3 py-3">Options</th>
                <th className="text-center px-3 py-3"><SortBtn k="climate_zone" label="Climate" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="warranty_remaining_months" label="Warr." /></th>
                <th className="text-center px-3 py-3"><SortBtn k="drivetrain" label="Drive" /></th>
                <th className="text-center px-3 py-3">Body</th>
                <th className="text-center px-3 py-3">Colors</th>
                <th className="text-center px-3 py-3"><SortBtn k="cargo_volume_cuft" label="Cargo" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="towing_capacity_lbs" label="Tow" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="verdict" label="Verdict" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="is_active" label="Active" /></th>
                <th className="text-center px-3 py-3"><SortBtn k="sold_report_count" label="Reports" /></th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {Array.from({ length: 23 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-white/[0.04] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={23} className="text-center py-12 text-white/30">No deals found</td>
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
                    <td className="px-3 py-3 text-center font-mono text-[10px]">
                      {d.vin ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-emerald-400" title={d.vin}>✓</span>
                          {d.vin_audit_summary?.accident_count != null && d.vin_audit_summary.accident_count > 0 && (
                            <span className="text-red-400 font-sans" title={`${d.vin_audit_summary.accident_count} accident(s) reported`}>
                              ⚠{d.vin_audit_summary.accident_count}
                            </span>
                          )}
                          {d.extracted_signals && d.extracted_signals.length > 0 && (
                            <span className="text-white/30 font-sans" title={d.extracted_signals.join(", ")}>
                              {d.extracted_signals.length}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.title_status === "clean"
                        ? <span className="text-emerald-400">clean</span>
                        : d.title_status === "salvage" || d.title_status === "rebuilt"
                        ? <span className="text-red-400">{d.title_status}</span>
                        : <span className="text-white/20">{d.title_status ?? "—"}</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.battery_report === "yes"
                        ? <span className="text-emerald-400">yes</span>
                        : d.battery_report === "no"
                        ? <span className="text-red-400">no</span>
                        : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.service_records === "yes"
                        ? <span className="text-emerald-400">yes</span>
                        : d.service_records === "no"
                        ? <span className="text-red-400">no</span>
                        : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4 — range */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.epa_range_mi ? (
                        <span className="text-white/60">{d.epa_range_mi}<span className="text-white/25">mi</span></span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4 — charging */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.dcfc_kw_max ? (
                        <span className="text-[#00d97e]">{d.dcfc_kw_max}<span className="text-white/25">kW</span></span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.charge_port_type ? (
                        <span className={`font-medium ${d.charge_port_type === "NACS" ? "text-[#00d97e]" : d.charge_port_type === "CHAdeMO" ? "text-orange-400" : "text-white/50"}`}>
                          {d.charge_port_type}
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4 — seller */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.seller_type ? (
                        <span className={`${d.seller_type === "cpo" ? "text-[#00d97e]" : d.seller_type === "private" ? "text-blue-400" : "text-white/40"}`}>
                          {d.seller_type}
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4 — days on market */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.days_on_market != null ? (
                        <span className={d.days_on_market > 30 ? "text-orange-400" : d.days_on_market > 14 ? "text-yellow-400" : "text-white/50"}>
                          {d.days_on_market}d
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4 — options summary */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      <span className="flex items-center justify-center gap-1">
                        {d.heated_seats && <span title="Heated seats">🪑</span>}
                        {d.heat_pump && <span title="Heat pump">♨</span>}
                        {d.tow_hitch && <span title="Tow hitch">🔗</span>}
                        {!d.heated_seats && !d.heat_pump && !d.tow_hitch && <span className="text-white/20">—</span>}
                      </span>
                    </td>
                    {/* v4 — climate zone */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.climate_zone ? (
                        <span className={`${d.climate_zone === "cold" ? "text-blue-400" : d.climate_zone === "hot" ? "text-orange-400" : "text-white/40"}`}>
                          {d.climate_zone}
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4 — warranty */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.warranty_remaining_months != null ? (
                        <span className={d.warranty_remaining_months === 0 ? "text-red-400" : d.warranty_remaining_months < 12 ? "text-orange-400" : "text-emerald-400"}>
                          {d.warranty_remaining_months === 0 ? "exp" : `${d.warranty_remaining_months}mo`}
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4b — drivetrain */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.drivetrain ? (
                        <span className={`font-medium ${d.drivetrain === "AWD" || d.drivetrain === "EAWD" ? "text-[#00d97e]" : "text-white/50"}`}>
                          {d.drivetrain}
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4c — body type */}
                    <td className="px-3 py-3 text-center text-[10px] text-white/40 whitespace-nowrap">
                      {d.body_type ?? <span className="text-white/20">—</span>}
                    </td>
                    {/* v4b — colors */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {(d.exterior_color || d.interior_color) ? (
                        <span className="text-white/40" title={[d.exterior_color, d.interior_color].filter(Boolean).join(" / ")}>
                          {d.exterior_color?.split(" ").pop() ?? "—"}
                          {d.interior_color ? <span className="text-white/25">/{d.interior_color.split(" ").pop()}</span> : null}
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4b — cargo */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.cargo_volume_cuft != null ? (
                        <span className="text-white/50">{d.cargo_volume_cuft}<span className="text-white/25">ft³</span></span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    {/* v4c — towing */}
                    <td className="px-3 py-3 text-center text-[10px]">
                      {d.towing_capacity_lbs != null ? (
                        <span className="text-white/50">{d.towing_capacity_lbs.toLocaleString()}<span className="text-white/25">lb</span></span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <VerdictPill verdict={d.verdict} />
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
                    <td className="px-3 py-3 text-center">
                      {(d.sold_report_count ?? 0) > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-semibold">
                          {d.sold_report_count}
                        </span>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
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
