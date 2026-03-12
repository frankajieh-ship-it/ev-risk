"use client";

import { motion } from "framer-motion";
import { Car, Building, ArrowRight } from "lucide-react";
import Link from "next/link";

const personas = [
  {
    icon: Car,
    title: "For Shoppers",
    description:
      "Not sure if an EV fits your life? Answer 4 quick questions about your routine and get a personalized fit verdict.",
    cta: "Start EV Fit Check",
    href: "#fit-check",
    isScroll: true,
    accent: "blue",
    iconBg: "bg-blue-100 text-blue-600",
    ctaBg: "bg-blue-600 hover:bg-blue-700",
    features: ["Fit verdict", "What breaks first", "Plan B fallback"],
  },
  {
    icon: Building,
    title: "For Dealers",
    description:
      "Manage your EV inventory, decode VINs instantly, and connect with qualified buyers through your dealer workspace.",
    cta: "Open Dealer Workspace",
    href: "/dealer",
    isScroll: false,
    accent: "indigo",
    iconBg: "bg-indigo-100 text-indigo-600",
    ctaBg: "bg-indigo-600 hover:bg-indigo-700",
    features: ["VIN autofill", "Photo upload", "Buyer inquiries"],
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

export default function PersonaCardsSection() {
  const handleScrollClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Built for every stage of your EV journey
          </h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Whether you&apos;re shopping, selling, or dealing — OFFO gives you the data-backed confidence you need.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto"
        >
          {personas.map((persona) => {
            const Icon = persona.icon;
            return (
              <motion.div
                key={persona.title}
                variants={itemVariants}
                className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow flex flex-col"
              >
                <div className={`w-12 h-12 rounded-xl ${persona.iconBg} flex items-center justify-center mb-5`}>
                  <Icon className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {persona.title}
                </h3>

                <p className="text-sm text-gray-500 leading-relaxed mb-5 flex-1">
                  {persona.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-6">
                  {persona.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {persona.isScroll ? (
                  <a
                    href={persona.href}
                    onClick={(e) => handleScrollClick(e, persona.href)}
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 ${persona.ctaBg} text-white text-sm font-semibold rounded-xl transition-colors`}
                  >
                    {persona.cta}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <Link
                    href={persona.href}
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 ${persona.ctaBg} text-white text-sm font-semibold rounded-xl transition-colors`}
                  >
                    {persona.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
