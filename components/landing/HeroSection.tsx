"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface HeroSectionProps {
  onAnalyze: (url: string) => void;
}

export default function HeroSection({ onAnalyze }: HeroSectionProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAnalyze(url.trim());
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 pt-12 pb-8 md:pt-20 md:pb-16">
        <div className="text-center max-w-3xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-6"
          >
            Your EV buying{" "}
            <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              second opinion
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-xl text-gray-700 font-medium mb-3"
          >
            Know if it&apos;s a good deal before the test drive
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base text-gray-500 mb-8 max-w-2xl mx-auto"
          >
            Paste any used EV listing. Get a clear verdict, what to verify, and the right questions to ask the seller.
          </motion.p>

          {/* URL Input + CTA */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-2xl mx-auto mb-4"
          >
            {/* Desktop: side-by-side */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-0">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste listing URL from Autotrader, Cars.com, CarGurus..."
                className="flex-1 px-5 py-3.5 text-base border-2 border-gray-200 rounded-xl sm:rounded-r-none sm:border-r-0 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={!url.trim()}
                className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-xl sm:rounded-l-none text-base hover:from-blue-700 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
              >
                Analyze Listing
              </button>
            </div>
          </motion.form>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-sm text-gray-400"
          >
            Free first analysis &middot; Results in 30 seconds
          </motion.p>
        </div>
      </div>
    </section>
  );
}
