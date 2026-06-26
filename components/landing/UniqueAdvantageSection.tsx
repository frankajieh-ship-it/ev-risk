"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, TrendingDown, MessageSquare, Battery, Search } from "lucide-react";

const advantages = [
  {
    icon: ShieldCheck,
    color: "text-[#00d97e]",
    title: "Missing proof = red flag",
    description: "No battery report? No service records? OFFO penalizes missing evidence — not just confirmed problems. Silence hides as much as a bad history report.",
  },
  {
    icon: Battery,
    color: "text-blue-400",
    title: "Battery health from mileage + age",
    description: "OFFO estimates battery state of health using degradation curves even when the seller provides no report — then flags if the claimed range looks optimistic.",
  },
  {
    icon: Zap,
    color: "text-yellow-400",
    title: "Routine fit, not just specs",
    description: "Scores whether this EV fits your actual charging setup, commute, climate, and longest day. Cold winters cut range 20–30% — we calculate that for your conditions.",
  },
  {
    icon: TrendingDown,
    color: "text-purple-400",
    title: "Price vs. real comps in your area",
    description: "Compares the listing to verified comparable listings nearby, shows where the price sits in the distribution, and reports how many buyers are competing.",
  },
  {
    icon: MessageSquare,
    color: "text-orange-400",
    title: "Negotiation script, ready to send",
    description: "Generates a buyer-specific opening message and 3 scenario scripts tied to what was actually found in the listing. Not generic tips — copy-paste ready.",
  },
  {
    icon: Search,
    color: "text-red-400",
    title: "38 EV-specific risk signals",
    description: "Checks for DC fast charging availability, odometer/VIN mismatches, dealer add-on pressure, and known model limitations against your specific use case.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function UniqueAdvantageSection() {
  return (
    <section className="py-16 md:py-24 bg-[#111827]">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[#00d97e] mb-2">Why OFFO</p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            What OFFO actually checks
          </h2>
          <p className="text-lg font-medium text-white/70 mb-2">
            35 seconds. No sign-up. Things Carfax doesn&apos;t check.
          </p>
          <p className="text-sm text-white/40 max-w-xl mx-auto">
            OFFO runs 38 EV-specific signals on every listing — checking battery health, price vs. market, and whether the car fits your charging life.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
        >
          {advantages.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                variants={itemVariants}
                className="bg-white/[0.05] border border-white/10 rounded-xl p-6 hover:bg-white/[0.08] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">
                  {item.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
