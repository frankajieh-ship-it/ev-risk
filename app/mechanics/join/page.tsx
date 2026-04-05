"use client";

/**
 * Mechanic Sign-Up Page — /mechanics/join
 * Wraps the MechanicOnboarding wizard and wires it to POST /api/mechanics/register.
 * On success, redirects the mechanic to their new profile page.
 */

import Link from "next/link";
import { ArrowLeft, Zap, ShieldCheck, Users } from "lucide-react";
import MechanicOnboarding from "@/components/mechanic/MechanicOnboarding";
import type { ServiceType } from "@/types/mechanic";
import { useEventTracking } from "@/hooks/useEventTracking";

interface OnboardingData {
  business_name: string;
  bio: string;
  phone: string;
  website: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  service_radius_miles: number;
  specialties: ServiceType[];
  certifications: string[];
}

export default function MechanicJoinPage() {
  const { trackEvent } = useEventTracking();

  const handleSubmit = async (data: OnboardingData) => {
    trackEvent("mechanic_onboarding_submitted", { city: data.city, state: data.state });

    try {
      const res = await fetch("/api/mechanics/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        trackEvent("mechanic_onboarding_success", { slug: json.slug });
        return { success: true, slug: json.slug };
      }

      return { success: false, error: json.error ?? "Registration failed. Please try again." };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Nav */}
        <Link href="/mechanics" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" />
          Find mechanics
        </Link>

        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">List your shop on OFFO</h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Get matched with serious buyers and Copart dealers near your location. Free to list — no subscription required.
          </p>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { icon: <Users className="w-5 h-5 text-orange-500" />, title: "Reach active buyers", desc: "Users already shopping Copart lots near your ZIP" },
            { icon: <Zap className="w-5 h-5 text-orange-500" />, title: "EV-specialized leads", desc: "Filter by EV inspection, battery diagnostics, and more" },
            { icon: <ShieldCheck className="w-5 h-5 text-orange-500" />, title: "Verified listing", desc: "Earn the verified badge after our quick review" },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="flex justify-center mb-2">{icon}</div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{title}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          ))}
        </div>

        {/* Onboarding wizard */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8">
          <MechanicOnboarding onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
