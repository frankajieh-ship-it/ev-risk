/**
 * Buyer Inquiries Page
 *
 * Shows all inquiries the buyer has sent to dealers.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare, Loader2, Inbox, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Inquiry {
  id: string;
  subject: string;
  message: string;
  inquiry_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  dealerships: { name: string; slug: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  read: "bg-yellow-50 text-yellow-700",
  replied: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-500",
};

export default function InquiriesPage() {
  const { session } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (!session?.access_token) return;

    const url = filter === "all"
      ? "/api/workspace/inquiries"
      : `/api/workspace/inquiries?status=${filter}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setInquiries(data.inquiries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token, filter]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Inquiries</h1>
        <p className="text-sm text-gray-500">Messages you&apos;ve sent to dealers</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", "open", "replied", "closed"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              filter === s ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : inquiries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Inbox className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No inquiries yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Browse the{" "}
            <Link href="/dealers" className="text-blue-600 hover:underline">
              dealer directory
            </Link>{" "}
            to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {inquiries.map((inq) => (
            <div
              key={inq.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-gray-400 shrink-0" />
                    <p className="font-medium text-gray-900 truncate">{inq.subject}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_STYLES[inq.status] || ""}`}>
                      {inq.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate pl-6">{inq.message}</p>
                  <p className="text-xs text-gray-400 mt-1 pl-6">
                    {inq.dealerships?.name || "Unknown dealer"} &middot;{" "}
                    {new Date(inq.created_at).toLocaleDateString()}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
