"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink, ShieldCheck, AlertTriangle, XCircle, TrendingUp, Bookmark, BookmarkCheck } from "lucide-react";
import { addToAnonGarage } from "@/lib/anon-garage";
import { useAuth } from "@/hooks/useAuth";

export interface CuratedDeal {
  id: string;
  listing_url: string;
  url_domain: string | null;
  vehicle_label: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  location: string | null;
  verdict: "GREEN" | "YELLOW" | "RED" | null;
  evidence_score: number | null;
  fit_score: number | null;
  risk_points: number | null;
  deal_quality_score: number | null;
  risk_flags: string[] | null;
  receipt_id: string | null;
  photo_url: string | null;
  last_analyzed_at: string | null;
}

const VERDICT_CONFIG = {
  GREEN: {
    label: "Good Deal",
    icon: ShieldCheck,
    bg: "bg-[#00d97e]/10",
    border: "border-[#00d97e]/20",
    text: "text-[#00d97e]",
    dot: "bg-[#00d97e]",
  },
  YELLOW: {
    label: "Proceed with Caution",
    icon: AlertTriangle,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  RED: {
    label: "High Risk",
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
    dot: "bg-red-400",
  },
};

const SAVED_DEALS_KEY = "offo_saved_deals";

function isSavedLocally(dealId: string): boolean {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(SAVED_DEALS_KEY) || "[]");
    return saved.includes(dealId);
  } catch { return false; }
}

function saveLocally(dealId: string): void {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(SAVED_DEALS_KEY) || "[]");
    if (!saved.includes(dealId)) {
      localStorage.setItem(SAVED_DEALS_KEY, JSON.stringify([dealId, ...saved]));
    }
  } catch { /* ignore */ }
}

interface DealCardProps {
  deal: CuratedDeal;
  compact?: boolean;
  showDebug?: boolean;
}

export default function DealCard({ deal, compact = false, showDebug = false }: DealCardProps) {
  const vc = deal.verdict ? VERDICT_CONFIG[deal.verdict] : VERDICT_CONFIG.YELLOW;
  const VerdictIcon = vc.icon;
  const { isAuthenticated, session } = useAuth();

  const priceStr = deal.price ? `$${deal.price.toLocaleString()}` : "Price unlisted";
  const mileageStr = deal.mileage ? `${deal.mileage.toLocaleString()} mi` : null;

  // Photo — client-side fetch when DB has no photo_url
  const [photoUrl, setPhotoUrl] = useState<string | null>(deal.photo_url);
  useEffect(() => {
    if (photoUrl || !deal.make) return;
    // Use vehicle_label to extract full model name when deal.model is truncated (e.g. "Model" instead of "Model 3")
    let model = deal.model ?? "";
    if (deal.vehicle_label && deal.make) {
      // Strip "YYYY Make " prefix from vehicle_label to get full model+trim
      const prefix = [deal.year, deal.make].filter(Boolean).join(" ") + " ";
      const fromLabel = deal.vehicle_label.startsWith(prefix)
        ? deal.vehicle_label.slice(prefix.length).trim()
        : null;
      // Use label-derived model if it's longer/more specific than deal.model
      if (fromLabel && fromLabel.length > model.length) model = fromLabel;
    }
    const params = new URLSearchParams({
      make: deal.make,
      ...(model ? { model } : {}),
      ...(deal.year ? { year: String(deal.year) } : {}),
    });
    fetch(`/api/photos?${params}`)
      .then((r) => r.json())
      .then((d: { photo_urls?: string[] }) => { if (d.photo_urls?.[0]) setPhotoUrl(d.photo_urls[0]); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to garage state — lazy initializer reads localStorage once on mount
  const [saved, setSaved] = useState(() => isSavedLocally(deal.id));

  const handleSave = async () => {
    if (saved) return;
    setSaved(true);
    saveLocally(deal.id);

    const label = deal.vehicle_label || [deal.year, deal.make, deal.model].filter(Boolean).join(" ") || "EV Listing";

    // Anonymous: save to anon garage (shows in nav badge + garage page)
    if (!isAuthenticated) {
      addToAnonGarage({
        type: "shortlist",
        label,
        data: {
          deal_id: deal.id,
          listing_url: deal.listing_url,
          receipt_id: deal.receipt_id,
          verdict: deal.verdict,
          price: deal.price,
          mileage: deal.mileage,
          make: deal.make,
          model: deal.model,
          year: deal.year,
        },
      });
      return;
    }

    // Authenticated: save to garage_vehicles
    if (session?.access_token && deal.make && deal.model) {
      fetch("/api/workspace/garage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          make: deal.make,
          model: deal.model,
          year: deal.year,
          trim: deal.trim,
          receipt_id: deal.receipt_id,
          notes: `Saved from OFFO Deals — ${deal.listing_url}`,
        }),
      }).catch(() => {});
    }
  };

  const topFlags = (deal.risk_flags ?? []).slice(0, 2);

  return (
    <div className={`relative flex flex-col bg-[#161b22] border border-white/[0.08] rounded-xl overflow-hidden hover:border-white/[0.16] transition-all group ${compact ? "h-full" : ""}`}>
      {/* Photo */}
      <div className="relative w-full aspect-[16/9] bg-[#0d1117] overflow-hidden flex-shrink-0">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={deal.vehicle_label}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21H5a2 2 0 01-2-2V7l3-4h10l3 4v12a2 2 0 01-2 2zM7 10h10M9 14l2 2 4-4" />
            </svg>
          </div>
        )}

        {/* Verdict badge overlay */}
        <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${vc.bg} ${vc.border} border backdrop-blur-sm`}>
          <span className={`w-1.5 h-1.5 rounded-full ${vc.dot}`} />
          <span className={`text-xs font-semibold ${vc.text}`}>{vc.label}</span>
        </div>

        {/* Domain badge */}
        {deal.url_domain && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
            <span className="text-xs text-white/50">{deal.url_domain}</span>
          </div>
        )}

        {/* Save button — top-right when no domain badge, overlaid on photo */}
        <button
          onClick={handleSave}
          title={saved ? "Saved to Garage" : "Save to Garage"}
          className={`absolute bottom-2.5 right-2.5 flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-sm border transition-all ${
            saved
              ? "bg-[#00d97e]/20 border-[#00d97e]/40 text-[#00d97e]"
              : "bg-black/50 border-white/20 text-white/60 hover:text-white hover:bg-black/70"
          }`}
        >
          {saved
            ? <BookmarkCheck className="w-4 h-4" />
            : <Bookmark className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Vehicle + price */}
        <div>
          <p className="text-sm font-semibold text-white leading-snug">{deal.vehicle_label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-bold text-white">{priceStr}</span>
            {mileageStr && (
              <span className="text-xs text-white/40">· {mileageStr}</span>
            )}
            {deal.location && (
              <span className="text-xs text-white/40 truncate">· {deal.location}</span>
            )}
          </div>
        </div>

        {/* Scores row */}
        <div className="flex items-center gap-3">
          {deal.evidence_score != null && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/50">Evidence</span>
              <span className="text-xs font-semibold text-white/80">{deal.evidence_score}</span>
            </div>
          )}
          {deal.risk_points != null && (
            <div className="flex items-center gap-1.5">
              <VerdictIcon className={`w-3.5 h-3.5 ${vc.text}`} />
              <span className="text-xs text-white/50">Risk</span>
              <span className={`text-xs font-semibold ${vc.text}`}>{deal.risk_points}/10</span>
            </div>
          )}
        </div>

        {/* Risk flags */}
        {topFlags.length > 0 && (
          <div className="flex flex-col gap-1">
            {topFlags.map((flag, i) => (
              <p key={i} className="text-xs text-white/40 flex items-start gap-1.5">
                <span className="text-yellow-500/60 mt-0.5 flex-shrink-0">!</span>
                <span>{flag}</span>
              </p>
            ))}
          </div>
        )}

        {/* Debug strip — internal only */}
        {showDebug && (
          <div className="border-t border-white/[0.06] -mx-4 px-4 pt-2 pb-1 bg-black/30 font-mono text-[10px] text-white/40 space-y-1">
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>fit: <span className="text-white/70">{deal.fit_score ?? "—"}</span></span>
              <span>evidence: <span className="text-white/70">{deal.evidence_score ?? "—"}</span></span>
              <span>quality: <span className="text-white/70">{deal.deal_quality_score ?? "—"}</span></span>
              <span>risk_pts: <span className="text-white/70">{deal.risk_points ?? "—"}</span></span>
              <span>verdict: <span className={deal.verdict === "GREEN" ? "text-[#00d97e]" : deal.verdict === "YELLOW" ? "text-yellow-400" : deal.verdict === "RED" ? "text-red-400" : "text-white/40"}>{deal.verdict ?? "—"}</span></span>
            </div>
            {deal.risk_flags && deal.risk_flags.length > 0 && (
              <div className="text-white/30 line-clamp-2">{deal.risk_flags.join(", ")}</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          {deal.receipt_id ? (
            <Link
              href={`/receipt?id=${deal.receipt_id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-xs font-semibold rounded-lg transition-colors"
            >
              View Full Receipt
            </Link>
          ) : (
            <Link
              href={`/receipt?url=${encodeURIComponent(deal.listing_url)}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 text-xs font-semibold rounded-lg transition-colors"
            >
              Analyze This Listing
            </Link>
          )}
          <a
            href={deal.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/40 rounded-lg transition-colors flex-shrink-0"
            title="View original listing"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
