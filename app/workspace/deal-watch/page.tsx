"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, Loader2, Mail, MailX } from "lucide-react";

interface DealWatchSearch {
  id: string;
  label: string;
  make: string | null;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  price_max: number | null;
  verdict_filter: string[] | null;
  email_alerts: boolean;
  last_checked_at: string | null;
  created_at: string;
  deal_watch_results: { count: number }[];
}

interface GarageVehicleMini {
  id: string;
  make: string;
  model: string;
  year: number | null;
  verdict: string | null;
  listed_price: number | null;
}

const VERDICTS = ["GREEN", "YELLOW", "RED"];

const VERDICT_DOT: Record<string, string> = {
  GREEN: "bg-[#00d97e]",
  YELLOW: "bg-yellow-400",
  RED: "bg-red-400",
};

export default function DealWatchPage() {
  const [searches, setSearches] = useState<DealWatchSearch[]>([]);
  const [garageVehicles, setGarageVehicles] = useState<GarageVehicleMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // New search form state
  const [label, setLabel] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<string[]>([]);
  const [emailAlerts, setEmailAlerts] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [searchesRes, garageRes] = await Promise.all([
        fetch("/api/deal-watch/searches"),
        fetch("/api/workspace/garage"),
      ]);
      const [searchesData, garageData] = await Promise.all([
        searchesRes.json(),
        garageRes.json(),
      ]);
      if (searchesData.success) setSearches(searchesData.searches);
      if (garageData.success) {
        setGarageVehicles(
          (garageData.vehicles ?? []).map((v: GarageVehicleMini & { [key: string]: unknown }) => ({
            id: v.id,
            make: v.make,
            model: v.model,
            year: v.year,
            verdict: v.verdict ?? null,
            listed_price: v.listed_price ?? null,
          }))
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/deal-watch/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          make: make.trim() || null,
          model: model.trim() || null,
          year_min: yearMin ? parseInt(yearMin) : null,
          year_max: yearMax ? parseInt(yearMax) : null,
          price_max: priceMax ? parseInt(priceMax) * 100 : null,
          verdict_filter: verdictFilter.length > 0 ? verdictFilter : null,
          email_alerts: emailAlerts,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSearches((prev) => [data.search, ...prev]);
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create search");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved search and all its tracked results?")) return;
    await fetch(`/api/deal-watch/searches/${id}`, { method: "DELETE" });
    setSearches((prev) => prev.filter((s) => s.id !== id));
  };

  const handleToggleAlerts = async (search: DealWatchSearch) => {
    const updated = !search.email_alerts;
    await fetch(`/api/deal-watch/searches/${search.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email_alerts: updated }),
    });
    setSearches((prev) => prev.map((s) => s.id === search.id ? { ...s, email_alerts: updated } : s));
  };

  const resetForm = () => {
    setLabel(""); setMake(""); setModel(""); setYearMin(""); setYearMax(""); setPriceMax(""); setVerdictFilter([]); setEmailAlerts(true);
  };

  const toggleVerdict = (v: string) => {
    setVerdictFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  const prefillFromVehicle = (v: GarageVehicleMini) => {
    setLabel(`${[v.year, v.make, v.model].filter(Boolean).join(" ")}`);
    setMake(v.make ?? "");
    setModel(v.model ?? "");
    if (v.year) { setYearMin(String(v.year)); setYearMax(String(v.year)); }
    setShowForm(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#00d97e]">Deal Watch</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Deal Watch</h1>
          <p className="text-sm text-white/40 mt-1">
            Save search criteria and get email alerts when matching listings drop in price.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00c970] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {/* Garage vehicles — priority section */}
      {!loading && garageVehicles.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
            Your Saved Vehicles
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {garageVehicles.map((v) => {
              const vehicleLabel = [v.year, v.make, v.model].filter(Boolean).join(" ");
              const dotClass = v.verdict ? (VERDICT_DOT[v.verdict] ?? "bg-white/20") : "bg-white/20";
              return (
                <div
                  key={v.id}
                  className="bg-[#161b22] border border-white/[0.08] rounded-xl px-3 py-2.5 shrink-0 w-44 flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${dotClass}`} />
                    <p className="text-sm text-white/80 font-medium truncate leading-snug">{vehicleLabel}</p>
                  </div>
                  {v.listed_price && (
                    <p className="text-xs text-white/40">${(v.listed_price / 100).toLocaleString()}</p>
                  )}
                  <button
                    onClick={() => prefillFromVehicle(v)}
                    className="text-xs text-[#00d97e] font-semibold hover:text-[#00c970] transition-colors text-left"
                  >
                    + Watch
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">New saved search</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                Alert name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='e.g. "Tesla Model 3 under $25k"'
                required
                className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white placeholder-white/30 border border-white/[0.08] rounded-lg focus:border-[#00d97e]/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Make</label>
                <input
                  type="text"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Tesla"
                  className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white placeholder-white/30 border border-white/[0.08] rounded-lg focus:border-[#00d97e]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model 3"
                  className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white placeholder-white/30 border border-white/[0.08] rounded-lg focus:border-[#00d97e]/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Year from</label>
                <input
                  type="number"
                  value={yearMin}
                  onChange={(e) => setYearMin(e.target.value)}
                  placeholder="2019"
                  min="2000"
                  max="2030"
                  className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white placeholder-white/30 border border-white/[0.08] rounded-lg focus:border-[#00d97e]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Year to</label>
                <input
                  type="number"
                  value={yearMax}
                  onChange={(e) => setYearMax(e.target.value)}
                  placeholder="2024"
                  min="2000"
                  max="2030"
                  className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white placeholder-white/30 border border-white/[0.08] rounded-lg focus:border-[#00d97e]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Max price ($)</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="25000"
                  min="0"
                  step="500"
                  className="w-full px-3 py-2 text-sm bg-white/[0.04] text-white placeholder-white/30 border border-white/[0.08] rounded-lg focus:border-[#00d97e]/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-2">Alert on verdicts</label>
              <div className="flex gap-2 items-center">
                {VERDICTS.map((v) => {
                  const selected = verdictFilter.includes(v);
                  const color = v === "GREEN"
                    ? (selected ? "bg-[#00d97e] text-[#0d1117] border-[#00d97e]" : "border-[#00d97e]/30 text-[#00d97e]/70 hover:bg-[#00d97e]/10")
                    : v === "RED"
                    ? (selected ? "bg-red-500 text-white border-red-500" : "border-red-500/30 text-red-400/70 hover:bg-red-500/10")
                    : (selected ? "bg-yellow-400 text-[#0d1117] border-yellow-400" : "border-yellow-400/30 text-yellow-400/70 hover:bg-yellow-400/10");
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => toggleVerdict(v)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${color}`}
                    >
                      {v}
                    </button>
                  );
                })}
                <span className="text-xs text-white/30 ml-1">(leave empty = all)</span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="rounded border-white/20 bg-white/[0.04] text-[#00d97e] focus:ring-[#00d97e]/50"
              />
              <span className="text-sm text-white/70">Send email alerts on price drops</span>
            </label>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !label.trim()}
                className="px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00c970] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save alert
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); setError(""); }}
                className="px-4 py-2 text-sm text-white/50 hover:text-white/80 border border-white/[0.08] rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Searches list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
        </div>
      ) : searches.length === 0 ? (
        <div className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-10 text-center">
          <Bell className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white/70 mb-1">No saved searches yet</p>
          <p className="text-xs text-white/40 mb-4">
            Create an alert to get notified when a matching listing drops in price.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00c970] transition-colors"
          >
            Create your first alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((search) => {
            const resultCount = search.deal_watch_results?.[0]?.count ?? 0;
            const criteria = [
              search.make && search.model ? `${search.make} ${search.model}` : search.make || search.model,
              search.year_min && search.year_max ? `${search.year_min}–${search.year_max}` : search.year_min ? `from ${search.year_min}` : search.year_max ? `to ${search.year_max}` : null,
              search.price_max ? `under $${(search.price_max / 100).toLocaleString()}` : null,
              search.verdict_filter?.length ? search.verdict_filter.join(", ") : null,
            ].filter(Boolean).join(" · ");

            return (
              <div key={search.id} className="bg-[#161b22] border border-white/[0.08] rounded-2xl p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white truncate">{search.label}</p>
                    {search.email_alerts ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#00d97e] bg-[#00d97e]/10 px-1.5 py-0.5 rounded-full">Alerts on</span>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded-full">Alerts off</span>
                    )}
                  </div>
                  {criteria && (
                    <p className="text-xs text-white/50 mb-1">{criteria}</p>
                  )}
                  <p className="text-xs text-white/40">
                    {resultCount > 0 ? `${resultCount} tracked listing${resultCount !== 1 ? "s" : ""}` : "No listings tracked yet"}
                    {search.last_checked_at && ` · Last checked ${new Date(search.last_checked_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleAlerts(search)}
                    title={search.email_alerts ? "Disable email alerts" : "Enable email alerts"}
                    className="p-2 text-white/40 hover:text-white/70 rounded-lg hover:bg-white/[0.05] transition-colors"
                  >
                    {search.email_alerts ? <Mail className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(search.id)}
                    title="Delete search"
                    className="p-2 text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/[0.08] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-white/30 mt-6 text-center">
        Deal Watch checks for price drops daily. Alerts are sent to your account email.
      </p>
    </div>
  );
}
