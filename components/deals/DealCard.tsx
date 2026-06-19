"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, ExternalLink, ShieldCheck } from "lucide-react";
import { addToAnonGarage } from "@/lib/anon-garage";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "@/components/auth/LoginModal";

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
  receipt_id: string | null;
  photo_url: string | null;
  last_analyzed_at: string | null;
  vin: string | null;
  dealership_id?: string | null;
  dealership_name?: string | null;
  dealership_slug?: string | null;
}

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

function removeLocally(dealId: string): void {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(SAVED_DEALS_KEY) || "[]");
    localStorage.setItem(SAVED_DEALS_KEY, JSON.stringify(saved.filter((id) => id !== dealId)));
  } catch { /* ignore */ }
}

function FreshnessLabel({ timestamp }: { timestamp: string }) {
  const diffMs = new Date().getTime() - new Date(timestamp).getTime();
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  const label = h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${d}d ago`;
  return <p className="text-[10px] text-white/20">Listed {label}</p>;
}

interface DealCardProps {
  deal: CuratedDeal;
  compact?: boolean;
  preview?: boolean;
  rank?: number;
  totalDeals?: number;
  onAnalyzeClick?: () => void;
}

export default function DealCard({ deal, compact = false, preview = false, rank, totalDeals, onAnalyzeClick }: DealCardProps) {
  const { isAuthenticated, session } = useAuth();

  const priceStr = deal.price ? `$${deal.price.toLocaleString()}` : "Price unlisted";
  const mileageStr = deal.mileage ? `${deal.mileage.toLocaleString()} mi` : null;

  // Photo — client-side fetch when DB has no photo_url
  const [photoUrl, setPhotoUrl] = useState<string | null>(deal.photo_url);
  useEffect(() => {
    if (photoUrl || !deal.make) return;
    let model = deal.model ?? "";
    if (deal.vehicle_label && deal.make) {
      const prefix = [deal.year, deal.make].filter(Boolean).join(" ") + " ";
      const fromLabel = deal.vehicle_label.startsWith(prefix)
        ? deal.vehicle_label.slice(prefix.length).trim()
        : null;
      if (fromLabel && fromLabel.length > model.length) model = fromLabel;
    }
    const params = new URLSearchParams({
      make: deal.make,
      ...(model ? { model } : {}),
      ...(deal.year ? { year: String(deal.year) } : {}),
    });
    const delay = Math.min((rank ?? 1) * 100, 1500);
    const t = setTimeout(() => {
      fetch(`/api/photos?${params}&no_market=1`)
        .then((r) => r.json())
        .then((d: { photo_urls?: string[] }) => {
          const url = d.photo_urls?.[0];
          if (url) {
            setPhotoUrl(url);
            fetch("/api/deals/backfill-photo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: deal.id, photo_url: url }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }, delay);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [saved, setSaved] = useState(() => isSavedLocally(deal.id));
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);

  const handleReportSold = async () => {
    if (reported || reporting) return;
    setReporting(true);
    try {
      await fetch(`/api/deals/${deal.id}/report-sold`, { method: "POST" });
      setReported(true);
    } finally {
      setReporting(false);
    }
  };

  const handleSave = async () => {
    if (saved) {
      setSaved(false);
      removeLocally(deal.id);
      return;
    }
    setSaved(true);
    saveLocally(deal.id);

    const label = deal.vehicle_label || [deal.year, deal.make, deal.model].filter(Boolean).join(" ") || "EV Listing";

    if (!isAuthenticated) {
      addToAnonGarage({
        type: "shortlist",
        label,
        data: {
          deal_id: deal.id,
          listing_url: deal.listing_url,
          receipt_id: deal.receipt_id,
          price: deal.price,
          mileage: deal.mileage,
          make: deal.make,
          model: deal.model,
          year: deal.year,
        },
      });
      setLoginModalOpen(true);
      return;
    }

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

  return (
    <>
    <LoginModal
      key={loginModalOpen ? 1 : 0}
      open={loginModalOpen}
      onClose={() => setLoginModalOpen(false)}
      redirectAfter="/workspace/garage"
      headline="Saved! Sign in to keep it permanently"
      subtext="Your garage is saved locally. Create a free account to sync across devices."
    />
    <div className={`relative flex flex-col bg-[#161b22] border border-white/[0.08] rounded-xl overflow-hidden hover:border-white/[0.16] transition-all group ${compact ? "h-full" : ""}`}>
      {/* Photo */}
      <div className="relative w-full aspect-[16/9] bg-[#0d1117] overflow-hidden flex-shrink-0">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/img?url=${encodeURIComponent(photoUrl)}`}
            alt={deal.vehicle_label}
            className="absolute inset-0 w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
            loading={rank === 1 ? "eager" : "lazy"}
            onError={() => setPhotoUrl(null)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#0d1117]">
            <span className="text-3xl font-bold text-white/10 tracking-tight">
              {deal.make?.slice(0, 2).toUpperCase() ?? "EV"}
            </span>
            <span className="text-[10px] text-white/20 uppercase tracking-widest">
              {deal.make ?? "Electric Vehicle"}
            </span>
          </div>
        )}

        {/* Verified dealer badge / rank badge / domain badge */}
        {deal.dealership_name ? (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00d97e]/20 border border-[#00d97e]/30 backdrop-blur-sm">
            <ShieldCheck className="w-3 h-3 text-[#00d97e] flex-shrink-0" />
            <span className="text-[10px] font-semibold text-[#00d97e] truncate max-w-[90px]">
              {deal.dealership_name}
            </span>
          </div>
        ) : rank && totalDeals ? (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
            <span className="text-xs text-white/50">#{rank} of {totalDeals}</span>
          </div>
        ) : deal.url_domain ? (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
            <span className="text-xs text-white/50">{deal.url_domain}</span>
          </div>
        ) : null}

        {/* Save button */}
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
      <div className={`flex flex-col flex-1 ${preview ? "gap-2 p-2.5" : compact ? "gap-3 p-3" : "gap-3 p-4"}`}>
        {/* Vehicle + price */}
        <div>
          <a href={deal.listing_url} target="_blank" rel="noopener noreferrer" className={`font-semibold text-white leading-snug hover:text-white/80 transition-colors ${preview ? "text-[11px]" : compact ? "text-xs" : "text-sm"}`}>
            {deal.vehicle_label}
          </a>
          <div className={`flex items-center flex-wrap gap-x-2 mt-0.5 ${preview ? "gap-y-0" : "gap-y-0.5"}`}>
            <span className={`font-bold text-white ${preview ? "text-sm" : compact ? "text-base" : "text-lg"}`}>{priceStr}</span>
            {mileageStr && (
              <span className="text-xs text-white/40">· {mileageStr}</span>
            )}
          </div>
        </div>

        {/* Freshness — not shown in preview */}
        {!preview && deal.last_analyzed_at && (
          <FreshnessLabel timestamp={deal.last_analyzed_at} />
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <Link
            href={`/receipt?url=${encodeURIComponent(deal.listing_url)}${deal.vin ? `&vin=${encodeURIComponent(deal.vin)}` : ""}&src=deal_watch`}
            onClick={onAnalyzeClick}
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e]"
          >
            Run Analysis
          </Link>
          <a
            href={deal.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-colors bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/50"
          >
            <ExternalLink className="w-3 h-3" />
            {deal.dealership_name ? `View at ${deal.dealership_name}` : `View on ${deal.url_domain ?? "listing"}`}
          </a>
          <button
            onClick={handleReportSold}
            disabled={reported || reporting}
            className="text-[11px] text-white/20 hover:text-white/40 transition-colors text-center py-0.5 disabled:cursor-default"
          >
            {reported ? "Thanks — we'll review it" : reporting ? "Reporting..." : "Flag as sold"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
