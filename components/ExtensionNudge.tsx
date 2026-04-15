/**
 * ExtensionNudge — dismissible banner promoting the OFFO Chrome extension
 *
 * Shows after receipt generation and after vehicle fit list is displayed.
 * Dismissed state stored in localStorage so it doesn't reappear.
 */

"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";

const DISMISSED_KEY = "offo_extension_nudge_dismissed";

interface ExtensionNudgeProps {
  /** Which context is showing the nudge — affects copy */
  context?: "receipt" | "fits";
}

export default function ExtensionNudge({ context = "receipt" }: ExtensionNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(DISMISSED_KEY)) setVisible(true);
    } catch {
       
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
  };

  if (!visible) return null;

  const extensionUrl = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";

  const headline =
    context === "fits"
      ? "Get instant verdicts while browsing CarGurus"
      : "Skip the copy-paste — analyse listings directly on CarGurus";

  const body =
    context === "fits"
      ? "The free OFFO extension overlays a deal score on every EV listing as you browse."
      : "The free OFFO extension analyses any EV listing the moment you open it — no URL copying needed.";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        {/* Extension icon */}
        <div className="shrink-0 w-9 h-9 rounded-xl bg-[#00d97e]/[0.15] flex items-center justify-center mt-0.5">
          <svg className="w-5 h-5 text-[#00d97e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1V7m0 4v4m-4 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4a2 2 0 00-2 2v9a2 2 0 002 2z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/80 leading-snug">{headline}</p>
          <p className="text-xs text-white/50 mt-0.5 leading-snug">{body}</p>
          <a
            href={extensionUrl}
            target={extensionUrl.startsWith("http") ? "_blank" : undefined}
            rel={extensionUrl.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#0d1117] bg-[#00d97e] hover:bg-[#00c970] px-3 py-1.5 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Add to Chrome — it&apos;s free
          </a>
        </div>

        <button
          onClick={dismiss}
          className="shrink-0 p-1 text-white/30 hover:text-white/60 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Visual mock — what the extension overlay looks like on a listing */}
      <div className="mx-4 mb-4 rounded-xl border border-white/[0.10] bg-[#161b22] overflow-hidden">
        <div className="bg-white/[0.05] px-3 py-1.5 flex items-center gap-2 border-b border-white/[0.08]">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white/[0.08] rounded text-xs text-white/40 px-2 py-0.5 text-center">
            cargurus.com/Cars/new/nl/…
          </div>
          <div className="w-5 h-5 rounded bg-[#00d97e]/[0.20] border border-[#00d97e]/30 flex items-center justify-center">
            <svg className="w-3 h-3 text-[#00d97e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        {/* Mock listing card with OFFO overlay badge */}
        <div className="p-3 flex gap-3">
          <div className="w-20 h-14 rounded-lg bg-white/[0.08] flex-shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.10] to-white/[0.04]" />
            {/* Simulated car silhouette */}
            <div className="absolute bottom-1 left-1 right-1 h-5 bg-white/20 rounded-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-white">2021 Tesla Model 3</p>
                <p className="text-xs text-white/50">42,500 mi · Long Range · $28,900</p>
              </div>
              {/* OFFO overlay badge */}
              <div className="flex-shrink-0 flex items-center gap-1 bg-[#00d97e]/[0.12] border border-[#00d97e]/30 rounded-full px-2 py-0.5">
                <CheckCircle className="w-3 h-3 text-[#00d97e]" />
                <span className="text-xs font-bold text-[#00d97e]">GREEN</span>
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex items-center gap-1 bg-blue-500/[0.12] rounded px-1.5 py-0.5">
                <span className="text-xs text-blue-400 font-medium">Fair price</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-white/60">1 watch item</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-[#00d97e]/70 pb-2">OFFO verdict overlaid automatically ↑</p>
      </div>
    </div>
  );
}
