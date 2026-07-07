"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ReferralCreditBannerProps {
  onShareClick?: () => void;
}

export default function ReferralCreditBanner({ onShareClick }: ReferralCreditBannerProps) {
  const { session } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    fetch("/api/user/referral-credits", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) setCredits(d.credits ?? 0);
      })
      .catch(() => {});
  }, [session]);

  // Only render for authenticated users who have credits or to prompt sharing
  if (credits === null) return null;

  if (credits > 0) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl bg-[#00d97e]/10 border border-[#00d97e]/25 px-4 py-3">
        <div className="flex items-center gap-3">
          <Gift className="w-4 h-4 text-[#00d97e] shrink-0" />
          <p className="text-sm text-white/80">
            You have <span className="text-[#00d97e] font-semibold">{credits} free receipt credit{credits !== 1 ? "s" : ""}</span> — earned by sharing
          </p>
        </div>
        {onShareClick && (
          <button
            onClick={onShareClick}
            className="text-xs font-semibold text-[#00d97e] hover:text-[#00f090] whitespace-nowrap transition-colors"
          >
            Share to earn more →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
      <div className="flex items-center gap-3">
        <Gift className="w-4 h-4 text-white/40 shrink-0" />
        <p className="text-sm text-white/50">
          Share your receipt with a friend — earn a free receipt credit when they buy
        </p>
      </div>
      {onShareClick && (
        <button
          onClick={onShareClick}
          className="text-xs font-semibold text-white/60 hover:text-white whitespace-nowrap transition-colors"
        >
          Share →
        </button>
      )}
    </div>
  );
}
