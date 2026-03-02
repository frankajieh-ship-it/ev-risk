"use client";

import { motion } from "framer-motion";
import { Link2, Search, ClipboardCheck } from "lucide-react";

const steps = [
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

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            How OFFO works
          </h2>
          <p className="text-gray-500 text-base">
            Three steps to confident used EV shopping
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto"
        >
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                variants={itemVariants}
                className="text-center p-6"
              >
                <div className="flex items-center justify-center mb-5">
                  <div className={`w-14 h-14 rounded-2xl ${step.color} flex items-center justify-center`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-sm font-bold mb-3">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
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
