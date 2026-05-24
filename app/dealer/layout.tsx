/**
 * Dealer Workspace Layout
 *
 * Top-nav layout matching the main OFFO header style.
 * Guards on authentication + dealer role. Shows status screens for
 * pending/rejected/unsubscribed dealerships.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, Package, Loader2, Clock, Settings, LogOut,
  Bookmark, ArrowLeftRight, MessageSquare, ShieldCheck, Menu, X, CreditCard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/dealer",            label: "Dashboard",      icon: LayoutDashboard, exact: true },
  { href: "/dealer/inventory",  label: "Inventory",      icon: Package,         exact: false },
  { href: "/dealer/inquiries",  label: "Inquiries",      icon: MessageSquare,   exact: false },
  { href: "/dealer/badge",      label: "Verified Badge", icon: ShieldCheck,     exact: false },
  { href: "/dealer/saved",      label: "Saved",          icon: Bookmark,        exact: false },
];

export default function DealerLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isReady, isDealer, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dealerStatus, setDealerStatus] = useState<"loading" | "approved" | "pending" | "rejected">("loading");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [openInquiryCount, setOpenInquiryCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<"starter" | "growth" | "pro" | null>(null);

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

  useEffect(() => {
    if (!isDealer || !session?.access_token) return;
    fetch("/api/dealer/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const status = data.dealership?.status ?? "approved";
        setDealerStatus(status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending");
        setSubscriptionStatus(data.dealership?.subscription_status ?? null);
      })
      .catch(() => { setDealerStatus("approved"); setSubscriptionStatus("pending_payment"); });
  }, [isDealer, session?.access_token]);

  useEffect(() => {
    if (!isDealer || !session?.access_token) return;
    fetch("/api/dealer/inquiries?status=open", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => setOpenInquiryCount(data.inquiries?.length ?? 0))
      .catch(() => {});
  }, [isDealer, session?.access_token]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  if (!isAuthenticated || !isDealer) return null;

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
          <Link href="/" className="inline-block px-5 py-2.5 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-lg hover:bg-[#00f090] transition-colors">
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

  // Subscription gate — null (no record), pending_payment, canceled, or inactive blocks access
  const isSubscriptionBlocked =
    subscriptionStatus === null ||
    subscriptionStatus === "pending_payment" ||
    subscriptionStatus === "canceled" ||
    subscriptionStatus === "inactive";

  const handleSubscribe = async (tier: "starter" | "growth" | "pro") => {
    if (!session?.access_token || checkoutLoading) return;
    setCheckoutLoading(tier);
    try {
      const res = await fetch("/api/dealer/create-checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* swallow */ }
    finally { setCheckoutLoading(null); }
  };

  const PLANS = [
    {
      tier: "starter" as const,
      name: "Starter",
      price: "$149",
      features: [
        "Up to 25 active listings",
        "Buyer intelligence dashboard (30d)",
        "Basic pricing intelligence",
        "Verified badge + public profile",
        "Buyer inquiry inbox",
      ],
    },
    {
      tier: "growth" as const,
      name: "Growth",
      price: "$299",
      popular: true,
      features: [
        "Up to 100 active listings",
        "Full buyer intelligence (90d + geo heatmap)",
        "Full pricing intelligence + AI explanation",
        "Priority placement in buyer reports",
        "CSV bulk import (500 vehicles)",
        "Inquiry response analytics",
      ],
    },
    {
      tier: "pro" as const,
      name: "Pro",
      price: "$499",
      features: [
        "Unlimited listings",
        "Everything in Growth",
        "API access (sync from your DMS)",
        "Early access to new features",
        "Dedicated onboarding call",
        "White-label badge with custom URL",
      ],
    },
  ];

  if (isSubscriptionBlocked) {
    const isReactivation = subscriptionStatus === "canceled" || subscriptionStatus === "inactive";
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-start p-4 pt-12">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-[#00d97e]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-7 h-7 text-[#00d97e]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {isReactivation ? "Reactivate your dealer account" : "Choose a plan to get started"}
            </h1>
            <p className="text-sm text-white/50 max-w-md mx-auto leading-relaxed">
              {isReactivation
                ? "Your subscription has ended. Pick a plan to restore access to your workspace, inventory, and buyer leads."
                : "Your dealership has been approved. Subscribe to activate your workspace, buyer intelligence, and verified badge."}
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {PLANS.map((plan) => (
              <div
                key={plan.tier}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  plan.popular
                    ? "border-[#00d97e]/40 bg-[#00d97e]/[0.04]"
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#00d97e] text-[#0d1117] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-white/40 text-sm mb-1">/mo</span>
                  </div>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                      <span className="text-[#00d97e] font-bold mt-0.5 flex-shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={checkoutLoading !== null}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                    plan.popular
                      ? "bg-[#00d97e] text-[#0d1117] hover:bg-[#00f090]"
                      : "bg-white/[0.08] text-white hover:bg-white/[0.12]"
                  }`}
                >
                  {checkoutLoading === plan.tier && <Loader2 className="w-4 h-4 animate-spin" />}
                  Choose {plan.name}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-white/25 mb-4">
            No long-term contract &bull; Cancel anytime &bull; Billed monthly
          </p>
          <div className="text-center">
            <button
              onClick={() => supabase.auth.signOut().then(() => router.replace("/"))}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navLinkCls = "text-[0.8125rem] font-medium tracking-[-0.01em] text-white/50 hover:text-white/90 transition-colors";

  return (
    <div className="min-h-screen bg-[#0d1117] flex flex-col">
      {/* Top nav — matches landing Header style */}
      <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Logo + badge */}
            <div className="flex items-center gap-2.5">
              <Link href="/" className="flex items-center">
                <Image src="/offo-logo.jpg" alt="OFFO" width={200} height={103} className="w-24 sm:w-28 h-auto" priority />
              </Link>
              <span className="text-xs font-medium text-white/30 border border-white/[0.10] rounded px-1.5 py-0.5 hidden sm:inline">Dealer</span>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const badge = item.href === "/dealer/inquiries" && openInquiryCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.8125rem] font-medium transition-colors ${
                      isActive
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                    }`}
                  >
                    <item.icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-[#00d97e]" : "text-white/40"}`} />
                    {item.label}
                    {badge && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                  </Link>
                );
              })}
            </div>

            {/* Right side — user actions */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/workspace"
                className={`${navLinkCls} flex items-center gap-1.5`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Buyer view
              </Link>
              <Link
                href="/workspace/settings"
                className={`${navLinkCls} flex items-center gap-1.5`}
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Link>
              {/* Avatar + sign out */}
              <div className="flex items-center gap-2 pl-3 border-l border-white/[0.08]">
                <div className="w-7 h-7 rounded-full bg-[#00d97e]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#00d97e] text-xs font-semibold">{initial}</span>
                </div>
                <span className="text-sm text-white/60 hidden lg:inline">{displayName}</span>
                <button
                  onClick={() => supabase.auth.signOut().then(() => router.replace("/"))}
                  className="text-white/30 hover:text-white/70 transition-colors ml-1"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-white/50 hover:text-white/90 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#0d1117]">
            <div className="px-4 py-3 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const badge = item.href === "/dealer/inquiries" && openInquiryCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? "bg-white/[0.08] text-white" : "text-white/60 hover:text-white/90"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#00d97e]" : "text-white/40"}`} />
                    <span className="flex-1">{item.label}</span>
                    {badge && <span className="w-2 h-2 rounded-full bg-red-500" />}
                  </Link>
                );
              })}
              <div className="border-t border-white/[0.06] pt-2 mt-2 space-y-0.5">
                <Link
                  href="/workspace"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4 text-white/40" />
                  Switch to Buyer
                </Link>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#00d97e]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#00d97e] text-xs font-semibold">{initial}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/80 truncate">{displayName}</p>
                    <p className="text-xs text-white/40 truncate">{email}</p>
                  </div>
                  <button
                    onClick={() => supabase.auth.signOut().then(() => router.replace("/"))}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
