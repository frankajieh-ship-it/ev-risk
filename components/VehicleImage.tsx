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
      <rect width="120" height="60" rx="4" fill="transparent" />
      {/* Car body */}
      <path
        d="M15 38 Q18 28 32 24 L52 22 Q62 21 72 24 L88 26 Q100 28 105 35 L106 38 Q100 42 85 43 Q70 44 35 43 Q20 42 15 38Z"
        fill="#2a2f38"
      />
      {/* Windows */}
      <path
        d="M35 24 Q38 22 52 22 L62 22 Q70 22 72 25 L68 30 L38 30Z"
        fill="#3a4049"
      />
      {/* Wheels */}
      <circle cx="37" cy="43" r="7" fill="#4b5563" />
      <circle cx="37" cy="43" r="3.5" fill="#2a2f38" />
      <circle cx="83" cy="43" r="7" fill="#4b5563" />
      <circle cx="83" cy="43" r="3.5" fill="#2a2f38" />
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

    setStatus("loading"); // eslint-disable-line react-hooks/set-state-in-effect
    const params = new URLSearchParams();
    if (vin) params.set("vin", vin);
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (year) params.set("year", String(year));

    params.set("no_market", "1"); // never use Auto.dev listing photos for vehicle cards
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

  const altText = alt ?? ([year, make, model].filter(Boolean).join(" ") || "Vehicle");

  // No photo found — show car silhouette so the image slot has a clear affordance
  if (status === "error") return (
    <div className={`relative overflow-hidden bg-[#161b22] flex items-center justify-center ${className}`}>
      <CarSilhouette className="w-2/3 max-w-[160px] opacity-40" />
    </div>
  );

  return (
    <div className={`relative overflow-hidden bg-[#161b22] ${className}`}>
      {/* Shimmer while loading */}
      {status !== "loaded" && (
        <div className="absolute inset-0 bg-[#161b22] animate-pulse" />
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
