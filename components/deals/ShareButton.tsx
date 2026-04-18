"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function ShareButton({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: label, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center justify-center gap-2 py-3 px-5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white/50 text-sm font-semibold rounded-xl transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-[#00d97e]" />
          <span className="text-[#00d97e]">Copied!</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          Share
        </>
      )}
    </button>
  );
}
