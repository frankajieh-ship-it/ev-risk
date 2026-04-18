"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, LogOut, User, Zap, Bell, Mail, AlertTriangle, CreditCard, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";

interface Profile {
  email: string | undefined;
  display_name: string | null;
  charging_access: string | null;
  weekly_miles: number | null;
  notifications_enabled: boolean;
}

interface EmailPrefs {
  deal_watch: boolean;
  weekly_digest: boolean;
  recall: boolean;
}

const CHARGING_OPTIONS = [
  { value: "home_l2",   label: "Home Level 2 charger" },
  { value: "shared_l2", label: "Shared / apartment L2" },
  { value: "workplace", label: "Workplace charging" },
  { value: "public_only", label: "Public chargers only" },
];

function SaveButton({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="flex items-center gap-1.5 px-4 py-2 bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
      {saved ? "Saved" : "Save changes"}
    </button>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-white/40 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors mt-0.5 ${
          checked ? "bg-[#00d97e]" : "bg-white/10"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`} />
      </button>
    </label>
  );
}

export default function SettingsPage() {
  const { session, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-section saving state
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Email preferences
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs | null>(null);
  const [emailPrefsSaving, setEmailPrefsSaving] = useState(false);

  // Billing
  const [billingLoading, setBillingLoading] = useState(false);

  const [purchases, setPurchases] = useState<Array<{
    purchase_id: string;
    created_at: string;
    status: string;
    scenario_type: string | null;
    amount: number | null;
    currency: string | null;
  }> | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.access_token) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    fetch("/api/workspace/profile", { headers })
      .then((r) => r.json())
      .then((data) => { if (data.success) setProfile(data.profile); })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));

    fetch("/api/user/purchases", { headers })
      .then((r) => r.json())
      .then((data) => { if (data.success) setPurchases(data.purchases); })
      .catch(() => {});

    fetch("/api/workspace/email-preferences", { headers })
      .then((r) => r.json())
      .then((data) => { if (data.success) setEmailPrefs(data.preferences); })
      .catch(() => {});
  }, [session?.access_token]);

  const patch = async (
    fields: Partial<Profile>,
    setSaving: (v: boolean) => void,
    setSaved: (v: boolean) => void
  ) => {
    if (!session?.access_token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.success) {
        setProfile(data.profile);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(data.error ?? "Failed to save");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  const patchEmailPref = async (key: keyof EmailPrefs, value: boolean) => {
    if (!session?.access_token || !emailPrefs) return;
    const updated = { ...emailPrefs, [key]: value };
    setEmailPrefs(updated);
    setEmailPrefsSaving(true);
    try {
      await fetch("/api/workspace/email-preferences", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch { /* non-critical */ } finally {
      setEmailPrefsSaving(false);
    }
  };

  const openBillingPortal = async () => {
    if (!session?.access_token) return;
    setBillingLoading(true);
    try {
      const res = await fetch("/api/user/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Could not open billing portal.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBillingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <p className="text-sm text-red-400">{error ?? "Could not load profile."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Header variant="homepage" />

      <main className="max-w-2xl mx-auto px-4 py-12 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-white/40 mt-1">Manage your account and EV preferences</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {/* Account */}
        <section className="bg-[#161b22] rounded-xl border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold text-white">Account</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              patch({ display_name: (fd.get("display_name") as string) || null }, setAccountSaving, setAccountSaved);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Email</label>
              <p className="text-sm text-white/40 bg-white/[0.04] rounded-lg px-3 py-2 border border-white/[0.08]">
                {profile.email}
              </p>
            </div>
            <div>
              <label htmlFor="display_name" className="block text-xs font-medium text-white/50 mb-1">
                Display name
              </label>
              <input
                id="display_name"
                name="display_name"
                type="text"
                defaultValue={profile.display_name ?? ""}
                placeholder="e.g. Marcus T."
                maxLength={60}
                className="w-full px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between">
              <SaveButton saving={accountSaving} saved={accountSaved} />
              <button
                type="button"
                onClick={() => logout()}
                className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </form>
        </section>

        {/* EV Preferences */}
        <section className="bg-[#161b22] rounded-xl border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold text-white">EV Preferences</h2>
          </div>
          <p className="text-xs text-white/40 mb-4">Improves routine fit accuracy across all your reports.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const miles = fd.get("weekly_miles");
              patch(
                {
                  charging_access: (fd.get("charging_access") as string) || null,
                  weekly_miles: miles ? parseInt(miles as string, 10) : null,
                },
                setPrefSaving,
                setPrefSaved
              );
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">Charging access</label>
              <div className="space-y-2">
                {CHARGING_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="charging_access"
                      value={opt.value}
                      defaultChecked={profile.charging_access === opt.value}
                      className="accent-[#00d97e]"
                    />
                    <span className="text-sm text-white/70">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="weekly_miles" className="block text-xs font-medium text-white/50 mb-1">
                Typical weekly miles
              </label>
              <input
                id="weekly_miles"
                name="weekly_miles"
                type="number"
                min={10}
                max={2000}
                defaultValue={profile.weekly_miles ?? ""}
                placeholder="e.g. 250"
                className="w-36 px-3 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder:text-white/20 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
              />
            </div>
            <SaveButton saving={prefSaving} saved={prefSaved} />
          </form>
        </section>

        {/* Notifications */}
        <section className="bg-[#161b22] rounded-xl border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold text-white">Notifications</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              patch(
                { notifications_enabled: fd.get("notifications_enabled") === "on" },
                setNotifSaving,
                setNotifSaved
              );
            }}
            className="space-y-4"
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="notifications_enabled"
                defaultChecked={profile.notifications_enabled}
                className="mt-0.5 accent-[#00d97e]"
              />
              <div>
                <p className="text-sm font-medium text-white">Price drop alerts</p>
                <p className="text-xs text-white/40">Email me when a saved vehicle drops in price or gets a new deal flag.</p>
              </div>
            </label>
            <SaveButton saving={notifSaving} saved={notifSaved} />
          </form>
        </section>

        {/* Email Preferences */}
        {emailPrefs && (
          <section className="bg-[#161b22] rounded-xl border border-white/[0.08] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-white/40" />
                <h2 className="font-semibold text-white">Email Preferences</h2>
              </div>
              {emailPrefsSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />}
            </div>
            <div className="space-y-4">
              <Toggle
                checked={emailPrefs.deal_watch}
                onChange={(v) => patchEmailPref("deal_watch", v)}
                label="Deal Watch alerts"
                description="Weekly digest of top-rated EV deals matching your preferences."
              />
              <Toggle
                checked={emailPrefs.weekly_digest}
                onChange={(v) => patchEmailPref("weekly_digest", v)}
                label="Weekly digest"
                description="A summary of new EV listings and market trends each week."
              />
              <Toggle
                checked={emailPrefs.recall}
                onChange={(v) => patchEmailPref("recall", v)}
                label="Recall alerts"
                description="Notify me when a vehicle in my garage has an open safety recall."
              />
            </div>
          </section>
        )}

        {/* Payment History */}
        {purchases !== null && (
          <section className="bg-[#161b22] rounded-xl border border-white/[0.08] p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-white/40" />
              <h2 className="font-semibold text-white">Payment History</h2>
            </div>
            <button
              onClick={openBillingPortal}
              disabled={billingLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/50 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] disabled:opacity-50 transition-colors mb-4"
            >
              {billingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Manage billing
            </button>
            {purchases.length === 0 ? (
              <p className="text-sm text-white/30">No purchases yet.</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {purchases.map((p) => (
                  <div key={p.purchase_id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {p.scenario_type === "evroutine"
                          ? "EV Routine Report"
                          : p.scenario_type === "receipt"
                          ? "Receipt Analysis"
                          : p.scenario_type ?? "Purchase"}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        {new Date(p.created_at).toLocaleDateString("en-US", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {p.amount != null && (
                        <span className="text-sm font-medium text-white/70">
                          {(p.currency ?? "usd").toUpperCase() === "USD" ? "$" : ""}
                          {(p.amount / 100).toFixed(2)}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "paid"     ? "bg-[#00d97e]/10 text-[#00d97e]"
                        : p.status === "refunded" ? "bg-white/[0.06] text-white/40"
                        : p.status === "failed"   ? "bg-red-500/10 text-red-400"
                        : "bg-yellow-500/10 text-yellow-400"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Data Export */}
        <section className="bg-[#161b22] rounded-xl border border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4 text-white/40" />
            <h2 className="font-semibold text-white">Your Data</h2>
          </div>
          <p className="text-xs text-white/40 mb-4">
            Download a copy of all your OFFO data — receipts, garage vehicles, routine runs, and purchases.
          </p>
          <a
            href="/api/user/export"
            download
            onClick={(e) => {
              if (!session?.access_token) { e.preventDefault(); return; }
              e.preventDefault();
              fetch("/api/user/export", {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
                .then(async (res) => {
                  if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    alert((d as { error?: string }).error ?? "Export failed. Please try again.");
                    return;
                  }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `offo-data-export-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(() => alert("Export failed. Please try again."));
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/50 text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download my data
          </a>
        </section>

        {/* Danger Zone */}
        <section className="bg-[#161b22] rounded-xl border border-red-500/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400/60" />
            <h2 className="font-semibold text-white">Danger Zone</h2>
          </div>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Delete my account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-white/50">
                This will permanently delete your account and all associated data — receipts, garage vehicles,
                saved analyses, and preferences. <strong className="text-white">This cannot be undone.</strong>
              </p>
              {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (!session?.access_token) return;
                    setDeleting(true);
                    setDeleteError(null);
                    try {
                      const res = await fetch("/api/user/account", {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      if (res.ok) {
                        await logout();
                        window.location.href = "/?deleted=1";
                      } else {
                        const data = await res.json().catch(() => ({}));
                        setDeleteError((data as { error?: string }).error ?? "Failed to delete account. Please try again.");
                      }
                    } catch {
                      setDeleteError("Network error — please try again.");
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {deleting ? "Deleting…" : "Yes, permanently delete my account"}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteError(null); }}
                  className="text-sm text-white/30 hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
