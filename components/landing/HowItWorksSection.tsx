"use client";

import { motion } from "framer-motion";
import { Link2, Search, ClipboardCheck, Eye, Unlock, MessageSquare, Cpu, FileCheck } from "lucide-react";

const receiptSteps = [
  {
    number: 1,
    icon: Link2,
    title: "Paste any listing",
    description:
      "Copy a URL from Autotrader, Cars.com, CarGurus, Facebook Marketplace, or any listing site.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    number: 2,
    icon: Search,
    title: "Get the full picture",
    description:
      "We analyze the price, what's missing from the listing, and what questions you should ask.",
    color: "bg-green-100 text-green-600",
  },
  {
    number: 3,
    icon: ClipboardCheck,
    title: "Go in prepared",
    description:
      "Take your checklist to the test drive. Know exactly what to verify before you commit.",
    color: "bg-indigo-100 text-indigo-600",
  },
];

const receiptStepsV2 = [
  {
    number: 1,
    icon: Link2,
    title: "Paste listing link",
    description:
      "Copy a URL from CarGurus, AutoTrader, Facebook Marketplace, or any listing site.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    number: 2,
    icon: Search,
    title: "Get instant verdict",
    description:
      "See a deal score, price position, and overall risk rating in seconds — no sign-up needed.",
    color: "bg-green-100 text-green-600",
  },
  {
    number: 3,
    icon: Eye,
    title: "Preview 3 risks and 3 questions",
    description:
      "Your free report includes the top risks and the most important questions to ask the seller.",
    color: "bg-yellow-100 text-yellow-600",
  },
  {
    number: 4,
    icon: Unlock,
    title: "Get the full breakdown",
    description:
      "Full risk breakdown, negotiation script, checklist, and PDF export — completely free.",
    color: "bg-indigo-100 text-indigo-600",
  },
];

const homepageSteps = [
  {
    number: 1,
    icon: Link2,
    title: "Paste the listing",
    description:
      "Copy any CarGurus, AutoTrader, Facebook Marketplace, or dealer URL.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    number: 2,
    icon: Search,
    title: "Get a verdict and top risks",
    description:
      "See a deal score, price flags, and the 3 questions that decide whether this car is worth your time.",
    color: "bg-green-100 text-green-600",
  },
  {
    number: 3,
    icon: Unlock,
    title: "Save, compare, or unlock the full breakdown",
    description:
      "Save to My Garage to track listings, compare options, and get alerts.",
    color: "bg-indigo-100 text-indigo-600",
  },
];

const fitCheckSteps = [
  {
    number: 1,
    icon: MessageSquare,
    title: "Tell us your routine",
    description:
      "Answer 4 quick questions about your charging access, driving habits, climate, and long days.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    number: 2,
    icon: Cpu,
    title: "We analyze the fit",
    description:
      "Our engine checks range, charging predictability, and routine friction for your specific situation.",
    color: "bg-green-100 text-green-600",
  },
  {
    number: 3,
    icon: FileCheck,
    title: "Get your verdict",
    description:
      "See if an EV fits your life, what breaks first, and your Plan B — all in under 30 seconds.",
    color: "bg-indigo-100 text-indigo-600",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

interface HowItWorksSectionProps {
  variant?: "receipt" | "receipt-v2" | "fit-check" | "homepage";
}

export default function HowItWorksSection({ variant = "receipt-v2" }: HowItWorksSectionProps) {
  const steps =
    variant === "homepage" ? homepageSteps :
    variant === "fit-check" ? fitCheckSteps :
    variant === "receipt-v2" ? receiptStepsV2 :
    receiptSteps;
  const subtitle =
    variant === "homepage" ? "From listing URL to confident decision in under a minute" :
    variant === "fit-check" ? "Three steps to knowing if an EV fits your life" :
    variant === "receipt-v2" ? "From paste to prepared in four steps" :
    "Three steps to confident used EV shopping";

  return (
    <section id="how-it-works" className="section bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">How it works</p>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3" style={{ lineHeight: "var(--leading-snug)" }}>
            OFFO in three steps
          </h2>
          <p className="text-[0.9375rem] text-gray-500">
            {subtitle}
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className={`grid grid-cols-1 gap-8 mx-auto ${
            variant === "receipt-v2"
              ? "md:grid-cols-4 max-w-5xl"
              : "md:grid-cols-3 max-w-5xl"
          }`}
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="text-center p-6"
              >
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-gray-500">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-widest text-gray-400 mb-2">Step {step.number}</p>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5" style={{ lineHeight: "var(--leading-snug)" }}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
