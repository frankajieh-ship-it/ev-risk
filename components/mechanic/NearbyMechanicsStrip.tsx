"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Wrench, ArrowRight, Loader2, MapPin } from "lucide-react";
import MechanicCard from "./MechanicCard";
import ServiceRequestForm from "./ServiceRequestForm";
import type { MechanicProfile, ServiceType } from "@/types/mechanic";

interface NearbyMechanicsStripProps {
  zip?: string;                        // pre-filled from lot location or user
  serviceType?: ServiceType;           // pre-filtered (e.g. 'salvage_assessment')
  vehicle?: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    auction_result_id?: string;
  };
  heading?: string;
}

type LoadState = "idle" | "loading" | "done" | "error" | "no_zip";

export default function NearbyMechanicsStrip({
  zip,
  serviceType = "salvage_assessment",
  vehicle,
  heading = "Find a mechanic near this lot",
}: NearbyMechanicsStripProps) {
  const [mechanics, setMechanics] = useState<MechanicProfile[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(zip ? "idle" : "no_zip");
  const [userZip, setUserZip] = useState(zip ?? "");
  const [zipInput, setZipInput] = useState("");
  const [selectedMechanic, setSelectedMechanic] = useState<MechanicProfile | null>(null);

  const fetchMechanics = useCallback(async (searchZip: string) => {
    if (!searchZip || !/^\d{5}$/.test(searchZip)) return;
    setLoadState("loading");
    try {
      const params = new URLSearchParams({
        zip: searchZip,
        service_type: serviceType,
        radius_miles: "75",
        limit: "3",
      });
      const res = await fetch(`/api/mechanics/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setMechanics(data.mechanics ?? []);
      setLoadState("done");
    } catch {
      setLoadState("error");
    }
  }, [serviceType]);

  useEffect(() => {
    if (zip && /^\d{5}$/.test(zip)) {
      setUserZip(zip);
      fetchMechanics(zip);
    }
  }, [zip, fetchMechanics]);

  const handleSubmitRequest = async (data: Parameters<React.ComponentProps<typeof ServiceRequestForm>["onSubmit"]>[0]) => {
    try {
      const res = await fetch("/api/services/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, mechanic_id: selectedMechanic?.id }),
      });
      const json = await res.json();
      return { success: res.ok, request_id: json.request_id, error: json.error };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  /* ── No ZIP state: ask for one ───────────────────────────────────────── */
  if (loadState === "no_zip") {
    return (
      <div className="card-base bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Enter a ZIP code to find verified mechanics who specialize in salvage and EV inspections.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value.replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && /^\d{5}$/.test(zipInput)) {
                  setUserZip(zipInput);
                  fetchMechanics(zipInput);
                }
              }}
              placeholder="Your ZIP code"
              className="form-input pl-9"
            />
          </div>
          <button
            onClick={() => { setUserZip(zipInput); fetchMechanics(zipInput); }}
            disabled={!/^\d{5}$/.test(zipInput)}
            className="btn-md btn-auction flex items-center gap-2"
          >
            Search
          </button>
        </div>
      </div>
    );
  }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (loadState === "loading") {
    return (
      <div className="card-base bg-white p-5 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-orange-500 animate-spin flex-shrink-0" />
        <p className="text-sm text-gray-600">Finding mechanics near {userZip}…</p>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────────── */
  if (loadState === "error") {
    return (
      <div className="card-base bg-white p-5">
        <p className="text-sm text-gray-500 mb-2">Could not load nearby mechanics.</p>
        <button
          onClick={() => fetchMechanics(userZip)}
          className="text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  /* ── No results ──────────────────────────────────────────────────────── */
  if (loadState === "done" && mechanics.length === 0) {
    return (
      <div className="card-base bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          No verified mechanics found within 75 miles of {userZip} yet.
        </p>
        <Link
          href="/mechanics"
          className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 transition-colors"
        >
          Browse all mechanics
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  /* ── Results ─────────────────────────────────────────────────────────── */
  return (
    <div className="card-base bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-semibold text-gray-900">{heading}</h3>
        </div>
        <Link
          href={`/mechanics?zip=${userZip}&service_type=${serviceType}`}
          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
        >
          See all
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Mechanic cards — horizontal scroll on mobile, stacked on md+ */}
      <div className="px-4 pb-4">
        <div className="flex gap-3 overflow-x-auto pb-1 md:flex-col md:overflow-x-visible snap-x snap-mandatory">
          {mechanics.map((m) => (
            <div key={m.id} className="flex-shrink-0 w-72 md:w-full snap-start">
              <MechanicCard
                mechanic={m}
                highlightService={serviceType}
                compact
                onRequestClick={(mechanic) => setSelectedMechanic(mechanic)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Service request modal */}
      {selectedMechanic && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedMechanic(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-base font-bold text-gray-900">Request service</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedMechanic.business_name}</p>
              </div>
              <button
                onClick={() => setSelectedMechanic(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mt-5">
              <ServiceRequestForm
                vehicle={vehicle}
                defaultServiceType={serviceType}
                defaultZip={userZip}
                onSubmit={handleSubmitRequest}
                onClose={() => setSelectedMechanic(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
