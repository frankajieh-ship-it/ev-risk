"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, Wrench, CalendarDays, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui";
import MechanicRatingStars from "./MechanicRatingStars";
import type { ServiceQuote } from "@/types/mechanic";

interface QuoteCardProps {
  quote: ServiceQuote;
  onAccept?: (quoteId: string) => Promise<void>;
  onDecline?: (quoteId: string) => void;
  isSelected?: boolean;
  readOnly?: boolean;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
}

function formatAvailableDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_CONFIG: Record<ServiceQuote["status"], { label: string; variant: "success" | "danger" | "neutral" | "warning" }> = {
  pending:  { label: "Awaiting response", variant: "warning" },
  accepted: { label: "Accepted",          variant: "success"  },
  declined: { label: "Declined",          variant: "danger"   },
  expired:  { label: "Expired",           variant: "neutral"  },
};

export default function QuoteCard({
  quote,
  onAccept,
  onDecline,
  isSelected = false,
  readOnly = false,
}: QuoteCardProps) {
  const [accepting, setAccepting] = useState(false);
  const mechanic = quote.mechanic;
  const isExpired = new Date(quote.expires_at) < new Date();
  const effectiveStatus: ServiceQuote["status"] = isExpired && quote.status === "pending" ? "expired" : quote.status;
  const statusCfg = STATUS_CONFIG[effectiveStatus];
  const canAct = !readOnly && effectiveStatus === "pending" && !!onAccept;

  const handleAccept = async () => {
    if (!onAccept) return;
    setAccepting(true);
    try {
      await onAccept(quote.id);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className={`card-base bg-white transition-all ${isSelected ? "ring-2 ring-blue-600 shadow-raised" : ""}`}>
      <div className="p-5">
        {/* Header: mechanic info + status badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {mechanic?.photo_url ? (
              <Image
                src={mechanic.photo_url}
                alt={mechanic.business_name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-4 h-4 text-orange-600" />
              </div>
            )}
            <div>
              {mechanic ? (
                <Link
                  href={`/mechanics/${mechanic.slug}`}
                  className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                >
                  {mechanic.business_name}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-gray-900">Mechanic</p>
              )}
              {mechanic && (
                <MechanicRatingStars
                  rating={mechanic.avg_rating ?? 0}
                  reviewCount={mechanic.review_count}
                  size="sm"
                />
              )}
            </div>
          </div>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>

        {/* Price + expiry */}
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Quoted price</p>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(quote.price_cents)}</p>
          </div>
          <div className="text-right">
            {quote.available_date && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1 justify-end">
                <CalendarDays className="w-3.5 h-3.5" />
                Available {formatAvailableDate(quote.available_date)}
              </div>
            )}
            {effectiveStatus === "pending" && (
              <div className={`flex items-center gap-1.5 text-xs justify-end ${isExpired ? "text-red-500" : "text-gray-400"}`}>
                <Clock className="w-3.5 h-3.5" />
                {formatExpiry(quote.expires_at)}
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 leading-relaxed">
            {quote.notes}
          </div>
        )}

        {/* Expiry warning */}
        {effectiveStatus === "pending" && !isExpired && (() => {
          const hoursLeft = Math.floor((new Date(quote.expires_at).getTime() - Date.now()) / 3_600_000);
          return hoursLeft < 12 ? (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Quote expires soon — respond before it lapses
            </div>
          ) : null;
        })()}

        {/* Actions */}
        {canAct && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="flex-1 btn-md btn-success flex items-center justify-center gap-2"
            >
              {accepting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {accepting ? "Accepting…" : "Accept quote"}
            </button>
            {onDecline && (
              <button
                onClick={() => onDecline(quote.id)}
                disabled={accepting}
                className="btn-md btn-ghost flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
            )}
          </div>
        )}

        {isSelected && (
          <div className="flex items-center gap-2 text-sm text-blue-700 font-medium pt-1">
            <CheckCircle className="w-4 h-4" />
            You accepted this quote
          </div>
        )}
      </div>
    </div>
  );
}
