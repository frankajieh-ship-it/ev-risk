"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Check, ShieldCheck } from "lucide-react";

export default function DealerBadgePage() {
  const { session } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [copied, setCopied] = useState(false);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://offolab.com";

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/dealer/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setSlug(data.dealership?.slug ?? null);
        setIsVerified(data.dealership?.is_verified ?? false);
      })
      .catch(() => {});
  }, [session?.access_token]);

  const badgeUrl = slug ? `${siteUrl}/api/dealer/badge/${slug}` : null;
  const profileUrl = slug ? `${siteUrl}/dealers/${slug}` : null;

  const embedCode = badgeUrl && profileUrl
    ? `<a href="${profileUrl}" target="_blank" rel="noopener">\n  <img src="${badgeUrl}" alt="OFFO Verified Dealer" width="200" height="52" />\n</a>`
    : null;

  const handleCopy = () => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">OFFO Verified Badge</h1>
        <p className="text-sm text-white/50">
          Display this badge on your listings and website to show buyers your dealership is verified by OFFO.
        </p>
      </div>

      {!isVerified && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 mb-6">
          <p className="text-sm text-amber-400 font-medium mb-0.5">Verification pending</p>
          <p className="text-xs text-white/50">
            Your dealership needs to be verified before you can use the badge. Our team reviews applications within 1 business day.
          </p>
        </div>
      )}

      {/* Live preview */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 mb-6">
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Preview</p>
        {badgeUrl ? (
          <img
            src={badgeUrl}
            alt="OFFO Verified Dealer badge"
            width={200}
            height={52}
            className={isVerified ? "" : "opacity-40"}
          />
        ) : (
          <div className="h-[52px] w-[200px] rounded-lg bg-white/[0.05] animate-pulse" />
        )}
      </div>

      {/* Embed code */}
      {isVerified && embedCode && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00d97e]" />
              <p className="text-sm font-semibold text-white">Embed code</p>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white/80 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00d97e]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="text-xs text-white/60 bg-[#0d1117] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">
            {embedCode}
          </pre>
          <p className="text-xs text-white/30 mt-3">
            Paste this on your dealership website, listings, or email signature. The badge links back to your OFFO dealer profile.
          </p>
        </div>
      )}
    </div>
  );
}
