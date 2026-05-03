"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { Loader2, ExternalLink, Zap, AlertTriangle, TrendingUp, Battery, Radio } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { type NewsArticle, type NewsCategory } from "@/components/NewsCard";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_TABS: {
  label: string;
  value: NewsCategory | "all";
  icon: React.ReactNode;
  description: string;
}[] = [
  { label: "All",         value: "all",              icon: <Radio className="w-3.5 h-3.5" />,         description: "All EV news" },
  { label: "Recalls",     value: "recall",            icon: <AlertTriangle className="w-3.5 h-3.5" />, description: "Safety recalls & defects" },
  { label: "Used Market", value: "used_market",       icon: <TrendingUp className="w-3.5 h-3.5" />,    description: "Prices & depreciation" },
  { label: "Charging",    value: "charging_network",  icon: <Zap className="w-3.5 h-3.5" />,           description: "Network & infrastructure" },
  { label: "Ownership",   value: "routine_impact",    icon: <Battery className="w-3.5 h-3.5" />,       description: "Battery, range & daily use" },
];

const CATEGORY_COLOR: Record<string, string> = {
  recall:           "bg-red-50 text-red-700 border-red-200",
  used_market:      "bg-amber-50 text-amber-700 border-amber-200",
  charging_network: "bg-blue-50 text-blue-700 border-blue-200",
  routine_impact:   "bg-gray-100 text-gray-600 border-gray-200",
};

const CATEGORY_LABEL: Record<string, string> = {
  recall:           "Recall",
  used_market:      "Used Market",
  charging_network: "Charging",
  routine_impact:   "Ownership",
};

const EFFECT_LABELS: Record<string, string> = {
  battery_daily_use:   "Battery",
  charging:            "Charging",
  range:               "Range",
  recall:              "Recall",
  winter:              "Winter",
  infrastructure:      "Infrastructure",
  cost:                "Cost",
  software:            "Software",
  used_pricing:        "Used Price",
  depreciation:        "Depreciation",
  network_reliability: "Reliability",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

// ---------------------------------------------------------------------------
// Inline article card — light news-blog style
// ---------------------------------------------------------------------------

function ArticleCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  const catLabel = article.category ? CATEGORY_LABEL[article.category] : null;
  const catColor = article.category ? CATEGORY_COLOR[article.category] : "";
  const isRecall = article.category === "recall";
  const isHighImpact = article.impact_score >= 80;

  if (featured) {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3">
            {catLabel && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${catColor}`}>
                {catLabel}
              </span>
            )}
            {isRecall && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Safety Alert
              </span>
            )}
            {isHighImpact && !isRecall && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                Top Story
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">{timeAgo(article.scored_at)}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-snug mb-3 group-hover:text-green-700 transition-colors">
            {article.title}
          </h2>
          {article.ai_summary && (
            <p className="text-gray-500 leading-relaxed mb-4">{article.ai_summary}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{article.source}</span>
              {article.key_routine_effects && article.key_routine_effects.length > 0 && (
                <div className="flex gap-1.5">
                  {article.key_routine_effects.slice(0, 3).map((e) => (
                    <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {EFFECT_LABELS[e] ?? e.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-sm font-semibold text-green-600 flex items-center gap-1 group-hover:gap-2 transition-all">
              Read <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:border-gray-300 transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {catLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0 rounded-full border ${catColor}`}>
              {catLabel}
            </span>
          )}
          <span className="text-xs text-gray-400">{timeAgo(article.scored_at)}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{article.source}</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-green-700 transition-colors">
          {article.title}
        </h3>
        {article.ai_summary && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{article.ai_summary}</p>
        )}
        {article.key_routine_effects && article.key_routine_effects.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {article.key_routine_effects.slice(0, 3).map((e) => (
              <span key={e} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-100">
                {EFFECT_LABELS[e] ?? e.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
      <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-green-500 flex-shrink-0 mt-0.5 transition-colors" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Inline CTA nudge
// ---------------------------------------------------------------------------

function CtaNudge({ context }: { context: "recall" | "used_market" | "generic" }) {
  const copy = {
    recall: {
      headline: "See if your listing has open recalls",
      sub: "Paste a CarGurus or AutoTrader URL — we check NHTSA, battery, title, and pricing in seconds.",
      cta: "Check a listing free",
    },
    used_market: {
      headline: "Used EV prices are shifting — know if your deal still holds",
      sub: "Get a live price comparison against similar listings before you make an offer.",
      cta: "Analyze a listing free",
    },
    generic: {
      headline: "See how this affects the listing you're watching",
      sub: "Paste any CarGurus or AutoTrader URL and get a full risk receipt — recalls, price, battery, negotiation scripts.",
      cta: "Analyze a listing free",
    },
  }[context];

  return (
    <div className="my-6 p-5 rounded-2xl bg-green-50 border border-green-200 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">{copy.headline}</p>
        <p className="text-xs text-gray-500 leading-relaxed">{copy.sub}</p>
      </div>
      <Link
        href="/"
        className="flex-shrink-0 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors whitespace-nowrap"
      >
        {copy.cta} →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function NewsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialCategory = (searchParams.get("category") as NewsCategory | "all") || "all";

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<NewsCategory | "all">(initialCategory);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const catParam = activeCategory !== "all" ? `&category=${activeCategory}` : "";
      try {
        const r = await fetch(`/api/news?hours=168&limit=50${catParam}`);
        const data: { articles?: NewsArticle[]; error?: string } = await r.json();
        if (data.error) throw new Error(data.error);
        setArticles(data.articles ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load articles");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeCategory]);

  function handleCategoryChange(cat: NewsCategory | "all") {
    setActiveCategory(cat);
    const params = new URLSearchParams(searchParams.toString());
    if (cat === "all") params.delete("category");
    else params.set("category", cat);
    router.replace(`/news?${params.toString()}`, { scroll: false });
  }

  // Sort by impact score desc (API already does this, but be explicit)
  const sorted = useMemo(() =>
    [...articles].filter(a => a.impact_score >= 60).sort((a, b) => b.impact_score - a.impact_score),
    [articles]
  );

  const featured = sorted[0] ?? null;
  const rest = sorted.slice(1);

  // Pick a contextual CTA nudge based on active category
  const ctaContext: "recall" | "used_market" | "generic" =
    activeCategory === "recall" ? "recall" :
    activeCategory === "used_market" ? "used_market" : "generic";

  const nudgeInsertAt = 4; // insert CTA after 4th article in the list

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/offo-logo.png" alt="OFFO" width={200} height={103} className="w-20 h-auto" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/blog" className="hidden sm:block text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Blog
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Analyze a listing
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-widest mb-2">EV News</p>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-2">
            What&apos;s happening in the used EV market
          </h1>
          <p className="text-gray-500 max-w-xl">
            Recalls, pricing shifts, charging updates, and ownership news — scored by AI and updated every morning.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Category tabs ── */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-8 border-b border-gray-200">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleCategoryChange(tab.value)}
              className={`flex items-center gap-1.5 flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeCategory === tab.value
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-500 text-sm">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-gray-400 text-sm">No articles found. Check back tomorrow.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Left column: main feed ── */}
            <div className="lg:col-span-2 space-y-4">
              {featured && <ArticleCard article={featured} featured />}

              {rest.map((article, i) => (
                <div key={article.id}>
                  {i === nudgeInsertAt && (
                    <CtaNudge context={ctaContext} />
                  )}
                  <ArticleCard article={article} />
                </div>
              ))}

              {rest.length < nudgeInsertAt && (
                <CtaNudge context={ctaContext} />
              )}
            </div>

            {/* ── Right sidebar ── */}
            <aside className="space-y-6">

              {/* Sticky analyze CTA */}
              <div className="sticky top-20">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Free tool</p>
                  <h3 className="text-base font-bold text-gray-900 mb-1.5">
                    See how today&apos;s news affects your listing
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed">
                    Paste any CarGurus or AutoTrader URL. We pull recalls, battery health, title history, price vs. comparables, and 3 negotiation scripts.
                  </p>
                  <Link
                    href="/"
                    className="block w-full text-center py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                  >
                    Analyze a listing free →
                  </Link>
                  <p className="text-xs text-gray-400 text-center mt-2">No account needed · Takes 30 seconds</p>
                </div>

                {/* Category quick-jump */}
                <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Browse by topic</p>
                  <div className="space-y-1">
                    {CATEGORY_TABS.filter(t => t.value !== "all").map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => handleCategoryChange(tab.value)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                          activeCategory === tab.value
                            ? "bg-green-50 text-green-700 font-medium"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                        <span className="ml-auto text-xs text-gray-400">{tab.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ── Footer note ── */}
        {!loading && !error && sorted.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-12 pb-4">
            {sorted.length} articles · Scored by OFFO AI · Updated daily at 6 AM EST
          </p>
        )}
      </div>
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
      </div>
    }>
      <NewsPageInner />
    </Suspense>
  );
}
