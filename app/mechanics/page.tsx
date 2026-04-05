"use client";

/**
 * Mechanic Directory — /mechanics
 * Searchable directory of verified mechanics specializing in EV and salvage work.
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Wrench, ChevronRight, Loader2 } from "lucide-react";
import MechanicSearchBar from "@/components/mechanic/MechanicSearchBar";
import MechanicCard from "@/components/mechanic/MechanicCard";
import { EmptyState } from "@/components/ui";
import type { MechanicProfile, ServiceType } from "@/types/mechanic";
import { useEventTracking } from "@/hooks/useEventTracking";

type SearchState = "idle" | "loading" | "done" | "error";

export default function MechanicDirectoryPage() {
  const [mechanics, setMechanics] = useState<MechanicProfile[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [lastZip, setLastZip] = useState("");
  const [lastService, setLastService] = useState<ServiceType | "">("");
  const { trackEvent } = useEventTracking();

  const handleSearch = useCallback(async (params: { zip: string; service_type: ServiceType | ""; radius_miles: number }) => {
    setSearchState("loading");
    setLastZip(params.zip);
    setLastService(params.service_type);
    trackEvent("mechanic_directory_searched", { zip: params.zip, service_type: params.service_type });

    try {
      const qs = new URLSearchParams({
        zip: params.zip,
        radius_miles: String(params.radius_miles),
        limit: "20",
      });
      if (params.service_type) qs.set("service_type", params.service_type);

      const res = await fetch(`/api/mechanics/search?${qs}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setMechanics(data.mechanics ?? []);
      setSearchState("done");
    } catch {
      setSearchState("error");
    }
  }, [trackEvent]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back nav */}
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to OFFO
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Find a Mechanic</h1>
          <p className="text-sm text-gray-500 mt-1">
            Verified mechanics specializing in EV inspections, salvage assessments, and pre-purchase checks.
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-6">
          <MechanicSearchBar
            onSearch={handleSearch}
            loading={searchState === "loading"}
          />
        </div>

        {/* Mechanic CTA */}
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-orange-900">Are you a mechanic?</p>
            <p className="text-xs text-orange-700 mt-0.5">
              List your shop and get matched with EV buyers and Copart dealers near you.
            </p>
          </div>
          <Link
            href="/mechanics/join"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            List your shop
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Results */}
        {searchState === "idle" && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Wrench className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Enter your ZIP to find mechanics nearby</p>
            <p className="text-sm text-gray-400 mt-1">We&apos;ll show verified shops within your search radius</p>
          </div>
        )}

        {searchState === "loading" && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500">Searching near {lastZip}…</p>
          </div>
        )}

        {searchState === "error" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">Search failed. Please try again.</p>
            <button
              onClick={() => handleSearch({ zip: lastZip, service_type: lastService, radius_miles: 50 })}
              className="text-sm text-blue-600 underline hover:text-blue-700"
            >
              Retry
            </button>
          </div>
        )}

        {searchState === "done" && mechanics.length === 0 && (
          <EmptyState
            icon={<Wrench className="w-10 h-10" />}
            title="No mechanics found near this ZIP"
            description={`We don't have verified mechanics within range of ${lastZip} yet. Check back soon — or list your shop.`}
            action={
              <Link
                href="/mechanics/join"
                className="btn-md btn-auction inline-flex items-center gap-2 mt-2"
              >
                List your shop
                <ChevronRight className="w-4 h-4" />
              </Link>
            }
          />
        )}

        {searchState === "done" && mechanics.length > 0 && (
          <>
            <p className="text-sm text-gray-400 mb-4">
              {mechanics.length} mechanic{mechanics.length !== 1 ? "s" : ""} near {lastZip}
            </p>
            <div className="space-y-4">
              {mechanics.map((m) => (
                <MechanicCard
                  key={m.id}
                  mechanic={m}
                  highlightService={lastService || undefined}
                  onRequestClick={() => {
                    trackEvent("mechanic_directory_request_clicked", { mechanic_id: m.id });
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
