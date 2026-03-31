/**
 * Workspace Dashboard
 *
 * Overview page showing garage summary, recent inquiries, and quick actions.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Car, MessageSquare, Plus, ArrowRight, Loader2, Inbox, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface GarageVehicle {
  id: string;
  make: string;
  model: string;
  year: number | null;
  nickname: string | null;
  classification: { category?: string } | null;
  created_at: string;
}

interface Inquiry {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  dealerships: { name: string; slug: string } | null;
}

const DISMISS_KEY = "offo_profile_banner_dismissed";

export default function WorkspaceDashboard() {
  const { session } = useAuth();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileScore, setProfileScore] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(true); // start hidden, reveal after load

  useEffect(() => {
    try { setBannerDismissed(!!localStorage.getItem(DISMISS_KEY)); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;

    const headers = { Authorization: `Bearer ${session.access_token}` };

    Promise.all([
      fetch("/api/workspace/garage", { headers }).then((r) => r.json()),
      fetch("/api/workspace/inquiries", { headers }).then((r) => r.json()),
      fetch("/api/workspace/profile", { headers }).then((r) => r.json()),
    ])
      .then(([garageRes, inquiryRes, profileRes]) => {
        if (garageRes.success) setVehicles(garageRes.vehicles.slice(0, 5));
        if (inquiryRes.success) setInquiries(inquiryRes.inquiries.slice(0, 5));
        if (profileRes.success) {
          const p = profileRes.profile;
          const score = [p.display_name, p.charging_access, p.weekly_miles].filter(Boolean).length;
          setProfileScore(score);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const dismissBanner = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setBannerDismissed(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Workspace</h1>
        <p className="text-sm text-gray-500 mt-1">Your vehicles, inquiries, and saved results</p>
      </div>

      {/* Profile completion banner */}
      {!bannerDismissed && profileScore !== null && profileScore < 3 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 mb-1">Complete your profile for better deal alerts</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 max-w-[140px] h-1.5 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.round((profileScore / 3) * 100)}%` }} />
              </div>
              <span className="text-xs text-blue-600 font-medium">{Math.round((profileScore / 3) * 100)}% complete</span>
            </div>
          </div>
          <Link
            href="/workspace/settings"
            className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900 underline"
          >
            Go to Settings →
          </Link>
          <button onClick={dismissBanner} className="shrink-0 text-blue-400 hover:text-blue-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/workspace/garage"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Plus className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Add a Vehicle</p>
            <p className="text-sm text-gray-500">Add by VIN or make/model</p>
          </div>
        </Link>

        <Link
          href="/dealers"
          className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Find a Dealer</p>
            <p className="text-sm text-gray-500">Browse EV-friendly dealers</p>
          </div>
        </Link>
      </div>

      {/* Garage */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-800">Your Garage</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{vehicles.length}</span>
          </div>
          <Link href="/workspace/garage" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {vehicles.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Car className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No vehicles yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {vehicles.map((v) => (
              <Link
                key={v.id}
                href={`/workspace/garage`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                  {v.classification?.category === "EV" ? "EV" : v.classification?.category === "PHEV" ? "PH" : "IC"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {v.nickname || `${v.year || ""} ${v.make} ${v.model}`.trim()}
                  </p>
                  {v.nickname && (
                    <p className="text-xs text-gray-400 truncate">{v.year || ""} {v.make} {v.model}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Inquiries */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-800">Recent Inquiries</h2>
          </div>
          <Link href="/workspace/inquiries" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {inquiries.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No inquiries yet. Browse dealers to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {inquiries.map((inq) => (
              <div key={inq.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  inq.status === "open" ? "bg-blue-500" :
                  inq.status === "replied" ? "bg-green-500" :
                  "bg-gray-300"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{inq.subject}</p>
                  <p className="text-xs text-gray-400">
                    {inq.dealerships?.name || "Unknown dealer"} &middot; {inq.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
