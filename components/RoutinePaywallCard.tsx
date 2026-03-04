"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Zap,
  BarChart2,
  FileDown,
  ShoppingBag,
} from "lucide-react";
import { BUYER_PASS_PRICE } from "@/lib/price-assignment";

interface RoutinePaywallCardProps {
  onCheckout: () => Promise<void>;
  runCount: number;
}

const UNLOCK_BENEFITS = [
  { icon: Zap, text: "Unlimited routine scenarios" },
  { icon: BarChart2, text: "Full AI analysis on every page" },
  { icon: ShoppingBag, text: "Receipt analysis + deep-dive" },
  { icon: FileDown, text: "PDF export of every report" },
];

export default function RoutinePaywallCard({
  onCheckout,
  runCount,
}: RoutinePaywallCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await onCheckout();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-2xl border border-blue-200 shadow-sm overflow-hidden"
    >
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {runCount} of 3 free scenarios used
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            Unlock Unlimited Scenarios
          </h3>
          <p className="text-sm text-gray-600">
            One payment unlocks everything — routine planner, receipt analysis, and full reports.
          </p>
        </div>

        {/* Benefits */}
        <div className="border-2 border-indigo-300 rounded-xl p-4 bg-white mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">OFFO Buyer Pass</h4>
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
              {BUYER_PASS_PRICE}
            </span>
          </div>
          <ul className="space-y-2 mb-4">
            {UNLOCK_BENEFITS.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <Icon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleClick}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-medium text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Unlock All Features — {BUYER_PASS_PRICE}
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}
      </div>
    </motion.div>
  );
}
