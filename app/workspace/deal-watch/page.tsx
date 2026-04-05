"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Mail, MailX } from "lucide-react";

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

const VERDICTS = ["GREEN", "YELLOW", "RED"];

export default function DealWatchPage() {
  const [searches, setSearches] = useState<DealWatchSearch[]>([]);
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

  const loadSearches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deal-watch/searches");
      const data = await res.json();
      if (data.success) setSearches(data.searches);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSearches(); }, [loadSearches]);

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
          price_max: priceMax ? parseInt(priceMax) * 100 : null, // store as cents
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

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            Deal Watch
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Save search criteria and get email alerts when matching listings drop in price.
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">New saved search</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Alert name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='e.g. "Tesla Model 3 under $25k"'
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Make</label>
                <input
                  type="text"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Tesla"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Model 3"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Year from</label>
                <input
                  type="number"
                  value={yearMin}
                  onChange={(e) => setYearMin(e.target.value)}
                  placeholder="2019"
                  min="2000"
                  max="2030"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Year to</label>
                <input
                  type="number"
                  value={yearMax}
                  onChange={(e) => setYearMax(e.target.value)}
                  placeholder="2024"
                  min="2000"
                  max="2030"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Max price ($)</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="25000"
                  min="0"
                  step="500"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Alert on verdicts</label>
              <div className="flex gap-2">
                {VERDICTS.map((v) => {
                  const selected = verdictFilter.includes(v);
                  const color = v === "GREEN" ? (selected ? "bg-green-600 text-white border-green-600" : "border-green-300 text-green-700 hover:bg-green-50")
                    : v === "RED" ? (selected ? "bg-red-600 text-white border-red-600" : "border-red-300 text-red-700 hover:bg-red-50")
                    : (selected ? "bg-yellow-500 text-white border-yellow-500" : "border-yellow-300 text-yellow-700 hover:bg-yellow-50");
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
                <span className="text-xs text-gray-400 self-center ml-1">(leave empty = all)</span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Send email alerts on price drops</span>
            </label>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !label.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save alert
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); setError(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : searches.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 mb-1">No saved searches yet</p>
          <p className="text-xs text-gray-500 mb-4">
            Create an alert to get notified when a matching listing drops in price.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
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
              <div key={search.id} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{search.label}</p>
                    {search.email_alerts ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Alerts on</span>
                    ) : (
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">Alerts off</span>
                    )}
                  </div>
                  {criteria && (
                    <p className="text-xs text-gray-500 mb-1">{criteria}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {resultCount > 0 ? `${resultCount} tracked listing${resultCount !== 1 ? "s" : ""}` : "No listings tracked yet"}
                    {search.last_checked_at && ` · Last checked ${new Date(search.last_checked_at).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleAlerts(search)}
                    title={search.email_alerts ? "Disable email alerts" : "Enable email alerts"}
                    className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {search.email_alerts ? <Mail className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(search.id)}
                    title="Delete search"
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center">
        Deal Watch checks for price drops daily. Alerts are sent to your account email.
      </p>
    </div>
  );
}
