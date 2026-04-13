"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, Zap, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import NewsCard, { type NewsArticle, type NewsCategory } from "@/components/NewsCard";

const HOURS_OPTIONS = [
  { label: "Last 48h", value: 48 },
  { label: "Last 7 days", value: 168 },
];

const CATEGORY_TABS: { label: string; value: NewsCategory | "all"; description: string }[] = [
  { label: "All",            value: "all",             description: "Everything across all categories" },
  { label: "🔴 Recalls",     value: "recall",          description: "NHTSA recalls, safety defects, OTA fixes" },
  { label: "💲 Used Market", value: "used_market",     description: "Used EV prices, depreciation, CPO" },
  { label: "⚡ Charging",    value: "charging_network", description: "Network expansions, outages, reliability" },
  { label: "📡 Routine",     value: "routine_impact",  description: "Battery, range, daily ownership" },
];

export default function NewsPage() {
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

  const activeTab = CATEGORY_TABS.find((t) => t.value === activeCategory) ?? CATEGORY_TABS[0];

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
      (a) => a.impact_score >= minScore && (!postWorthyOnly || a.post_worthy)
    ),
    [articles, minScore, postWorthyOnly]
  );

  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/offo-logo.png"
              alt="OFFO"
              width={200}
              height={103}
              className="w-20 sm:w-24 h-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/receipt"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors"
            >
              Analyze a Listing
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero header ───────────────────────────────────────── */}
      <div className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-widest">
              EV News Digest
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight mb-3">
            What&apos;s happening in the EV world
          </h1>
          <p className="text-white/40 text-[0.9375rem] leading-relaxed max-w-xl">
            Recalls, used market shifts, charging network updates, and daily ownership news —
            scored by AI and updated every morning at 6 AM EST.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Category tabs ─────────────────────────────────── */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-1 -mx-1 px-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleCategoryChange(tab.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === tab.value
                  ? "bg-white/[0.10] text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active tab description */}
        <p className="text-xs text-white/25 mb-5 px-1">{activeTab.description}</p>

        {/* ── Filters ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
          {/* Time range */}
          <div className="flex gap-1">
            {HOURS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHoursBack(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hoursBack === opt.value
                    ? "bg-white/[0.12] text-white"
                    : "bg-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/[0.08]" />

          {/* Min score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 whitespace-nowrap">
              Min score: <span className="text-white/60 font-medium">{minScore}</span>
            </span>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-20 accent-[#00d97e]"
            />
          </div>

          <div className="w-px h-4 bg-white/[0.08]" />

          {/* Post-worthy toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={postWorthyOnly}
              onChange={(e) => setPostWorthyOnly(e.target.checked)}
              className="rounded accent-[#00d97e]"
            />
            <span className="text-xs text-white/40">Post-worthy only</span>
          </label>
        </div>

        {/* ── Content ───────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-white/20">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading digest…</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400/70 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Zap className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-sm font-medium text-white/30">No articles in this window.</p>
            <p className="text-xs text-white/20 mt-1">Try expanding to 7 days or lowering the minimum score.</p>
            <p className="text-xs text-white/15 mt-4">Analysis runs daily at 6 AM EST.</p>
          </div>
        ) : (
          <motion.div
            key={`${activeCategory}-${hoursBack}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            {filtered.map((article, i) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
              >
                <NewsCard article={article} variant="default" />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Footer note ───────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <p className="text-center text-xs text-white/15 mt-10 pb-8">
            {filtered.length} article{filtered.length !== 1 ? "s" : ""} · Scored by OFFO AI · Updated daily at 6 AM EST
          </p>
        )}

        {/* ── CTA ───────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-8 mb-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/70 mb-0.5">Buying a used EV?</p>
              <p className="text-xs text-white/30">Paste any listing URL and get an instant deal receipt — risk score, hidden issues, and what to watch out for.</p>
            </div>
            <Link
              href="/receipt"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors whitespace-nowrap"
            >
              Analyze a listing <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
