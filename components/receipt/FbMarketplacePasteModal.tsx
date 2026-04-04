/**
 * FbMarketplacePasteModal
 *
 * Facebook Marketplace listings cannot be auto-fetched (login wall + Cloudflare).
 * This modal guides users through a 3-step copy-paste flow so OFFO can still
 * analyze the listing using the GPT-4o-mini text extractor.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { X, ClipboardPaste, CheckCircle, ChevronRight } from "lucide-react";

interface FbMarketplacePasteModalProps {
  onAnalyze: (text: string) => void;
  onClose: () => void;
}

const FIELDS_EXTRACTED = ["Year", "Make & Model", "Price", "Mileage", "Location", "Title Status", "Fuel Type"];

export default function FbMarketplacePasteModal({ onAnalyze, onClose }: FbMarketplacePasteModalProps) {
  const [pastedText, setPastedText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when modal opens
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 150);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const canAnalyze = pastedText.trim().length >= 20;

  const handleAnalyze = () => {
    if (!canAnalyze) return;
    onAnalyze(pastedText.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            {/* Facebook Marketplace icon */}
            <div className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Facebook Marketplace</p>
              <p className="text-xs text-gray-400">Paste listing details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-5 pt-4 pb-3">
          <p className="text-xs text-gray-500 mb-3">
            Facebook blocks auto-fetch. Follow these steps to analyze the listing:
          </p>

          <div className="space-y-2.5 mb-4">
            {[
              {
                step: "1",
                text: "Open the listing on Facebook Marketplace",
              },
              {
                step: "2",
                text: "Select the text on the right panel — from the title down through the description",
              },
              {
                step: "3",
                text: "Copy (Ctrl+C / ⌘C) and paste below",
              },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step}
                </span>
                <p className="text-sm text-gray-700 leading-snug">{text}</p>
              </div>
            ))}
          </div>

          {/* Fields OFFO will extract */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-4">
            <p className="text-xs font-medium text-blue-700 mb-1.5">OFFO will extract:</p>
            <div className="flex flex-wrap gap-1.5">
              {FIELDS_EXTRACTED.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 text-xs text-blue-700 bg-white border border-blue-200 rounded-full px-2 py-0.5">
                  <CheckCircle className="w-3 h-3 text-blue-500" />
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="relative">
            <ClipboardPaste className="absolute left-3 top-3 w-4 h-4 text-gray-300 pointer-events-none" />
            <textarea
              ref={textareaRef}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={"Paste listing text here...\n\nExample:\n2018 Tesla Model 3 Performance AWD Sedan\n$13,980\nDriven 156,320 miles\nFuel type: Electric\nClean title"}
              rows={6}
              maxLength={8000}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1877F2] focus:border-transparent resize-none placeholder:text-gray-300"
            />
            <p className="text-right text-xs text-gray-300 mt-1">{pastedText.length}/8000</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1877F2] hover:bg-[#1668d6] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Analyze this listing
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
