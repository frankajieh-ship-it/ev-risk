"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Check, ShieldCheck } from "lucide-react";

function CopyBlock({ label, code, description }: { label: string; code: string; description: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#00d97e]" />
          <p className="text-sm font-semibold text-white">{label}</p>
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
        {code}
      </pre>
      <p className="text-xs text-white/30 mt-3">{description}</p>
    </div>
  );
}

export default function DealerBadgePage() {
  const { session } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

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

  // Deep-link code: badge links to receipt page pre-filled with the listing URL
  const deepLinkCode = badgeUrl
    ? `<a href="${siteUrl}/receipt?listing_url=[LISTING_URL_HERE]" target="_blank" rel="noopener">\n  <img src="${badgeUrl}" alt="OFFO Verified Dealer" width="200" height="52" />\n</a>`
    : null;

  // Static code: badge links to the dealer profile (for email signatures, about pages)
  const staticCode = badgeUrl && profileUrl
    ? `<a href="${profileUrl}" target="_blank" rel="noopener">\n  <img src="${badgeUrl}" alt="OFFO Verified Dealer" width="200" height="52" />\n</a>`
    : null;

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

      {/* Embed codes */}
      {isVerified && deepLinkCode && staticCode && (
        <div className="space-y-4">
          {/* Deep-link badge — primary recommendation */}
          <div>
            <p className="text-xs font-semibold text-[#00d97e] uppercase tracking-wider mb-2">Recommended — Per-listing badge</p>
            <p className="text-xs text-white/40 mb-3">
              Replace <code className="text-white/60 bg-white/[0.06] px-1 rounded">[LISTING_URL_HERE]</code> with the URL of each specific vehicle listing.
              When a buyer clicks the badge, they land on the OFFO receipt page with that listing pre-loaded and ready to analyze.
              <br /><br />
              For dynamic embedding (e.g. via your CMS or JavaScript), URL-encode the listing URL and append it as the <code className="text-white/60 bg-white/[0.06] px-1 rounded">listing_url</code> param.
            </p>
            <CopyBlock
              label="Per-listing badge"
              code={deepLinkCode}
              description="Paste this in your vehicle listing template. Replace [LISTING_URL_HERE] with the encoded listing URL for each vehicle."
            />
          </div>

          {/* Static badge — for profile/signature use */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Static badge — profile &amp; email signature</p>
            <CopyBlock
              label="Static badge"
              code={staticCode}
              description="Links to your OFFO dealer profile. Use this in email signatures, about pages, or anywhere not tied to a specific listing."
            />
          </div>
        </div>
      )}
    </div>
  );
}
