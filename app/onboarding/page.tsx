/**
 * Onboarding Page
 *
 * Step 1: Role selection (buyer / dealer)
 * Step 2: EV preferences — buyer only (charging_access, weekly_miles, climate)
 *         Dealers skip Step 2 and go directly to /dealer
 *
 * Sets user_metadata via /api/onboarding, then PATCHes /api/workspace/profile
 * with EV preferences before redirecting to /workspace.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShoppingCart, Building, Loader2, ArrowRight, Zap, Thermometer, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseAuthClient } from "@/lib/supabase-auth";

type ChargingAccess = "home_l2" | "home_l1" | "shared" | "none";
type Climate = "mild" | "winter" | "hot";

const CHARGING_OPTIONS: { value: ChargingAccess; label: string; desc: string }[] = [
  { value: "home_l2", label: "Home Level 2", desc: "240V charger in garage or driveway" },
  { value: "home_l1", label: "Home Level 1", desc: "Standard 120V outlet at home" },
  { value: "shared", label: "Shared / Apartment", desc: "Workplace, lot, or building charger" },
  { value: "none", label: "No home charging", desc: "Public DC fast charging only" },
];

const CLIMATE_OPTIONS: { value: Climate; label: string; icon: React.ReactNode }[] = [
  { value: "mild", label: "Mild", icon: <Zap className="w-4 h-4" /> },
  { value: "winter", label: "Cold winters", icon: <Thermometer className="w-4 h-4" /> },
  { value: "hot", label: "Hot summers", icon: <MapPin className="w-4 h-4" /> },
];

export default function OnboardingPage() {
  const { isAuthenticated, isLoading, isReady, role, isDealer, session } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<"buyer" | "dealer" | null>(null);
  const [dealershipName, setDealershipName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 2 EV prefs
  const [chargingAccess, setChargingAccess] = useState<ChargingAccess | null>(null);
  const [weeklyMiles, setWeeklyMiles] = useState("");
  const [climate, setClimate] = useState<Climate | null>(null);

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

  const handleStep1Submit = async () => {
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
      if (supabase) await supabase.auth.refreshSession();

      if (selected === "dealer") {
        router.push(data.redirect);
      } else {
        // Buyer → show Step 2
        setSubmitting(false);
        setStep(2);
      }
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const handleStep2Submit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const patch: Record<string, unknown> = {};
      if (chargingAccess) patch.charging_access = chargingAccess;
      if (weeklyMiles && !isNaN(Number(weeklyMiles))) patch.weekly_miles = Number(weeklyMiles);
      if (climate) patch.climate = climate;

      if (Object.keys(patch).length > 0) {
        await fetch("/api/workspace/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(patch),
        });
      }
    } catch {
      // non-critical — proceed to workspace regardless
    }

    router.push("/workspace");
  };

  if (isLoading || !isReady || role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d97e]" />
      </div>
    );
  }

  // ── Step 2: EV preferences ──────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <Image src="/offo-logo.png" alt="OFFO" width={96} height={38} className="h-10 w-auto mx-auto mb-3" />
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-xs text-white/30">Step 2 of 2</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Quick setup</h1>
            <p className="text-sm text-white/40 mt-2">
              Takes 30 seconds — makes your first receipt more accurate.
            </p>
          </div>

          <div className="space-y-6">
            {/* Charging access */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Where do you charge?</p>
              <div className="space-y-2">
                {CHARGING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setChargingAccess(opt.value)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      chargingAccess === opt.value
                        ? "border-[#00d97e]/40 bg-[#00d97e]/[0.06]"
                        : "border-white/[0.08] bg-[#161b22] hover:border-white/20"
                    }`}
                  >
                    <p className={`text-sm font-medium ${chargingAccess === opt.value ? "text-[#00d97e]" : "text-white"}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly miles */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                How many miles do you drive per week?
              </label>
              <input
                type="number"
                value={weeklyMiles}
                onChange={(e) => setWeeklyMiles(e.target.value)}
                placeholder="e.g. 200"
                min={0}
                max={3000}
                className="w-full px-4 py-3 bg-[#161b22] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
              />
            </div>

            {/* Climate */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">What&apos;s your climate like?</p>
              <div className="grid grid-cols-3 gap-3">
                {CLIMATE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setClimate(opt.value)}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      climate === opt.value
                        ? "border-[#00d97e]/40 bg-[#00d97e]/[0.06] text-[#00d97e]"
                        : "border-white/[0.08] bg-[#161b22] text-white/50 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    {opt.icon}
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={() => router.push("/workspace")}
              className="flex-1 py-3 rounded-xl border border-white/[0.08] text-white/40 text-sm font-medium hover:text-white/60 hover:border-white/20 transition-colors"
            >
              Skip for now
            </button>
            <button
              onClick={handleStep2Submit}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Role selection ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <Image src="/offo-logo.png" alt="OFFO" width={96} height={38} className="h-10 w-auto mx-auto mb-3" />
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-xs text-white/30">Step 1 of 2</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to OFFO</h1>
          <p className="text-sm text-white/40 mt-2">How will you be using the platform?</p>
        </div>

        <div className="space-y-3">
          {/* Buyer card */}
          <button
            onClick={() => { setSelected("buyer"); setError(""); }}
            disabled={submitting}
            className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
              selected === "buyer"
                ? "border-[#00d97e]/50 bg-[#00d97e]/[0.06]"
                : "border-white/[0.08] bg-[#161b22] hover:border-white/20"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                selected === "buyer" ? "bg-[#00d97e]/20 text-[#00d97e]" : "bg-white/[0.06] text-white/40"
              }`}>
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <p className={`font-semibold ${selected === "buyer" ? "text-[#00d97e]" : "text-white"}`}>
                  I&apos;m a Buyer
                </p>
                <p className="text-sm text-white/40 mt-0.5">
                  Browse listings, save vehicles to your garage, and get risk-scored receipts
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
                ? "border-white/30 bg-white/[0.04]"
                : "border-white/[0.08] bg-[#161b22] hover:border-white/20"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                selected === "dealer" ? "bg-white/10 text-white" : "bg-white/[0.06] text-white/40"
              }`}>
                <Building className="w-5 h-5" />
              </div>
              <div>
                <p className={`font-semibold ${selected === "dealer" ? "text-white" : "text-white"}`}>
                  I&apos;m a Dealer
                </p>
                <p className="text-sm text-white/40 mt-0.5">
                  List your inventory, respond to buyer inquiries, and grow your EV business
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Dealer name input */}
        {selected === "dealer" && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Dealership Name
            </label>
            <input
              type="text"
              value={dealershipName}
              onChange={(e) => setDealershipName(e.target.value)}
              placeholder="e.g. Green Motors EV"
              className="w-full px-4 py-3 bg-[#161b22] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00d97e]/40 transition-colors"
              disabled={submitting}
            />
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        {/* Continue button */}
        {selected && (
          <button
            onClick={handleStep1Submit}
            disabled={submitting || (selected === "dealer" && !dealershipName.trim())}
            className="w-full mt-6 py-3 rounded-xl bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
