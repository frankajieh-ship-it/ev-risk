"use client";

import { useEffect } from "react";
import { Shield, AlertTriangle, AlertCircle, HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ShareSnapshot } from "@/types/receipt";
import { useEventTracking } from "@/hooks/useEventTracking";

interface SharePageClientProps {
  snapshot: ShareSnapshot;
  createdAt: string;
  slug: string;
}

const VERDICT_CONFIG = {
  GREEN: {
    label: "Low Risk",
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: Shield,
  },
  YELLOW: {
    label: "Moderate Risk",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: AlertTriangle,
  },
  RED: {
    label: "High Risk",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: AlertCircle,
  },
} as const;

export default function SharePageClient({ snapshot, createdAt, slug }: SharePageClientProps) {
  const { trackEvent } = useEventTracking();

  useEffect(() => {
    trackEvent("share_link_landing_view", { share_slug: slug });
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const config = VERDICT_CONFIG[snapshot.verdict] || VERDICT_CONFIG.YELLOW;
  const VerdictIcon = config.icon;
  const vehicle = [snapshot.listing_summary.year, snapshot.listing_summary.make, snapshot.listing_summary.model]
    .filter(Boolean)
    .join(" ");
  const price = snapshot.listing_summary.price;
  const mileage = snapshot.listing_summary.mileage;
  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1">
            OFFO Listing Check
          </p>
          <h1 className="text-xl font-bold text-gray-900">
            {vehicle || "Vehicle Check"}
          </h1>
          {(price || mileage) && (
            <p className="text-sm text-gray-500 mt-1">
              {price ? `$${price.toLocaleString()}` : ""}
              {price && mileage ? " · " : ""}
              {mileage ? `${mileage.toLocaleString()} mi` : ""}
            </p>
          )}
        </div>

        {/* Verdict card */}
        <div className={`rounded-xl border-2 ${config.border} ${config.bg} p-5 mb-5`}>
          <div className="flex items-center gap-3 mb-2">
            <VerdictIcon className={`w-6 h-6 ${config.text}`} />
            <span className={`text-lg font-bold ${config.text}`}>{config.label}</span>
          </div>
          <p className="text-sm text-gray-700">{snapshot.verdict_reason}</p>
        </div>

        {/* Risk flags */}
        {snapshot.risk_flags.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Risk Flags
            </h2>
            <ul className="space-y-2">
              {snapshot.risk_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-yellow-500 mt-0.5">&#9679;</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Must-ask questions */}
        {snapshot.must_answer_questions.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-500" />
              Must-Ask Questions
            </h2>
            <ul className="space-y-2">
              {snapshot.must_answer_questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5 font-bold">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timestamp + attribution */}
        <div className="text-center text-xs text-gray-400 mt-6 mb-8">
          <p>Generated on {formattedDate}</p>
          <p className="mt-0.5">by OFFO — Used Car Risk Check</p>
        </div>

        {/* CTA */}
        <Link
          href="/receipt"
          onClick={() => trackEvent("share_link_to_receipt_start_click", { share_slug: slug })}
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Run your own listing check
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
