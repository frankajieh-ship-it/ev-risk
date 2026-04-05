"use client";

import { useState } from "react";
import { Search, MapPin, ChevronDown } from "lucide-react";
import type { ServiceType } from "@/types/mechanic";
import { SERVICE_TYPE_LABELS } from "@/types/mechanic";

interface MechanicSearchBarProps {
  defaultZip?: string;
  defaultService?: ServiceType;
  onSearch: (params: { zip: string; service_type: ServiceType | ""; radius_miles: number }) => void;
  loading?: boolean;
}

const RADIUS_OPTIONS = [10, 25, 50, 100];

const SERVICE_OPTIONS: { value: ServiceType | ""; label: string }[] = [
  { value: "", label: "All services" },
  ...Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({
    value: value as ServiceType,
    label,
  })),
];

export default function MechanicSearchBar({
  defaultZip = "",
  defaultService,
  onSearch,
  loading = false,
}: MechanicSearchBarProps) {
  const [zip, setZip] = useState(defaultZip);
  const [serviceType, setServiceType] = useState<ServiceType | "">(defaultService ?? "");
  const [radius, setRadius] = useState(50);
  const [zipError, setZipError] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = zip.trim();
    if (!/^\d{5}$/.test(clean)) {
      setZipError("Enter a valid 5-digit ZIP code");
      return;
    }
    setZipError("");
    onSearch({ zip: clean, service_type: serviceType, radius_miles: radius });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white card-base p-4 md:p-5"
      role="search"
      aria-label="Search mechanics"
    >
      <div className="flex flex-col sm:flex-row gap-3">
        {/* ZIP input */}
        <div className="relative flex-shrink-0 w-full sm:w-40">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
              setZipError("");
            }}
            placeholder="ZIP code"
            aria-label="ZIP code"
            className={`form-input pl-9 ${zipError ? "border-red-400 focus:border-red-500 focus:ring-red-500" : ""}`}
          />
        </div>

        {/* Service type select */}
        <div className="relative flex-1">
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType | "")}
            aria-label="Service type"
            className="form-input appearance-none pr-8 bg-white"
          >
            {SERVICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Radius select */}
        <div className="relative flex-shrink-0 w-full sm:w-32">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            aria-label="Search radius"
            className="form-input appearance-none pr-8 bg-white"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                Within {r} mi
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !zip.trim()}
          className="btn-md btn-primary flex-shrink-0 flex items-center gap-2"
        >
          <Search className="w-4 h-4" />
          {loading ? "Searching…" : "Find mechanics"}
        </button>
      </div>

      {zipError && (
        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">{zipError}</p>
      )}
    </form>
  );
}
