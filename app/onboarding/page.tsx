/**
 * Onboarding Page
 *
 * First-time users choose their role: Buyer or Dealer.
 * Sets user_metadata via /api/onboarding, refreshes session, then redirects.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShoppingCart, Building, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";

export default function OnboardingPage() {
  const { isAuthenticated, isLoading, isReady, role, isDealer, session } = useAuth();
  const router = useRouter();

  const [selected, setSelected] = useState<"buyer" | "dealer" | null>(null);
  const [dealershipName, setDealershipName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth/login?redirect=/onboarding");
    }
  }, [isLoading, isAuthenticated, router]);

  // Redirect if already onboarded
  useEffect(() => {
    if (!isLoading && isReady && role) {
      if (isDealer) router.replace("/dealer");
      else router.replace("/workspace");
    }
  }, [isLoading, isReady, role, isDealer, router]);

  const handleSubmit = async () => {
    if (!selected) return;
    if (selected === "dealer" && !dealershipName.trim()) {
      setError("Please enter your dealership name");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          role: selected,
          dealershipName: selected === "dealer" ? dealershipName.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      // Refresh session so useAuth picks up new role from metadata
      const supabase = getSupabaseAuthClient();
      if (supabase) {
        await supabase.auth.refreshSession();
      }

      router.push(data.redirect);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  if (isLoading || !isReady || role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Image src="/offo-logo.png" alt="OFFO" width={96} height={38} className="h-10 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Welcome to OFFO</h1>
          <p className="text-sm text-gray-500 mt-2">How will you be using the platform?</p>
        </div>

        <div className="space-y-3">
          {/* Buyer card */}
          <button
            onClick={() => { setSelected("buyer"); setError(""); }}
            disabled={submitting}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              selected === "buyer"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                selected === "buyer" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">I&apos;m a Buyer</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Browse listings, save vehicles to your garage, and contact dealers
                </p>
              </div>
            </div>
          </button>

          {/* Dealer card */}
          <button
            onClick={() => { setSelected("dealer"); setError(""); }}
            disabled={submitting}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              selected === "dealer"
                ? "border-green-600 bg-green-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                selected === "dealer" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                <Building className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">I&apos;m a Dealer</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  List your inventory, respond to buyer inquiries, and grow your EV business
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Dealer name input */}
        {selected === "dealer" && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dealership Name
            </label>
            <input
              type="text"
              value={dealershipName}
              onChange={(e) => setDealershipName(e.target.value)}
              placeholder="e.g. Green Motors EV"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              disabled={submitting}
            />
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        {/* Continue button */}
        {selected && (
          <button
            onClick={handleSubmit}
            disabled={submitting || (selected === "dealer" && !dealershipName.trim())}
            className={`w-full mt-6 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
              selected === "dealer"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
