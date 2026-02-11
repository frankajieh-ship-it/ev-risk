/**
 * ChecklistPageClient — SEO landing page for underpriced EV listings
 *
 * Hero with H1, 7 verification bullets, textarea for listing paste,
 * CTA that stores text in sessionStorage and redirects to /receipt.
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Battery,
  FileWarning,
  CarFront,
  Zap,
  Wrench,
  DollarSign,
  UserCheck,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";

const CHECKLIST_ITEMS = [
  {
    icon: Battery,
    title: "Battery Health",
    desc: "Check state-of-health (SoH) percentage and remaining range vs. original EPA rating.",
  },
  {
    icon: FileWarning,
    title: "Title Status",
    desc: "Verify clean title — salvage or rebuilt titles can hide flood, fire, or collision damage.",
  },
  {
    icon: CarFront,
    title: "Accident History",
    desc: "Review Carfax or AutoCheck for unreported accidents, frame damage, or airbag deployments.",
  },
  {
    icon: Zap,
    title: "Charging Capability",
    desc: "Confirm DC fast charge (DCFC) support and onboard charger kW rating for your driving needs.",
  },
  {
    icon: Wrench,
    title: "Service History",
    desc: "Look for regular maintenance records — especially 12V battery, coolant, and brake fluid service.",
  },
  {
    icon: DollarSign,
    title: "Price Comparison",
    desc: "Compare against KBB, Edmunds, and recent sold listings for the same year/model/mileage.",
  },
  {
    icon: UserCheck,
    title: "Seller Identity",
    desc: "Private sellers and curbstoners carry different risk profiles than franchise dealers.",
  },
];

export default function ChecklistPageClient() {
  const router = useRouter();
  const { trackEvent } = useEventTracking();
  useVisitorTracking();

  const [listingText, setListingText] = useState("");

  useEffect(() => {
    trackEvent("page_view", { page_source: "seo_underpriced_checklist" });
  }, [trackEvent]);

  const handleSubmit = () => {
    if (!listingText.trim()) return;

    trackEvent("listing_paste_submitted", {
      page_source: "seo_underpriced_checklist",
      text_length: listingText.trim().length,
    });

    sessionStorage.setItem("offo_listing_text", listingText.trim());
    router.push("/receipt");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8">
          <Receipt className="w-5 h-5 text-blue-600" />
          <a
            href="/"
            className="text-xs font-medium text-blue-600 uppercase tracking-wider hover:text-blue-800 transition-colors"
          >
            OFFO
          </a>
        </div>

        {/* Hero */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Free Verification Checklist
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 leading-tight">
            Found a Cheap EV Listing?
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            An underpriced EV listing can be a great deal — or a hidden risk.
            Run through these 7 checks before you message the seller.
          </p>
        </div>

        {/* Checklist */}
        <div className="space-y-4 mb-10">
          {CHECKLIST_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            Check a listing now
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Paste the listing text below and get an AI-powered deal verdict with
            risk flags, must-ask questions, and a negotiation opener.
          </p>
          <textarea
            value={listingText}
            onChange={(e) => setListingText(e.target.value)}
            placeholder={`Paste the listing here...\n\nExample:\n2022 Tesla Model 3 Long Range\n28,000 miles — $24,500\nClean title, 1 owner, private seller\nPhoenix, AZ`}
            rows={6}
            maxLength={8000}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm resize-none focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 mb-3"
          />
          <button
            onClick={handleSubmit}
            disabled={listingText.trim().length < 20}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              listingText.trim().length >= 20
                ? "bg-gradient-to-r from-blue-600 to-green-600 text-white hover:shadow-lg hover:shadow-blue-200"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Check This Listing
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            Free — no sign-up required
          </p>
        </div>
      </div>
    </div>
  );
}
