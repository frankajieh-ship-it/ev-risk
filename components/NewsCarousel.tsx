"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import Link from "next/link";
import NewsCard, { type NewsArticle, type NewsCategory } from "@/components/NewsCard";

interface NewsCarouselProps {
  make?: string | null;
  model?: string | null;
}

const TABS: { label: string; value: NewsCategory | "all" }[] = [
  { label: "All",        value: "all" },
  { label: "🔴 Recalls", value: "recall" },
  { label: "💲 Used Market", value: "used_market" },
  { label: "⚡ Charging", value: "charging_network" },
  { label: "📡 Routine", value: "routine_impact" },
];

export default function NewsCarousel({ make, model }: NewsCarouselProps) {
  const [activeTab, setActiveTab] = useState<NewsCategory | "all">("all");
  const [cache, setCache] = useState<Partial<Record<NewsCategory | "all", NewsArticle[]>>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (cache[activeTab] !== undefined) return;
    const fetchTab = async () => {
      setLoading(true);
      const url = activeTab === "all"
        ? "/api/news?hours=168&limit=6"
        : `/api/news?hours=168&limit=6&category=${activeTab}`;
      try {
        const r = await fetch(url);
        const data: { articles?: NewsArticle[] } = await r.json();
        setCache((prev) => ({ ...prev, [activeTab]: data.articles ?? [] }));
        setLoaded(true);
      } catch {
        setCache((prev) => ({ ...prev, [activeTab]: [] }));
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    };
    fetchTab();
  }, [activeTab, cache]);

  const articles = cache[activeTab] ?? [];

  // Only hide if we've loaded the initial "all" tab and it's empty
  if (loaded && activeTab === "all" && articles.length === 0 && !loading) return null;

  const vehicleLabel = [make, model].filter(Boolean).join(" ");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-0 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00d97e]" />
            <div>
              <p className="text-sm font-semibold text-white/80">
                EV News
              </p>
              {vehicleLabel && (
                <p className="text-xs text-white/30">
                  What might affect your {vehicleLabel}
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/news${activeTab !== "all" ? `?category=${activeTab}` : ""}`}
            className="text-xs font-medium text-[#00d97e]/70 hover:text-[#00d97e] transition-colors whitespace-nowrap"
          >
            View all →
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.value
                  ? "bg-white/[0.10] text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Article strip */}
        <div className="relative min-h-[80px]">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[#00d97e] animate-spin" />
            </div>
          ) : articles.length === 0 ? (
            <p className="text-xs text-white/25 text-center py-6">No articles in this category yet.</p>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 overflow-x-auto scrollbar-hide p-3"
            >
              {articles.map((article) => (
                <div key={article.id} className="flex-shrink-0 w-64">
                  <NewsCard article={article} variant="compact" />
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
