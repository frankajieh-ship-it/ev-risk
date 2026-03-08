/**
 * Workspace Hub
 *
 * Landing page for authenticated users. Shows role-based workspace
 * options — buyers see their workspace, dealers see both buyer + dealer.
 * Back buttons in workspace/dealer layouts point here.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Building, ArrowLeft, Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function HubPage() {
  const { isAuthenticated, isLoading, isReady, role, isDealer, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // If buyer-only, skip hub and go straight to workspace
  useEffect(() => {
    if (!isLoading && isReady && role === "buyer") {
      router.replace("/workspace");
    }
  }, [isLoading, isReady, role, router]);

  if (isLoading || !isReady || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-8 justify-center"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to OFFO
        </Link>

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">Your Workspaces</h1>
          <p className="text-sm text-gray-500 mt-1">Choose where you want to go</p>
        </div>

        <div className="space-y-3">
          {/* Buyer workspace — always available */}
          <Link
            href="/workspace"
            className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-all"
          >
            <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Buyer Workspace</p>
              <p className="text-sm text-gray-500">Your garage, inquiries, and saved results</p>
            </div>
          </Link>

          {/* Dealer workspace — only for dealers */}
          {isDealer && (
            <Link
              href="/dealer"
              className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-gray-200 hover:border-green-400 transition-all"
            >
              <div className="w-11 h-11 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                <Building className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Dealer Workspace</p>
                <p className="text-sm text-gray-500">Inventory, inquiries, and dealership profile</p>
              </div>
            </Link>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full mt-6 flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
