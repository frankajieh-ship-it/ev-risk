/**
 * ExtensionNudge — dismissible banner promoting the OFFO Chrome extension
 *
 * Shows after receipt generation and after vehicle fit list is displayed.
 * Dismissed state stored in localStorage so it doesn't reappear.
 */

"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "offo_extension_nudge_dismissed";

interface ExtensionNudgeProps {
  /** Which context is showing the nudge — affects copy */
  context?: "receipt" | "fits";
}

export default function ExtensionNudge({ context = "receipt" }: ExtensionNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
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
      : "Next time, get your verdict without leaving CarGurus";

  const body =
    context === "fits"
      ? "The free OFFO extension overlays a deal score on every EV listing — no copy-pasting needed."
      : "The free OFFO extension auto-analyses any EV listing on CarGurus the moment you open it.";

  return (
    <div className="relative rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3.5 flex items-start gap-3">
      {/* Extension icon */}
      <div className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center mt-0.5">
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1V7m0 4v4m-4 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4a2 2 0 00-2 2v9a2 2 0 002 2z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-900 leading-snug">{headline}</p>
        <p className="text-xs text-indigo-700 mt-0.5 leading-snug">{body}</p>
        <a
          href={extensionUrl}
          target={extensionUrl.startsWith("http") ? "_blank" : undefined}
          rel={extensionUrl.startsWith("http") ? "noopener noreferrer" : undefined}
          className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
          onClick={() => {
            // Don't dismiss on click — user may want to return
          }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
          </svg>
          Add to Chrome — it&apos;s free
        </a>
      </div>

      <button
        onClick={dismiss}
        className="shrink-0 p-1 text-indigo-400 hover:text-indigo-600 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
