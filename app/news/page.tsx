"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, Zap } from "lucide-react";
import Link from "next/link";
import NewsCard, { type NewsArticle } from "@/components/NewsCard";

const HOURS_OPTIONS = [
  { label: "Last 48 hours", value: 48 },
  { label: "Last 7 days",   value: 168 },
];

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (client-side)
  const [hoursBack, setHoursBack] = useState(48);
  const [minScore, setMinScore] = useState(65);
  const [postWorthyOnly, setPostWorthyOnly] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/news?hours=${hoursBack}&limit=50`)
      .then((r) => r.json())
      .then((data: { articles?: NewsArticle[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setArticles(data.articles ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load articles"))
      .finally(() => setLoading(false));
  }, [hoursBack]);

  const filtered = useMemo(() =>
    articles.filter(
      (a) =>
        a.impact_score >= minScore &&
        (!postWorthyOnly || a.post_worthy)
    ),
    [articles, minScore, postWorthyOnly]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Powered by OFFO
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            EV Routine Impact Digest
          </h1>
          <p className="text-gray-500 mt-1.5 text-sm leading-relaxed">
            What actually affects your daily EV ownership — battery health, charging, range, recalls.
            Scored and summarised by AI, updated every morning.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Back to{" "}
              <Link href="/" className="text-blue-600 hover:underline">
                OFFO
              </Link>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white rounded-2xl border border-gray-200">
          {/* Time range */}
          <div className="flex gap-1">
            {HOURS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHoursBack(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hoursBack === opt.value
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Min score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Min score: <strong>{minScore}</strong></span>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24 accent-gray-800"
            />
          </div>

          {/* Post-worthy toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={postWorthyOnly}
              onChange={(e) => setPostWorthyOnly(e.target.checked)}
              className="rounded accent-blue-600"
            />
            <span className="text-xs text-gray-600">Post-worthy only</span>
          </label>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading digest…</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No high-impact articles in this window.</p>
            <p className="text-xs mt-1">Try expanding to 7 days or lowering the minimum score.</p>
            <p className="text-xs text-gray-300 mt-4">Analysis runs daily at 6 AM EST.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {filtered.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <NewsCard article={article} variant="default" />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Footer note */}
        {!loading && !error && (
          <p className="text-center text-xs text-gray-300 mt-10 pb-8">
            {filtered.length} article{filtered.length !== 1 ? "s" : ""} · Analysis by OFFO · Runs daily at 6 AM EST
          </p>
        )}
      </div>
    </div>
  );
}
