"use client";

import Link from "next/link";
import Image from "next/image";
import { MapPin, CheckCircle, ArrowRight, Wrench, Clock } from "lucide-react";
import { Badge } from "@/components/ui";
import MechanicRatingStars from "./MechanicRatingStars";
import type { MechanicProfile, ServiceType } from "@/types/mechanic";
import { SERVICE_TYPE_LABELS } from "@/types/mechanic";

interface MechanicCardProps {
  mechanic: MechanicProfile;
  highlightService?: ServiceType;
  onRequestClick?: (mechanic: MechanicProfile) => void;
  compact?: boolean;
}

function formatDistance(miles?: number): string {
  if (miles === undefined) return "";
  if (miles < 1) return "< 1 mi";
  return `${Math.round(miles)} mi`;
}

function formatResponseRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export default function MechanicCard({
  mechanic,
  highlightService,
  onRequestClick,
  compact = false,
}: MechanicCardProps) {
  const displaySpecialties = highlightService
    ? [highlightService, ...mechanic.specialties.filter((s) => s !== highlightService)].slice(0, 3)
    : mechanic.specialties.slice(0, 3);

  const hasMoreSpecialties = mechanic.specialties.length > 3;

  return (
    <div className="card-base bg-white group">
      <div className={compact ? "p-4" : "p-5"}>
        {/* Header: avatar + name + location */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative flex-shrink-0">
            {mechanic.photo_url ? (
              <Image
                src={mechanic.photo_url}
                alt={mechanic.business_name}
                width={compact ? 40 : 48}
                height={compact ? 40 : 48}
                className={`rounded-full object-cover ${compact ? "w-10 h-10" : "w-12 h-12"}`}
              />
            ) : (
              <div className={`rounded-full bg-orange-100 flex items-center justify-center ${compact ? "w-10 h-10" : "w-12 h-12"}`}>
                <Wrench className={`text-orange-600 ${compact ? "w-4 h-4" : "w-5 h-5"}`} />
              </div>
            )}
            {mechanic.is_verified && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                <CheckCircle className="w-3.5 h-3.5 text-blue-600" fill="currentColor" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className={`font-semibold text-gray-900 truncate leading-tight ${compact ? "text-sm" : "text-base"}`}>
                  {mechanic.business_name}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500">
                    {mechanic.city}, {mechanic.state}
                    {mechanic.distance_miles !== undefined && (
                      <span className="text-gray-400"> · {formatDistance(mechanic.distance_miles)}</span>
                    )}
                  </span>
                </div>
              </div>
              {mechanic.is_featured && (
                <Badge variant="auction" className="flex-shrink-0">Featured</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Rating row */}
        <div className="flex items-center gap-3 mb-3">
          <MechanicRatingStars
            rating={mechanic.avg_rating ?? 0}
            reviewCount={mechanic.review_count}
            size="sm"
          />
          {mechanic.response_rate > 0 && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatResponseRate(mechanic.response_rate)} response
            </span>
          )}
        </div>

        {/* Specialties */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {displaySpecialties.map((s) => (
            <Badge
              key={s}
              variant={s === highlightService ? "auction" : "neutral"}
              size="sm"
            >
              {SERVICE_TYPE_LABELS[s]}
            </Badge>
          ))}
          {hasMoreSpecialties && (
            <Badge variant="neutral" size="sm">
              +{mechanic.specialties.length - 3} more
            </Badge>
          )}
        </div>

        {/* Certifications strip */}
        {!compact && mechanic.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {mechanic.certifications.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={`/mechanics/${mechanic.slug}`}
            className="flex-1 btn-sm btn-ghost text-center"
          >
            View profile
          </Link>
          {mechanic.accepts_new_clients && (
            <button
              onClick={() => onRequestClick?.(mechanic)}
              className="flex-1 btn-sm btn-auction flex items-center justify-center gap-1.5"
            >
              Request service
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {!mechanic.accepts_new_clients && (
            <span className="flex-1 text-center text-xs text-gray-400 self-center">
              Not taking new clients
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
