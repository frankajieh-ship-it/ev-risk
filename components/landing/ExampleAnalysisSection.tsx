"use client";

import { motion } from "framer-motion";
import { Check, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import SampleVerdictBlock from "@/components/receipt/SampleVerdictBlock";

const highlights = [
  "Fair price comparison based on real market data",
  "Missing info that sellers often leave out",
  "Red flags that could cost you later",
  "Specific questions tailored to the listing",
];

const verifyItems = [
  { label: "Battery health report", priority: true },
  { label: "Tire tread depth", priority: false },
  { label: "Service history for recalls", priority: true },
];

export default function ExampleAnalysisSection() {
  return (
    <section className="py-16 md:py-24 bg-[#0d1117]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-[#00d97e] mb-2">Example</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Example Analysis
            </h2>
            <p className="text-white/50 text-base mb-6">
              See what OFFO reveals about a listing
            </p>
            <p className="text-sm text-white/40 max-w-2xl mx-auto mb-8">
              Every analysis gives you a clear verdict, price comparison, and an actionable
              checklist — so you know exactly what to ask before you visit.
            </p>
          </motion.div>

          {/* Highlight bullets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-wrap justify-center gap-3 mb-10"
          >
            {highlights.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-full text-xs font-medium text-white/70"
              >
                <Check className="w-3 h-3 text-[#00d97e]" />
                {item}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Example card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl mx-auto"
        >
          <div className="mb-3 text-left">
            <span className="text-xs font-semibold text-[#00d97e]/60 uppercase tracking-wider">
              Analysis Result
            </span>
          </div>

          {/* Reuse existing SampleVerdictBlock */}
          <SampleVerdictBlock />

          {/* Market Comparison mock */}
          <div className="mt-4 bg-white/[0.05] rounded-xl border border-white/10 p-5">
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">
              Market Comparison
            </h4>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-[#00d97e]" />
              <span className="text-sm font-medium text-[#00d97e]">Below Market</span>
            </div>
            {/* Price bar */}
            <div className="relative h-2 bg-white/10 rounded-full mb-2">
              <div
                className="absolute top-0 left-0 h-2 bg-[#00d97e] rounded-full"
                style={{ width: "47%" }}
              />
              <div
                className="absolute top-0 h-2 w-0.5 bg-white/60 rounded"
                style={{ left: "47%" }}
                title="$28,500"
              />
              <div
                className="absolute top-0 h-2 w-0.5 bg-white/20 rounded"
                style={{ left: "67%" }}
                title="$30,000 avg"
              />
            </div>
            <div className="flex justify-between text-xs text-white/40">
              <span className="font-medium text-[#00d97e]">$28,500</span>
              <span>$30,000 avg</span>
              <span>$36,000</span>
            </div>
          </div>

          {/* Verify Before Visiting mock */}
          <div className="mt-4 bg-white/[0.05] rounded-xl border border-white/10 p-5">
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">
              Verify Before Visiting
            </h4>
            <ul className="space-y-2.5">
              {verifyItems.map((item) => (
                <li key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-white/20" />
                    <span className="text-sm text-white/70">{item.label}</span>
                  </div>
                  {item.priority && (
                    <span className="flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      High Priority
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
