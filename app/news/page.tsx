"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { motion } from "framer-motion";
import { Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import NewsCard, { type NewsArticle, type NewsCategory } from "@/components/NewsCard";

const HOURS_OPTIONS = [
  { label: "Last 48 hours", value: 48 },
  { label: "Last 7 days",   value: 168 },
];

const CATEGORY_TABS: { label: string; value: NewsCategory | "all" }[] = [
  { label: "All",            value: "all" },
  { label: "🔴 Recalls",     value: "recall" },
  { label: "💲 Used Market", value: "used_market" },
  { label: "⚡ Charging",    value: "charging_network" },
  { label: "📡 Routine",     value: "routine_impact" },
];

function NewsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialCategory = (searchParams.get("category") as NewsCategory | "all") || "all";

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hoursBack, setHoursBack] = useState(168);
  const [minScore, setMinScore] = useState(60);
  const [postWorthyOnly, setPostWorthyOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NewsCategory | "all">(initialCategory);

  useEffect(() => {
    const loadArticles = async () => {
      setLoading(true);
      setError(null);
      const catParam = activeCategory !== "all" ? `&category=${activeCategory}` : "";
      try {
        const r = await fetch(`/api/news?hours=${hoursBack}&limit=50${catParam}`);
        const data: { articles?: NewsArticle[]; error?: string } = await r.json();
        if (data.error) throw new Error(data.error);
        setArticles(data.articles ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load articles");
      } finally {
        setLoading(false);
      }
    };
    loadArticles();
  }, [hoursBack, activeCategory]);

  function handleCategoryChange(cat: NewsCategory | "all") {
    setActiveCategory(cat);
    const params = new URLSearchParams(searchParams.toString());
    if (cat === "all") {
      params.delete("category");
    } else {
      params.set("category", cat);
    }
    router.replace(`/news?${params.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() =>
    articles.filter(
      (a) =>
        a.impact_score >= minScore &&
        (!postWorthyOnly || a.post_worthy)
    ),
    [articles, minScore, postWorthyOnly]
  );

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-[#00d97e]" />
            <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">
              Powered by OFFO
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            EV News Digest
          </h1>
          <p className="text-white/40 mt-1.5 text-sm leading-relaxed">
            Recalls, used EV market shifts, charging network updates, and daily ownership news —
            scored by AI, updated every morning.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-white/25">
              Back to{" "}
              <Link href="/" className="text-[#00d97e]/70 hover:text-[#00d97e] transition-colors">
                OFFO
              </Link>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-4">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleCategoryChange(tab.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                activeCategory === tab.value
                  ? "bg-white/[0.10] text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white/[0.04] rounded-2xl border border-white/[0.08]">
          {/* Time range */}
          <div className="flex gap-1">
            {HOURS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHoursBack(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hoursBack === opt.value
                    ? "bg-white/[0.12] text-white"
                    : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Min score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 whitespace-nowrap">
              Min score: <strong className="text-white/70">{minScore}</strong>
            </span>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24 accent-[#00d97e]"
            />
          </div>

          {/* Post-worthy toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={postWorthyOnly}
              onChange={(e) => setPostWorthyOnly(e.target.checked)}
              className="rounded accent-[#00d97e]"
            />
            <span className="text-xs text-white/50">Post-worthy only</span>
          </label>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading digest…</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <Zap className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No high-impact articles in this window.</p>
            <p className="text-xs mt-1">Try expanding to 7 days or lowering the minimum score.</p>
            <p className="text-xs text-white/20 mt-4">Analysis runs daily at 6 AM EST.</p>
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
          <p className="text-center text-xs text-white/20 mt-10 pb-8">
            {filtered.length} article{filtered.length !== 1 ? "s" : ""} · Analysis by OFFO · Runs daily at 6 AM EST
          </p>
        )}
      </div>
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/20" />
      </div>
    }>
      <NewsPageInner />
    </Suspense>
  );
}
