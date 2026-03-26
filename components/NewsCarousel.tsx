"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import Link from "next/link";
import NewsCard, { type NewsArticle } from "@/components/NewsCard";

interface NewsCarouselProps {
  make?: string | null;
  model?: string | null;
}

export default function NewsCarousel({ make, model }: NewsCarouselProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/news?hours=168&limit=6")
      .then((r) => r.json())
      .then((data: { articles?: NewsArticle[] }) => {
        setArticles(data.articles ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || articles.length === 0) return null;

  const vehicleLabel = [make, model].filter(Boolean).join(" ");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Latest EV Routine News
              </p>
              {vehicleLabel && (
                <p className="text-xs text-gray-400">
                  What might affect your {vehicleLabel}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/news"
            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
          >
            View all →
          </Link>
        </div>

        {/* Horizontal scroll strip */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide p-3">
          {articles.map((article) => (
            <div key={article.id} className="flex-shrink-0 w-64">
              <NewsCard article={article} variant="compact" />
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
