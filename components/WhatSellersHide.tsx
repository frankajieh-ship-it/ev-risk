"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, AlertCircle, MessageCircle } from "lucide-react";

interface DisclosureItem {
  question: string;
  why: string;
  redFlag: string;
}

const DISCLOSURE_ITEMS: DisclosureItem[] = [
  {
    question: "Charging habits (DCFC vs home)",
    why: "Frequent fast charging degrades batteries 2-3x faster than home L2 charging.",
    redFlag: "\"I don't track that\" or vague answers about charging frequency.",
  },
  {
    question: "Climate exposure (extreme heat/cold)",
    why: "Extreme temps accelerate degradation. Hot climates without thermal management = worst case.",
    redFlag: "Garaged in Phoenix/Arizona but \"no idea\" about battery health.",
  },
  {
    question: "Software-limited range vs degradation",
    why: "Some EVs ship with software-limited battery capacity. Not the same as degradation.",
    redFlag: "\"Range is lower than advertised\" without clarifying if it's software or degradation.",
  },
  {
    question: "Recall status actually resolved vs \"eligible\"",
    why: "\"Eligible for recall repair\" ≠ \"repair completed.\" You inherit the liability.",
    redFlag: "\"It's eligible\" or \"I got the notice\" without proof of completion.",
  },
  {
    question: "Battery warranty transfers or not",
    why: "Some warranties are non-transferable or void if CPO sold outside manufacturer network.",
    redFlag: "\"I think it transfers\" or no documentation confirming transfer terms.",
  },
  {
    question: "Exact battery health % (not \"it's fine\")",
    why: "\"Battery is fine\" is meaningless. Ask for State of Health (SOH) % from service report.",
    redFlag: "Refuses to show battery health report or says \"dealership didn't provide it.\"",
  },
];

export default function WhatSellersHide() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden mb-6"
    >
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 rounded-xl">
            <AlertCircle className="w-6 h-6 text-orange-600" />
          </div>
          <div className="text-left">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              What Sellers Don't Disclose
            </h2>
            <p className="text-sm text-gray-600">
              Commonly missing or avoided disclosures — questions that separate legit sellers from sketchy ones
            </p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-6 h-6 text-gray-500" />
          ) : (
            <ChevronDown className="w-6 h-6 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-gray-200"
          >
            <div className="px-8 py-6">
              {/* Intro */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">These questions separate informed buyers from impulsive ones.</p>
                    <p>Legit sellers expect these questions. Sketchy ones dodge or deflect.</p>
                  </div>
                </div>
              </div>

              {/* Disclosure Items */}
              <div className="space-y-4">
                {DISCLOSURE_ITEMS.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-5"
                  >
                    {/* Question */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <h3 className="font-bold text-gray-900 text-base">
                        {item.question}
                      </h3>
                    </div>

                    {/* Why It Matters */}
                    <div className="ml-9 mb-2">
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-semibold text-gray-900">Why:</span> {item.why}
                      </p>
                    </div>

                    {/* Red Flag */}
                    <div className="ml-9 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-xs text-red-800">
                        <span className="font-semibold">🚩 Red Flag:</span> {item.redFlag}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Note */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong>Note:</strong> Sellers who provide clear, documented answers to these questions are demonstrating transparency.
                  Vague or defensive responses are a signal to walk away or negotiate aggressively.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
