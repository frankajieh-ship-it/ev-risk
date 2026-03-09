"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Zap, MapPin, ArrowRight, ExternalLink } from "lucide-react";
import type { VehicleRecommendation } from "@/types/recommendations";
import { getCarGurusUrl } from "@/lib/cargurus-links";
import { ScoreImprovementSuggestions } from "./blocks/ScoreImprovementSuggestions";

const fitColors: Record<string, { bg: string; text: string; border: string }> = {
  "Great Fit": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  "Good Fit": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "Mixed Fit": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "High Friction": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const scoreBadgeColors: Record<string, string> = {
  "Great Fit": "bg-green-600",
  "Good Fit": "bg-blue-600",
  "Mixed Fit": "bg-amber-500",
  "High Friction": "bg-red-500",
};

interface RecommendationCardProps {
  recommendation: VehicleRecommendation;
  onSelect: () => void;
  muted?: boolean;
  userZipCode?: string | null;
}

function formatPrice(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString();
}

export default function RecommendationCard({ recommendation: rec, onSelect, muted, userZipCode }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = fitColors[rec.fit_label] ?? fitColors["Mixed Fit"];
  const badgeBg = scoreBadgeColors[rec.fit_label] ?? "bg-gray-500";
  const hasDealers = rec.dealer_listings.length > 0;
  const totalListings = rec.dealer_listings.reduce((sum, d) => sum + d.listing_count, 0);

  return (
    <div className={`rounded-2xl border-2 ${colors.border} ${muted ? "opacity-70" : ""} bg-white overflow-hidden transition-shadow hover:shadow-md`}>
      <div className="p-5">
        {/* Top row: Score badge + vehicle name */}
        <div className="flex items-start gap-4">
          <div className={`${badgeBg} text-white w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0`}>
            <span className="text-lg font-bold leading-none">{rec.fit_score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{rec.model}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                {rec.fit_label}
              </span>
              <span className="text-xs text-gray-500">{rec.year}</span>
            </div>
          </div>
        </div>

        {/* Specs row */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            {rec.real_world_range_mi} mi range
          </span>
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            {rec.battery_kwh} kWh
          </span>
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            {rec.chemistry}
          </span>
        </div>

        {/* Top stress flag insight */}
        {rec.top_stress_flag && (
          <p className="mt-3 text-sm text-gray-600 italic">
            &ldquo;{rec.top_stress_flag}&rdquo;
          </p>
        )}

        {/* Score improvement suggestions */}
        {rec.score_improvements && (
          <ScoreImprovementSuggestions improvements={rec.score_improvements} />
        )}

        {/* Dealer availability */}
        {hasDealers && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            Available at {rec.dealer_listings.length} OFFO dealer{rec.dealer_listings.length > 1 ? "s" : ""} ({totalListings} listing{totalListings > 1 ? "s" : ""})
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* Action buttons */}
        <div className="mt-4 space-y-2">
          <button
            onClick={onSelect}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            See Full Report
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href={getCarGurusUrl(rec.make, rec.model_short, {
              year: rec.year,
              zip: userZipCode ?? undefined,
              range_mi: rec.real_world_range_mi,
              battery_kwh: rec.battery_kwh,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            Browse on CarGurus
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Expanded dealer listings */}
      <AnimatePresence>
        {expanded && hasDealers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 space-y-2">
              {rec.dealer_listings.map((dealer) => (
                <Link
                  key={dealer.dealer_slug}
                  href={`/dealers/${dealer.dealer_slug}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                      {dealer.dealer_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {dealer.dealer_city}{dealer.dealer_state ? `, ${dealer.dealer_state}` : ""} &middot; {dealer.listing_count} listing{dealer.listing_count > 1 ? "s" : ""}
                    </p>
                  </div>
                  {dealer.price_range_cents && (
                    <span className="text-xs font-medium text-gray-600">
                      {dealer.price_range_cents.min === dealer.price_range_cents.max
                        ? formatPrice(dealer.price_range_cents.min)
                        : `${formatPrice(dealer.price_range_cents.min)} - ${formatPrice(dealer.price_range_cents.max)}`}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
