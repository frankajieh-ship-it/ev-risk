"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Appendix } from "@/types/v2-contract";

interface AppendixSectionProps {
  appendix: Appendix;
}

export function AppendixSection({ appendix }: AppendixSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left p-4 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900">
          Appendix: Battery, Recalls & Dealer Questions
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-4 overflow-hidden"
          >
            {/* Battery Diligence */}
            <div className="p-4 bg-white rounded-xl border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-800 uppercase mb-2">
                Battery Health
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                {appendix.buyer_diligence.battery.summary}
              </p>
              <ul className="space-y-1">
                {appendix.buyer_diligence.battery.asks.map((ask, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-blue-400">&#x2022;</span>
                    {ask}
                  </li>
                ))}
              </ul>
            </div>

            {/* Warranty & Recalls */}
            <div className="p-4 bg-white rounded-xl border border-gray-100">
              <h4 className="text-xs font-semibold text-gray-800 uppercase mb-2">
                Warranty & Recalls
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                {appendix.buyer_diligence.warranty_recalls.summary}
              </p>
              <ul className="space-y-1">
                {appendix.buyer_diligence.warranty_recalls.checks.map((check, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-blue-400">&#x2022;</span>
                    {check}
                  </li>
                ))}
              </ul>
            </div>

            {/* Walk-Away Triggers */}
            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
              <h4 className="text-xs font-semibold text-red-800 uppercase mb-2">
                Walk-Away Triggers
              </h4>
              <ul className="space-y-1">
                {appendix.buyer_diligence.walk_away_triggers.map((trigger, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-red-400">&#x2022;</span>
                    {trigger}
                  </li>
                ))}
              </ul>
            </div>

            {/* Dealer Questions */}
            {appendix.dealer_questions.length > 0 && (
              <div className="p-4 bg-white rounded-xl border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-800 uppercase mb-2">
                  Priority Questions to Ask
                </h4>
                <ol className="space-y-2">
                  {appendix.dealer_questions.map((q, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-blue-500 font-bold">{i + 1}.</span>
                      {q}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Cost Estimates (if available) */}
            {appendix.cost_estimates && (
              <div className="p-4 bg-white rounded-xl border border-gray-100">
                <h4 className="text-xs font-semibold text-gray-800 uppercase mb-2">
                  Cost Estimates
                </h4>
                <p className="text-sm text-gray-600">{appendix.cost_estimates.notes}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
