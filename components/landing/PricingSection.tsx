"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { PRICING_PLANS } from "@/lib/pricing-plans";

const { free, full_report, subscription } = PRICING_PLANS;

export default function PricingSection() {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Simple, honest pricing
          </h2>
          <p className="text-gray-500">
            Start free. Upgrade only when you want the full picture.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {/* Free tier */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{free.label}</p>
            <p className="text-3xl font-bold text-gray-900 mb-4">Free</p>
            <ul className="space-y-2 mb-6">
              {free.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              Try for free
            </button>
          </div>

          {/* Full report tier */}
          <div className="bg-white border-2 border-blue-600 rounded-2xl p-6 shadow-sm relative">
            <span className="absolute top-4 right-4 text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
              one-time
            </span>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">{full_report.label}</p>
            <p className="text-3xl font-bold text-gray-900 mb-4">${full_report.price_usd}</p>
            <ul className="space-y-2 mb-6">
              {full_report.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-blue-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/20"
            >
              <Sparkles className="w-4 h-4" />
              Get full analysis
            </button>
          </div>

          {/* Subscription — only if enabled */}
          {subscription.enabled && (
            <div className="sm:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">{subscription.label}</p>
                <p className="text-xs text-gray-500">All features, unlimited reports</p>
              </div>
              <p className="text-lg font-bold text-gray-900 shrink-0">
                ${subscription.price_usd}
                <span className="text-xs font-normal text-gray-500">/mo</span>
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
