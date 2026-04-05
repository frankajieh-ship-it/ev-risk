"use client";

/**
 * Mechanic Profile Page — /mechanics/[slug]
 * Public profile for a single verified mechanic.
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import MechanicProfile from "@/components/mechanic/MechanicProfile";
import type { MechanicProfile as MechanicProfileType, MechanicReview, ServiceType } from "@/types/mechanic";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function MechanicProfilePage() {
  const params = useParams<{ slug: string }>();
  const { trackEvent } = useEventTracking();

  const [mechanic, setMechanic] = useState<MechanicProfileType | null>(null);
  const [reviews, setReviews] = useState<MechanicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.slug) return;

    fetch(`/api/mechanics/${params.slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.mechanic) {
          setMechanic(data.mechanic);
          setReviews(data.reviews ?? []);
          trackEvent("mechanic_profile_viewed", { mechanic_id: data.mechanic.id, slug: params.slug });
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  const handleSubmitRequest = async (data: {
    service_type: ServiceType;
    description: string;
    preferred_date?: string;
    zip: string;
    vehicle: {
      vin?: string;
      year?: number;
      make?: string;
      model?: string;
      auction_result_id?: string;
    };
  }) => {
    try {
      const res = await fetch("/api/services/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mechanic_id: mechanic?.id,
          service_type: data.service_type,
          notes: data.description,
          preferred_date: data.preferred_date,
          zip: data.zip,
          vin: data.vehicle.vin,
          year: data.vehicle.year,
          make: data.vehicle.make,
          model: data.vehicle.model,
          auction_result_id: data.vehicle.auction_result_id,
        }),
      });
      const json = await res.json();
      return { success: res.ok, request_id: json.request_id, error: json.error };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (notFound || !mechanic) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-500 text-lg font-medium mb-2">Mechanic not found</p>
          <p className="text-sm text-gray-400 mb-6">
            This profile may have been removed or is not yet approved.
          </p>
          <Link
            href="/mechanics"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse all mechanics
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link
          href="/mechanics"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All mechanics
        </Link>

        <MechanicProfile
          mechanic={mechanic}
          reviews={reviews}
          onSubmitRequest={handleSubmitRequest}
        />
      </div>
    </div>
  );
}
