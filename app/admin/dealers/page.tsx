"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Clock, Loader2, RefreshCw } from "lucide-react";

interface Dealer {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
  website: string | null;
  inventory_size: string | null;
  ev_focus: string | null;
  referral_source: string | null;
  prospect_source: string | null;
  outreach_step: string | null;
  status: "pending" | "approved" | "rejected" | "prospect";
  is_verified: boolean;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_TABS = ["pending", "approved", "rejected", "prospect"] as const;
const TAB_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  prospect: "On File",
};

export default function AdminDealersPage() {
  const [apiKey, setApiKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "prospect">("pending");
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchDealers = useCallback(async (status: string, key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/dealers?status=${status}`, {
        headers: { "x-api-key": key },
      });
      const data = await res.json();
      if (data.success) setDealers(data.dealers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchDealers(tab, apiKey);
  }, [authed, tab, apiKey, fetchDealers]);

  const handleAction = async (dealerId: string, action: "approve" | "reject", reason?: string) => {
    setActionLoading(dealerId);
    try {
      const res = await fetch(`/api/admin/dealers/${dealerId}`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (data.success) {
        setDealers((prev) => prev.filter((d) => d.id !== dealerId));
        setRejectModal(null);
        setRejectReason("");
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-sm">
          <h1 className="text-lg font-bold text-gray-900 mb-4">Admin — Dealer Verification</h1>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && apiKey) setAuthed(true); }}
            placeholder="Admin API key"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setAuthed(true)}
            disabled={!apiKey}
            className="w-full py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Dealer Verification</h1>
          <button
            onClick={() => fetchDealers(tab, apiKey)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {TAB_LABELS[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : dealers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-sm text-gray-500">No {TAB_LABELS[tab].toLowerCase()} dealers</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dealers.map((dealer) => (
              <div key={dealer.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{dealer.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[dealer.city, dealer.state].filter(Boolean).join(", ") || "Location not provided"}
                      {dealer.contact_name && ` · ${dealer.contact_name}`}
                      {dealer.contact_email && ` · ${dealer.contact_email}`}
                      {dealer.phone && ` · ${dealer.phone}`}
                    </p>
                    {(dealer.website || dealer.inventory_size || dealer.ev_focus) && (
                      <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {dealer.website && (
                          <a href={dealer.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px]">
                            {dealer.website.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                        {dealer.inventory_size && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                            {dealer.inventory_size} EVs
                          </span>
                        )}
                        {dealer.ev_focus && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium capitalize">
                            {dealer.ev_focus.replace(/_/g, " ")}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tab === "prospect" ? "On file since" : "Signed up"} {new Date(dealer.created_at).toLocaleDateString()}
                      {dealer.reviewed_at && ` · Reviewed ${new Date(dealer.reviewed_at).toLocaleDateString()}`}
                      {dealer.prospect_source && ` · source: ${dealer.prospect_source}`}
                      {dealer.referral_source && ` · via ${dealer.referral_source}`}
                      {dealer.outreach_step && ` · outreach: ${dealer.outreach_step}`}
                    </p>
                    {dealer.rejection_reason && (
                      <p className="text-xs text-red-600 mt-1">Reason: {dealer.rejection_reason}</p>
                    )}
                  </div>

                  {tab === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(dealer.id, "approve")}
                        disabled={actionLoading === dealer.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === dealer.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectModal({ id: dealer.id, name: dealer.name })}
                        disabled={actionLoading === dealer.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  )}

                  {tab === "approved" && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full shrink-0">
                      <CheckCircle className="w-3 h-3" /> Approved
                    </span>
                  )}

                  {tab === "rejected" && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full shrink-0">
                      <XCircle className="w-3 h-3" /> Rejected
                    </span>
                  )}

                  {tab === "prospect" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        <Clock className="w-3 h-3" /> On File
                      </span>
                      {dealer.contact_email && (
                        <a
                          href={`mailto:${dealer.contact_email}?subject=Join%20OFFO%20Dealer%20Network&body=Hi%20${encodeURIComponent(dealer.contact_name || "there")}%2C%0A%0AWe%27d%20love%20to%20have%20${encodeURIComponent(dealer.name)}%20on%20OFFO.%20Apply%20here%3A%20https%3A%2F%2Foffolab.com%2Fdealers%2Fjoin%0A%0A%E2%80%94%20Frank%2C%20OFFO`}
                          className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
                        >
                          Invite to apply →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-bold text-gray-900 mb-1">Reject {rejectModal.name}?</h2>
            <p className="text-sm text-gray-500 mb-4">Optional: add a reason that will be included in the email to the dealer.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Unable to verify business registration"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(rejectModal.id, "reject", rejectReason || undefined)}
                disabled={actionLoading === rejectModal.id}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === rejectModal.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
