"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, LogOut, User, Zap, Bell, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Profile {
  email: string | undefined;
  display_name: string | null;
  charging_access: string | null;
  weekly_miles: number | null;
  notifications_enabled: boolean;
}

const CHARGING_OPTIONS = [
  { value: "home_l2", label: "Home Level 2 charger" },
  { value: "shared_l2", label: "Shared / apartment L2" },
  { value: "workplace", label: "Workplace charging" },
  { value: "public_only", label: "Public chargers only" },
];

function SaveButton({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
      {saved ? "Saved" : "Save changes"}
    </button>
  );
}

export default function SettingsPage() {
  const { session, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-section saving state
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/workspace/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProfile(data.profile);
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const patch = async (fields: Partial<Profile>, setSaving: (v: boolean) => void, setSaved: (v: boolean) => void) => {
    if (!session?.access_token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/profile", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-red-600">{error ?? "Could not load profile."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and EV preferences</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Account */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">Account</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            patch({ display_name: fd.get("display_name") as string || null }, setAccountSaving, setAccountSaved);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
              {profile.email}
            </p>
          </div>
          <div>
            <label htmlFor="display_name" className="block text-xs font-medium text-gray-600 mb-1">
              Display name
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              defaultValue={profile.display_name ?? ""}
              placeholder="e.g. Marcus T."
              maxLength={60}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <SaveButton saving={accountSaving} saved={accountSaved} />
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </form>
      </section>

      {/* EV Preferences */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">EV Preferences</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">Improves routine fit accuracy across all your reports.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const miles = fd.get("weekly_miles");
            patch(
              {
                charging_access: fd.get("charging_access") as string || null,
                weekly_miles: miles ? parseInt(miles as string, 10) : null,
              },
              setPrefSaving,
              setPrefSaved
            );
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Charging access</label>
            <div className="space-y-2">
              {CHARGING_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="charging_access"
                    value={opt.value}
                    defaultChecked={profile.charging_access === opt.value}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="weekly_miles" className="block text-xs font-medium text-gray-600 mb-1">
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
              className="w-36 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <SaveButton saving={prefSaving} saved={prefSaved} />
        </form>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-gray-400" />
          <h2 className="font-semibold text-gray-800">Notifications</h2>
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
              className="mt-0.5 accent-blue-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Price drop alerts</p>
              <p className="text-xs text-gray-500">Email me when a saved vehicle drops in price or gets a new deal flag.</p>
            </div>
          </label>
          <SaveButton saving={notifSaving} saved={notifSaved} />
        </form>
      </section>

      {/* Danger Zone */}
      <section className="bg-white rounded-xl border border-red-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h2 className="font-semibold text-gray-800">Danger Zone</h2>
        </div>
        {!deleteConfirm ? (
          <button
            onClick={() => setDeleteConfirm(true)}
            className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
          >
            Delete my account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              To delete your account, email us at{" "}
              <a href="mailto:hello@offo.app?subject=Account deletion request" className="text-blue-600 underline">
                hello@offo.app
              </a>{" "}
              with the subject "Account deletion request". We&apos;ll process it within 48 hours.
            </p>
            <button
              onClick={() => setDeleteConfirm(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
