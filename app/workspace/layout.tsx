/**
 * Workspace Layout — OFFOLab dark design
 *
 * Shared sidebar navigation for authenticated buyer workspace.
 * Guards on authentication — redirects to login if not signed in.
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Car,
  MessageSquare,
  Settings,
  Loader2,
  Eye,
  Zap,
  TrendingUp,
  GitCompare,
  Gavel,
  LayoutDashboard,
  LogOut,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/workspace",            label: "Overview",      icon: LayoutDashboard, exact: true },
  { href: "/workspace/garage",     label: "My Garage",     icon: Car,             exact: false },
  { href: "/workspace/deal-watch", label: "Deal Watch",    icon: Eye,             exact: false },
  { href: "/workspace/ev-fit",     label: "EV Fit Score",  icon: Zap,             exact: false },
  { href: "/workspace/market",     label: "Market Pulse",  icon: TrendingUp,      exact: false },
  { href: "/workspace/compare",    label: "Comparisons",   icon: GitCompare,      exact: false },
  { href: "/workspace/auction",    label: "Auction Tool",  icon: Gavel,           exact: false },
];

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, isReady, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const email = user?.email ?? "";
  const displayName = user?.user_metadata?.display_name ?? email.split("@")[0] ?? "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0d1117] flex">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-60 bg-[#0d1117] border-r border-white/[0.08] flex flex-col shrink-0 hidden md:flex">
        {/* Logo */}
        <div className="p-5 border-b border-white/[0.08]">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-wide">OFFO</span>
            <span className="text-sm font-bold text-[#00d97e] tracking-wide">Lab</span>
          </Link>
          <span className="text-xs text-white/40 block mt-0.5">Buyer Workspace</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
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

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.08] space-y-1">
          {/* New Analysis CTA */}
          <Link
            href="/receipt"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors mb-2"
          >
            <Plus className="w-4 h-4" />
            New Analysis
          </Link>

          {/* User row */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[#00d97e]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[#00d97e] text-sm font-semibold">{initial}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white/80 truncate">{displayName}</p>
              <p className="text-xs text-white/40 truncate">{email}</p>
            </div>
          </div>

          <Link
            href="/workspace/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[0.8125rem] text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-colors"
          >
            <Settings className="w-4 h-4 text-white/40" />
            Settings
          </Link>

          <button
            onClick={() => logout().then(() => router.replace("/"))}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[0.8125rem] text-white/50 hover:bg-white/[0.05] hover:text-white/80 transition-colors"
          >
            <LogOut className="w-4 h-4 text-white/40" />
            Sign out
          </button>

          {/* Pro tip */}
          <p className="text-[0.6875rem] text-white/20 px-3 pt-1 leading-snug">
            Pro Tip: Paste a CarGurus URL on the homepage for an instant AI verdict.
          </p>
        </div>
      </aside>

      {/* ── Mobile top bar ───────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0d1117] border-b border-white/[0.08] px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <span className="text-sm font-bold text-white tracking-wide">OFFO<span className="text-[#00d97e]">Lab</span></span>
        </Link>
        <span className="text-white/40 text-sm">Workspace</span>
        <div className="flex-1" />
        {NAV_ITEMS.slice(0, 3).map((item) => {
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

      {/* ── Main content ─────────────────────────────────────── */}
      <main className="flex-1 min-w-0 md:p-6 p-4 pt-16 md:pt-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
