"use client";

import { useState } from "react";
import Image from "next/image";
import {
  MapPin, Phone, Globe, CheckCircle, Wrench, Star,
  ChevronDown, ChevronUp, ArrowRight, Shield,
} from "lucide-react";
import { Badge } from "@/components/ui";
import { EmptyState } from "@/components/ui";
import MechanicRatingStars from "./MechanicRatingStars";
import ReviewCard from "./ReviewCard";
import ServiceRequestForm from "./ServiceRequestForm";
import type { MechanicProfile as MechanicProfileType, MechanicReview, ServiceType } from "@/types/mechanic";
import { SERVICE_TYPE_LABELS } from "@/types/mechanic";

interface ServiceRequestData {
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
}

interface MechanicProfileProps {
  mechanic: MechanicProfileType;
  reviews: MechanicReview[];
  defaultServiceType?: ServiceType;
  prefillVehicle?: {
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    auction_result_id?: string;
  };
  onSubmitRequest: (data: ServiceRequestData) => Promise<{ success: boolean; request_id?: string; error?: string }>;
}

export default function MechanicProfile({
  mechanic,
  reviews,
  defaultServiceType,
  prefillVehicle,
  onSubmitRequest,
}: MechanicProfileProps) {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3);
  const hasMoreReviews = reviews.length > 3;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Cover + avatar header */}
      <div className="card-base overflow-hidden bg-white">
        {/* Cover photo */}
        <div className="h-28 bg-gradient-to-r from-orange-500 to-amber-400 relative">
          {mechanic.cover_photo_url && (
            <Image
              src={mechanic.cover_photo_url}
              alt=""
              fill
              className="object-cover"
            />
          )}
        </div>

        {/* Avatar + name row */}
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-7 mb-3">
            <div className="relative">
              {mechanic.photo_url ? (
                <Image
                  src={mechanic.photo_url}
                  alt={mechanic.business_name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-white"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-orange-100 ring-4 ring-white flex items-center justify-center">
                  <Wrench className="w-7 h-7 text-orange-600" />
                </div>
              )}
              {mechanic.is_verified && (
                <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                  <CheckCircle className="w-4 h-4 text-blue-600" fill="currentColor" />
                </div>
              )}
            </div>
            {mechanic.accepts_new_clients && (
              <button
                onClick={() => setShowRequestForm(true)}
                className="btn-md btn-auction flex items-center gap-2"
              >
                Request service
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{mechanic.business_name}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-sm text-gray-500">
                  {mechanic.city}, {mechanic.state} · serves {mechanic.service_radius_miles} mi radius
                </span>
              </div>
            </div>
            {mechanic.is_featured && (
              <Badge variant="auction">Featured</Badge>
            )}
          </div>

          {/* Rating summary */}
          <div className="mt-3">
            <MechanicRatingStars
              rating={mechanic.avg_rating ?? 0}
              reviewCount={mechanic.review_count}
              size="md"
            />
          </div>

          {/* Bio */}
          {mechanic.bio && (
            <p className="text-sm text-gray-600 leading-relaxed mt-3">{mechanic.bio}</p>
          )}

          {/* Contact strip */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
            {mechanic.phone && (
              <a
                href={`tel:${mechanic.phone}`}
                className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {mechanic.phone}
              </a>
            )}
            {mechanic.website && (
              <a
                href={mechanic.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Avg rating",   value: mechanic.avg_rating ? mechanic.avg_rating.toFixed(1) : "—", icon: Star },
          { label: "Reviews",      value: mechanic.review_count.toString(),                            icon: CheckCircle },
          { label: "Response rate",value: `${Math.round(mechanic.response_rate * 100)}%`,              icon: Shield },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card-flat bg-white p-4 text-center">
            <Icon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Specialties */}
      <div className="card-base bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-gray-400" />
          Services offered
        </h2>
        <div className="flex flex-wrap gap-2">
          {mechanic.specialties.map((s) => (
            <Badge key={s} variant="neutral" size="md">
              {SERVICE_TYPE_LABELS[s]}
            </Badge>
          ))}
        </div>

        {/* Service catalog */}
        {mechanic.services && mechanic.services.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            {mechanic.services
              .map((svc) => (
                <div key={svc.id} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                    {svc.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{svc.description}</p>
                    )}
                    {svc.duration_hours && (
                      <p className="text-xs text-gray-400 mt-0.5">~{svc.duration_hours}h</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {svc.price_cents ? (
                      <p className="text-sm font-semibold text-gray-900">
                        {svc.price_type === "starting_at" ? "From " : ""}
                        ${(svc.price_cents / 100).toLocaleString()}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">Get a quote</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Certifications */}
      {mechanic.certifications.length > 0 && (
        <div className="card-base bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            Certifications
          </h2>
          <div className="flex flex-wrap gap-2">
            {mechanic.certifications.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="card-base bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Star className="w-4 h-4 text-gray-400" />
          Reviews
          {reviews.length > 0 && (
            <span className="text-gray-400 font-normal">({reviews.length})</span>
          )}
        </h2>

        {reviews.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="Reviews appear after completed service requests."
            className="py-6"
          />
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {visibleReviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
            {hasMoreReviews && (
              <button
                onClick={() => setShowAllReviews((v) => !v)}
                className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showAllReviews ? (
                  <><ChevronUp className="w-4 h-4" />Show fewer</>
                ) : (
                  <><ChevronDown className="w-4 h-4" />Show all {reviews.length} reviews</>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Floating request form modal */}
      {showRequestForm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRequestForm(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">Request service</h2>
              <button
                onClick={() => setShowRequestForm(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <ServiceRequestForm
              vehicle={prefillVehicle}
              defaultServiceType={defaultServiceType}
              onSubmit={onSubmitRequest}
              onClose={() => setShowRequestForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
