"use client";

import { motion } from "framer-motion";
import { Zap, Car, Thermometer, Battery } from "lucide-react";

const advantages = [
  {
    icon: Zap,
    title: "Charging access",
    description: "Do you have home charging, or will you rely on public stations?",
    color: "bg-yellow-100 text-yellow-600",
  },
  {
    icon: Car,
    title: "Daily driving",
    description: "How far is your commute? What's your longest regular trip?",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: Thermometer,
    title: "Climate impact",
    description: "Cold weather affects range. We factor in your local conditions.",
    color: "bg-red-100 text-red-600",
  },
  {
    icon: Battery,
    title: "Battery buffer",
    description: "Will this EV's range give you comfortable headroom?",
    color: "bg-green-100 text-green-600",
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
            OFFO&apos;s Unique Advantage
          </h2>
          <p className="text-lg font-medium text-white/70 mb-2">
            Will this EV fit your life?
          </p>
          <p className="text-sm text-white/40 max-w-xl mx-auto">
            A good deal on paper isn&apos;t always a good fit in real life. OFFO checks if the car matches your actual driving routine.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto"
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
                  <Icon className="w-5 h-5 text-white/60" />
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
