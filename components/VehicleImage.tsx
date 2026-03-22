/**
 * VehicleImage — lazy-loads a vehicle photo via /api/photos
 *
 * Shows a neutral car silhouette while loading, then fades in the
 * first available photo from Auto.dev market listings. Falls back
 * to the silhouette if no photo is found.
 *
 * Usage:
 *   <VehicleImage make="Toyota" model="RAV4 Prime" year={2021} className="..." />
 */

"use client";

import { useState, useEffect } from "react";

interface VehicleImageProps {
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  /** Tailwind classes applied to the outer container */
  className?: string;
  /** Tailwind classes applied to the img element */
  imgClassName?: string;
  /** alt text override */
  alt?: string;
}

function CarSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="120" height="60" rx="4" fill="#F3F4F6" />
      {/* Car body */}
      <path
        d="M15 38 Q18 28 32 24 L52 22 Q62 21 72 24 L88 26 Q100 28 105 35 L106 38 Q100 42 85 43 Q70 44 35 43 Q20 42 15 38Z"
        fill="#D1D5DB"
      />
      {/* Windows */}
      <path
        d="M35 24 Q38 22 52 22 L62 22 Q70 22 72 25 L68 30 L38 30Z"
        fill="#9CA3AF"
      />
      {/* Wheels */}
      <circle cx="37" cy="43" r="7" fill="#6B7280" />
      <circle cx="37" cy="43" r="3.5" fill="#D1D5DB" />
      <circle cx="83" cy="43" r="7" fill="#6B7280" />
      <circle cx="83" cy="43" r="3.5" fill="#D1D5DB" />
    </svg>
  );
}

export default function VehicleImage({
  make,
  model,
  year,
  vin,
  className = "w-full h-full",
  imgClassName = "w-full h-full object-cover",
  alt,
}: VehicleImageProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  useEffect(() => {
    if (!make && !vin) return;

    setStatus("loading");
    const params = new URLSearchParams();
    if (vin) params.set("vin", vin);
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (year) params.set("year", String(year));

    let cancelled = false;
    fetch(`/api/photos?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const urls: string[] = data.photo_urls ?? [];
        if (urls.length > 0) {
          setPhotoUrl(urls[0]);
          setStatus("loaded");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => { cancelled = true; };
  }, [make, model, year, vin]);

  const altText = alt ?? [year, make, model].filter(Boolean).join(" ") || "Vehicle";

  return (
    <div className={`relative overflow-hidden bg-gray-100 ${className}`}>
      {/* Silhouette placeholder — always rendered, fades out when photo loads */}
      {status !== "loaded" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <CarSilhouette className="w-3/4 h-3/4 opacity-60" />
        </div>
      )}

      {/* Loading shimmer */}
      {status === "loading" && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
      )}

      {/* Actual photo */}
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={altText}
          className={`${imgClassName} transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setStatus("loaded")}
          onError={() => { setPhotoUrl(null); setStatus("error"); }}
        />
      )}
    </div>
  );
}
