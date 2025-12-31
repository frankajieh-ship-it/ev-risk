"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Link as LinkIcon, MessageSquare } from "lucide-react";
import { generateRedditSummary } from "@/lib/reddit-summary-generator";

interface ShareDropdownProps {
  vehicle: string;
  fitSignal: "Good Fit" | "Good Fit — with conditions" | "Conditional Fit" | "High Friction";
  oneLiner: string;
  becomesAnnoyingIf: string;
  whatBreaksFirst: string[];
  onShare: () => void;
}

export default function ShareDropdown({
  vehicle,
  fitSignal,
  oneLiner,
  becomesAnnoyingIf,
  whatBreaksFirst,
  onShare,
}: ShareDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleCopyLink = () => {
    const shareData = {
      title: `EV-Risk™ Report: ${vehicle}`,
      text: `⚠️ This report explains fit and uncertainty. It does not rate vehicles or recommend purchases.\n\nEV ownership context report for ${vehicle}\n\n${window.location.href}`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(`${shareData.text}`);
      alert("Report link with disclaimer copied to clipboard!");
    }

    onShare();
    setIsOpen(false);
  };

  const handleCopyRedditSummary = () => {
    const redditSummary = generateRedditSummary({
      vehicle,
      fitSignal,
      oneLiner,
      becomesAnnoyingIf,
      whatBreaksFirst,
    });

    navigator.clipboard.writeText(redditSummary);
    alert("Reddit summary copied to clipboard! (4 lines, no links)");

    onShare();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Share2 className="w-5 h-5 mr-2" />
        Share
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
          <div className="py-1">
            <button
              onClick={handleCopyLink}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
            >
              <LinkIcon className="w-4 h-4 text-blue-600" />
              Copy share link
            </button>
            <button
              onClick={handleCopyRedditSummary}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700 border-t border-gray-100"
            >
              <MessageSquare className="w-4 h-4 text-orange-600" />
              Copy Reddit summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
