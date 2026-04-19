"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink, ShieldCheck, AlertTriangle, XCircle, Bookmark, BookmarkCheck, ChevronDown } from "lucide-react";
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

const EVIDENCE_BADGES = {
  verified: {
    label: "Verified",
    cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    tooltip: "Strong listing documentation — title, service history, or battery report shown.",
  },
  partial: {
    label: "Partial",
    cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    tooltip: "Some documentation present, but key details are missing.",
  },
  limited: {
    label: "Limited",
    cls: "text-white/40 bg-white/[0.05] border-white/10",
    tooltip: "Little or no supporting documentation found in this listing.",
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

function formatLocation(loc: string | null): string | null {
  if (!loc) return null;
  const parts = loc.split(",").map((s) => s.trim());
  if (parts.length >= 2) return `${parts[0]}, ${parts[1].slice(0, 2).toUpperCase()}`;
  return parts[0];
}

function FreshnessLabel({ timestamp }: { timestamp: string }) {
  const diffMs = new Date().getTime() - new Date(timestamp).getTime();
  const h = Math.floor(diffMs / 3600000);
  const d = Math.floor(diffMs / 86400000);
  const label = h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${d}d ago`;
  return <p className="text-[10px] text-white/20">Checked {label}</p>;
}

interface DealCardProps {
  deal: CuratedDeal;
  compact?: boolean;
  preview?: boolean; // minimal card for landing page 5-col grid
  rank?: number;
  totalDeals?: number;
}

export default function DealCard({ deal, compact = false, preview = false, rank, totalDeals }: DealCardProps) {
  const vc = deal.verdict ? VERDICT_CONFIG[deal.verdict] : VERDICT_CONFIG.YELLOW;
  const VerdictIcon = vc.icon;
  const { isAuthenticated, session } = useAuth();

  const priceStr = deal.price ? `$${deal.price.toLocaleString()}` : "Price unlisted";
  const mileageStr = deal.mileage ? `${deal.mileage.toLocaleString()} mi` : null;

  // Photo — client-side fetch when DB has no photo_url
  // rank-based delay staggers concurrent requests so mobile doesn't drop them
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
    const delay = (rank ?? 1) * 200; // stagger: card 1 = 200ms, card 2 = 400ms, etc.
    const t = setTimeout(() => {
      fetch(`/api/photos?${params}`)
        .then((r) => r.json())
        .then((d: { photo_urls?: string[] }) => { if (d.photo_urls?.[0]) setPhotoUrl(d.photo_urls[0]); })
        .catch(() => {});
    }, delay);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to garage state
  const [saved, setSaved] = useState(() => isSavedLocally(deal.id));

  // Verdict expand state
  const [expandedVerdict, setExpandedVerdict] = useState(false);

  // Login modal (shown after anon save)
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const handleSave = async () => {
    if (saved) return;
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
          verdict: deal.verdict,
          price: deal.price,
          mileage: deal.mileage,
          make: deal.make,
          model: deal.model,
          year: deal.year,
        },
      });
      // Prompt guest to sign in so their saved item persists
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

  const topFlags = (deal.risk_flags ?? []).slice(0, 2);

  // Evidence badge config
  const es = deal.evidence_score;
  const evidenceBadge =
    es == null || es < 40 ? EVIDENCE_BADGES.limited
    : es < 65 ? EVIDENCE_BADGES.partial
    : EVIDENCE_BADGES.verified;

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
          <Image
            src={photoUrl}
            alt={deal.vehicle_label}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={rank === 1}
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

        {/* Verdict badge — clickable to expand breakdown */}
        <button
          onClick={() => setExpandedVerdict((v) => !v)}
          className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full ${vc.bg} ${vc.border} border backdrop-blur-sm transition-opacity hover:opacity-80`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${vc.dot}`} />
          <span className={`text-xs font-semibold ${vc.text}`}>{vc.label}</span>
          <ChevronDown className={`w-3 h-3 ${vc.text} transition-transform ${expandedVerdict ? "rotate-180" : ""}`} />
        </button>

        {/* Rank badge or domain badge */}
        {rank && totalDeals ? (
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
          <Link href={`/deals/${deal.id}`} className={`font-semibold text-white leading-snug hover:text-white/80 transition-colors ${preview ? "text-[11px]" : compact ? "text-xs" : "text-sm"}`}>
            {deal.vehicle_label}
          </Link>
          {!preview && deal.verdict === "YELLOW" && deal.risk_flags?.[0] && (
            <p className="text-[10px] text-white/35 italic mt-0.5 line-clamp-1">{deal.risk_flags[0]}</p>
          )}
          <div className={`flex items-center flex-wrap gap-x-2 mt-0.5 ${preview ? "gap-y-0" : "gap-y-0.5"}`}>
            <span className={`font-bold text-white ${preview ? "text-sm" : compact ? "text-base" : "text-lg"}`}>{priceStr}</span>
            {mileageStr && (
              <span className="text-xs text-white/40">· {mileageStr}</span>
            )}
          </div>
        </div>

        {/* Verdict expand panel — not shown in preview */}
        {!preview && expandedVerdict && (
          <div className={`rounded-lg border p-3 text-xs space-y-1.5 ${vc.bg} ${vc.border}`}>
            {deal.verdict === "GREEN" || !topFlags.length ? (
              <p className="text-[#00d97e]/70">No major risk flags detected.</p>
            ) : (
              topFlags.map((f, i) => (
                <p key={i} className="text-white/50 flex gap-1.5">
                  <span className={`${vc.text} flex-shrink-0`}>›</span>
                  {f}
                </p>
              ))
            )}
          </div>
        )}

        {/* Scores row — not shown in preview */}
        {!preview && (
          <div className="flex items-center gap-2">
            <div className="relative group/ev">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-help ${evidenceBadge.cls}`}>
                {evidenceBadge.label}
              </span>
              <div className="absolute bottom-full left-0 mb-1.5 w-52 p-2 rounded-lg bg-[#1c2128] border border-white/10 text-[10px] text-white/50 leading-relaxed opacity-0 group-hover/ev:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                {evidenceBadge.tooltip}
              </div>
            </div>
            {deal.risk_points != null && (
              <div className="flex items-center gap-1.5">
                <VerdictIcon className={`w-3.5 h-3.5 ${vc.text}`} />
                <span className="text-xs text-white/50">Risk</span>
                <span className={`text-xs font-semibold ${vc.text}`}>{deal.risk_points}/10</span>
              </div>
            )}
          </div>
        )}

        {/* Risk flags — not shown in preview */}
        {!preview && topFlags.length > 0 && !expandedVerdict && (
          <div className="flex flex-col gap-1">
            {topFlags.map((flag, i) => (
              <p key={i} className="text-xs text-white/40 flex items-start gap-1.5">
                <span className="text-yellow-500/60 mt-0.5 flex-shrink-0">!</span>
                <span>{flag}</span>
              </p>
            ))}
          </div>
        )}

        {/* Freshness — not shown in preview */}
        {!preview && deal.last_analyzed_at && (
          <FreshnessLabel timestamp={deal.last_analyzed_at} />
        )}


        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          {deal.receipt_id ? (
            <Link
              href={`/receipt?id=${deal.receipt_id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00d97e]/10 hover:bg-[#00d97e]/20 border border-[#00d97e]/20 text-[#00d97e] text-xs font-semibold rounded-lg transition-colors"
            >
              {preview ? "View Receipt" : "View Full Receipt"}
            </Link>
          ) : (
            <Link
              href={`/receipt?url=${encodeURIComponent(deal.listing_url)}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-white/70 text-xs font-semibold rounded-lg transition-colors"
            >
              {preview ? "Analyze" : "Analyze This Listing"}
            </Link>
          )}
          {!preview && (
            <a
              href={deal.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/40 rounded-lg transition-colors flex-shrink-0"
              title="View original listing"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
