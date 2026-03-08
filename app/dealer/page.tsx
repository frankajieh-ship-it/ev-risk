/**
 * Dealer Dashboard
 *
 * Summary view: inventory count, inquiry count, recent inquiries.
 */

"use client";

import { useEffect, useState } from "react";
import { Package, MessageSquare, Eye, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DashboardData {
  inventoryCount: number;
  activeCount: number;
  inquiryCount: number;
  openInquiries: number;
  recentInquiries: {
    id: string;
    subject: string;
    status: string;
    inquiry_type: string;
    created_at: string;
    buyer_email?: string;
  }[];
}

export default function DealerDashboard() {
  const { session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;

    const load = async () => {
      try {
        const [invRes, inqRes] = await Promise.all([
          fetch("/api/dealer/inventory", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch("/api/dealer/inquiries", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        const invData = invRes.ok ? await invRes.json() : { items: [] };
        const inqData = inqRes.ok ? await inqRes.json() : { inquiries: [] };

        const items = invData.items || [];
        const inquiries = inqData.inquiries || [];

        setData({
          inventoryCount: items.length,
          activeCount: items.filter((i: { status: string }) => i.status === "active").length,
          inquiryCount: inquiries.length,
          openInquiries: inquiries.filter((i: { status: string }) => i.status === "open" || i.status === "read").length,
          recentInquiries: inquiries.slice(0, 5),
        });
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session?.access_token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const stats = [
    { label: "Total Vehicles", value: data?.inventoryCount ?? 0, icon: Package, color: "blue" },
    { label: "Active Listings", value: data?.activeCount ?? 0, icon: Eye, color: "green" },
    { label: "Total Inquiries", value: data?.inquiryCount ?? 0, icon: MessageSquare, color: "purple" },
    { label: "Open Inquiries", value: data?.openInquiries ?? 0, icon: TrendingUp, color: "orange" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Dealer Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[stat.color]}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent inquiries */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Inquiries</h2>
        </div>
        {data?.recentInquiries && data.recentInquiries.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {data.recentInquiries.map((inq) => (
              <li key={inq.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inq.subject}</p>
                  <p className="text-xs text-gray-500">
                    {inq.inquiry_type} &middot; {new Date(inq.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  inq.status === "open" ? "bg-yellow-50 text-yellow-700" :
                  inq.status === "replied" ? "bg-green-50 text-green-700" :
                  inq.status === "closed" ? "bg-gray-100 text-gray-600" :
                  "bg-blue-50 text-blue-700"
                }`}>
                  {inq.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No inquiries yet. They&apos;ll appear here when buyers reach out.
          </div>
        )}
      </div>
    </div>
  );
}
