/**
 * Dealer Workspace Layout
 *
 * Shared sidebar navigation for authenticated dealer workspace.
 * Guards on authentication + dealer role — redirects non-dealers.
 * Shows a "pending review" screen if dealership status is not yet approved.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Package, MessageSquare, Building, ArrowLeft, Loader2, BarChart2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/dealer", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dealer/dashboard", label: "Demand Analytics", icon: BarChart2 },
  { href: "/dealer/inventory", label: "Inventory", icon: Package },
  { href: "/dealer/inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/dealer/profile", label: "Dealership Profile", icon: Building },
];

export default function DealerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, isReady, isDealer, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dealerStatus, setDealerStatus] = useState<"loading" | "approved" | "pending" | "rejected">("loading");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (!isLoading && isReady && isAuthenticated && !isDealer) {
      router.replace("/workspace");
    }
  }, [isLoading, isAuthenticated, isReady, isDealer, router, pathname]);

  // Fetch dealership status once authenticated as dealer
  useEffect(() => {
    if (!isDealer || !session?.access_token) return;
    fetch("/api/dealer/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const status = data.dealership?.status ?? "approved"; // default approved for legacy rows
        setDealerStatus(status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending");
      })
      .catch(() => setDealerStatus("approved")); // fail open so existing dealers aren't locked out
  }, [isDealer, session?.access_token]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!isAuthenticated || !isDealer) return null;

  // Pending review screen
  if (dealerStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (dealerStatus === "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-yellow-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Application under review</h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Your dealership application is being reviewed by our team. You&apos;ll receive an email once it&apos;s approved — usually within 1 business day.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to OFFO
          </Link>
        </div>
      </div>
    );
  }

  if (dealerStatus === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Application not approved</h1>
          <p className="text-sm text-gray-600 mb-6">
            Your dealer application wasn&apos;t approved at this time. Please contact{" "}
            <a href="mailto:support@offolab.com" className="text-blue-600 hover:underline">support@offolab.com</a>{" "}
            if you have questions.
          </p>
          <Link href="/" className="inline-block px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition-colors">
            Back to OFFO
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b border-gray-100">
          <Link href="/hub" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Switch Workspace
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-green-600" : "text-gray-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/hub" className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="font-semibold text-gray-800">Dealer</span>
        <div className="flex-1" />
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-2 rounded-lg ${isActive ? "bg-green-50 text-green-600" : "text-gray-400"}`}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          );
        })}
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 md:p-6 p-4 pt-16 md:pt-6">
        {children}
      </main>
    </div>
  );
}
