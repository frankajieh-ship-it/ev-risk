/**
 * Workspace Layout
 *
 * Shared sidebar navigation for authenticated buyer workspace.
 * Guards on authentication — redirects to login if not signed in.
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Car, MessageSquare, Bookmark, Settings, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/workspace", label: "Dashboard", icon: Car, exact: true },
  { href: "/workspace/garage", label: "Garage", icon: Car },
  { href: "/workspace/inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/saved", label: "Saved Results", icon: Bookmark },
];

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, isReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to OFFO
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
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <Link
            href="/workspace/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <Settings className="w-4 h-4 text-gray-400" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="font-semibold text-gray-800">Workspace</span>
        <div className="flex-1" />
        {NAV_ITEMS.slice(0, 3).map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`p-2 rounded-lg ${isActive ? "bg-blue-50 text-blue-600" : "text-gray-400"}`}
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
