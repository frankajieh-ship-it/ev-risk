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
import Image from "next/image";
import { LayoutDashboard, Package, Loader2, Clock, Settings, LogOut, Bookmark, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/dealer",           label: "Dashboard",      icon: LayoutDashboard, exact: true },
  { href: "/dealer/inventory", label: "Inventory",      icon: Package,         exact: false },
  { href: "/dealer/saved",     label: "Saved Listings", icon: Bookmark,        exact: false },
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

  const displayName =
    (session?.user?.user_metadata?.full_name as string | undefined) ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const email = session?.user?.email ?? "";
  const initial = displayName.charAt(0).toUpperCase();

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
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  if (!isAuthenticated || !isDealer) return null;

  // Pending review screen
  if (dealerStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-6 h-6 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  if (dealerStatus === "pending") {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/[0.05] rounded-2xl border border-white/10 p-8 text-center">
          <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Application under review</h1>
          <p className="text-sm text-white/50 mb-6 leading-relaxed">
            Your dealership application is being reviewed by our team. You&apos;ll receive an email once it&apos;s approved — usually within 1 business day.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors"
          >
            Back to OFFO
          </Link>
        </div>
      </div>
    );
  }

  if (dealerStatus === "rejected") {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/[0.05] rounded-2xl border border-white/10 p-8 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Application not approved</h1>
          <p className="text-sm text-white/50 mb-6">
            Your dealer application wasn&apos;t approved at this time. Please contact{" "}
            <a href="mailto:support@offolab.com" className="text-[#00d97e] hover:underline">support@offolab.com</a>{" "}
            if you have questions.
          </p>
          <Link href="/" className="inline-block px-5 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors">
            Back to OFFO
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0d1117] border-r border-white/[0.08] flex flex-col shrink-0 hidden md:flex">
        {/* Logo */}
        <div className="p-5 border-b border-white/[0.08] flex items-center gap-3">
          <Link href="/" className="flex items-center">
            <Image src="/offo-logo.jpg" alt="OFFO" width={88} height={45} className="h-7 w-auto" />
          </Link>
          <span className="text-xs font-medium text-white/30 border border-white/[0.10] rounded px-1.5 py-0.5">Dealer</span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[0.8125rem] font-medium transition-colors ${
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-[#00d97e]" : "text-white/40"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + footer */}
        <div className="p-3 border-t border-white/[0.08]">
          {/* Avatar row */}
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#00d97e]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#00d97e] text-sm font-semibold">{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/80 truncate">{displayName}</p>
              <p className="text-xs text-white/40 truncate">{email}</p>
            </div>
          </div>
          <Link
            href="/workspace"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[0.8125rem] text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4 text-white/40" />
            Switch to Buyer
          </Link>
          <Link
            href="/workspace/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[0.8125rem] text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-colors"
          >
            <Settings className="w-4 h-4 text-white/40" />
            Settings
          </Link>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.replace("/"))}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[0.8125rem] text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-colors"
          >
            <LogOut className="w-4 h-4 text-white/40" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0d1117] border-b border-white/[0.08] px-4 py-2.5 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/offo-logo.jpg" alt="OFFO" width={72} height={37} className="h-6 w-auto" />
          <span className="text-xs font-medium text-white/30 border border-white/[0.10] rounded px-1.5 py-0.5">Dealer</span>
        </Link>
        <div className="flex-1" />
        {NAV_ITEMS.slice(0, 4).map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-2 rounded-lg ${isActive ? "bg-white/[0.08] text-[#00d97e]" : "text-white/40"}`}
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
