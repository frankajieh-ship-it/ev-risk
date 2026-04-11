"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { PRICING_PLANS } from "@/lib/pricing-plans";
import { Badge, Button, Card } from "@/components/ui";

const { free, full_report, subscription } = PRICING_PLANS;

export default function PricingSection() {
  return (
    <section id="pricing" className="section bg-[var(--surface-1)]">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Pricing</p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2" style={{ lineHeight: "var(--leading-snug)" }}>
            Simple, honest pricing
          </h2>
          <p className="text-[0.9375rem] text-gray-500">
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
          <Card elevation="base" padding="lg">
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
            <Button
              variant="ghost"
              size="md"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Try for free
            </Button>
          </Card>

          {/* Full report tier */}
          <Card elevation="raised" padding="lg" className="border-2 border-blue-600 relative">
            <Badge variant="primary" className="absolute top-4 right-4 uppercase tracking-wide">
              one-time
            </Badge>
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
            <Button
              variant="primary"
              size="md"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              icon={<Sparkles className="w-4 h-4" />}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/20"
            >
              Get full analysis
            </Button>
          </Card>

          {/* Subscription — only if enabled */}
          {subscription.enabled && (
            <Card elevation="base" padding="md" className="sm:col-span-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">{subscription.label}</p>
                <p className="text-xs text-gray-500">All features, unlimited reports</p>
              </div>
              <p className="text-lg font-bold text-gray-900 shrink-0">
                ${subscription.price_usd}
                <span className="text-xs font-normal text-gray-500">/mo</span>
              </p>
            </Card>
          )}
        </motion.div>
      </div>
    </section>
  );
}
