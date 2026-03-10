"use client";

import { motion } from "framer-motion";
import {
  ShoppingBag,
  Search,
  MessageSquare,
  BarChart2,
  FileDown,
  Sparkles,
} from "lucide-react";
import { BUYER_PASS_PRICE } from "@/lib/price-assignment";

const benefits = [
  { icon: ShoppingBag, text: "10 receipt credits" },
  { icon: Search, text: "Full analysis with deep-dive" },
  { icon: MessageSquare, text: "3 ready-to-use negotiation scripts" },
  { icon: BarChart2, text: "Market comparison with similar listings" },
  { icon: FileDown, text: "PDF export of every receipt" },
];

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
            One-time purchase
          </h2>
          <p className="text-gray-500">
            Get the Buyer Pass
          </p>
          <p className="text-sm text-gray-400 mt-1">
            For serious shoppers comparing multiple listings. Pay once, use throughout your car search.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-md mx-auto"
        >
          <div className="bg-white border-2 border-blue-200 rounded-2xl p-8 shadow-sm">
            {/* Price */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-gray-900">
                {BUYER_PASS_PRICE}
              </div>
              <p className="text-sm text-gray-500 mt-1">one-time</p>
            </div>

            {/* Benefits */}
            <ul className="space-y-3 mb-8">
              {benefits.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                  <Icon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/20"
            >
              <Sparkles className="w-4 h-4" />
              Try a free analysis
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
              Free first analysis. Upgrade to Buyer Pass anytime.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
