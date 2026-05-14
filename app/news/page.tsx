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
}[] = [
  { label: "All",         value: "all",              icon: <Radio className="w-3.5 h-3.5" /> },
  { label: "Recalls",     value: "recall",            icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { label: "Used Market", value: "used_market",       icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { label: "Charging",    value: "charging_network",  icon: <Zap className="w-3.5 h-3.5" /> },
  { label: "Ownership",   value: "routine_impact",    icon: <Battery className="w-3.5 h-3.5" /> },
];

const CATEGORY_BADGE: Record<string, string> = {
  recall:           "bg-red-500/10 text-red-400 border-red-500/20",
  used_market:      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  charging_network: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  routine_impact:   "bg-white/[0.06] text-white/40 border-white/10",
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
// Article cards
// ---------------------------------------------------------------------------

function FeaturedCard({ article }: { article: NewsArticle }) {
  const catLabel = article.category ? CATEGORY_LABEL[article.category] : null;
  const catBadge = article.category ? CATEGORY_BADGE[article.category] : "";
  const isRecall = article.category === "recall";

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white/[0.04] border border-white/[0.10] rounded-2xl p-6 md:p-8 hover:border-white/20 hover:bg-white/[0.06] transition-all"
    >
      <div className="flex items-center gap-2 mb-4">
        {catLabel && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catBadge}`}>
            {catLabel}
          </span>
        )}
        {isRecall && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Safety Alert
          </span>
        )}
        {article.impact_score >= 80 && !isRecall && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-[#00d97e]/10 text-[#00d97e] border-[#00d97e]/20">
            Top Story
          </span>
        )}
        <span className="text-xs text-white/25 ml-auto">{timeAgo(article.scored_at)}</span>
      </div>

      <h2 className="text-xl md:text-2xl font-bold text-white leading-snug mb-3 group-hover:text-[#00d97e] transition-colors">
        {article.title}
      </h2>

      {article.ai_summary && (
        <p className="text-white/50 leading-relaxed mb-5">{article.ai_summary}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-white/30 uppercase tracking-wide">{article.source}</span>
          {article.key_routine_effects && article.key_routine_effects.length > 0 && (
            <div className="flex gap-1.5">
              {article.key_routine_effects.slice(0, 3).map((e) => (
                <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">
                  {EFFECT_LABELS[e] ?? e.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-sm font-semibold text-[#00d97e]/70 flex items-center gap-1.5 group-hover:text-[#00d97e] transition-colors">
          Read <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </div>
    </a>
  );
}

function ArticleCard({ article }: { article: NewsArticle }) {
  const catLabel = article.category ? CATEGORY_LABEL[article.category] : null;
  const catBadge = article.category ? CATEGORY_BADGE[article.category] : "";

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:border-white/20 hover:bg-white/[0.05] transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {catLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0 rounded-full border ${catBadge}`}>
              {catLabel}
            </span>
          )}
          <span className="text-xs text-white/25">{timeAgo(article.scored_at)}</span>
          <span className="text-white/15">·</span>
          <span className="text-xs font-medium text-white/25 uppercase tracking-wide">{article.source}</span>
        </div>
        <h3 className="text-sm font-semibold text-white/80 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {article.title}
        </h3>
        {article.ai_summary && (
          <p className="text-xs text-white/40 mt-1 line-clamp-2 leading-relaxed">{article.ai_summary}</p>
        )}
        {article.key_routine_effects && article.key_routine_effects.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {article.key_routine_effects.slice(0, 3).map((e) => (
              <span key={e} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-white/30">
                {EFFECT_LABELS[e] ?? e.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
      <ExternalLink className="w-4 h-4 text-white/15 group-hover:text-[#00d97e]/60 flex-shrink-0 mt-0.5 transition-colors" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Inline CTA nudge — contextual, not generic
// ---------------------------------------------------------------------------

function CtaNudge({ context }: { context: "recall" | "used_market" | "generic" }) {
  const copy = {
    recall: {
      headline: "See if your listing has open recalls",
      sub: "Paste a CarGurus or AutoTrader URL — we check NHTSA, battery, title, and price in seconds.",
      cta: "Check a listing free",
    },
    used_market: {
      headline: "Know if your deal still holds as prices shift",
      sub: "Get a live price comparison against similar listings before you make an offer.",
      cta: "Analyze a listing free",
    },
    generic: {
      headline: "See how this affects the listing you're watching",
      sub: "Paste any listing URL — recalls, battery, price vs. comparables, and 3 negotiation scripts.",
      cta: "Analyze a listing free",
    },
  }[context];

  return (
    <div className="my-4 p-5 rounded-2xl bg-[#00d97e]/[0.06] border border-[#00d97e]/20 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-white/80 mb-0.5">{copy.headline}</p>
        <p className="text-xs text-white/40 leading-relaxed">{copy.sub}</p>
      </div>
      <Link
        href="/"
        className="flex-shrink-0 px-4 py-2 rounded-xl bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors whitespace-nowrap"
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

  const sorted = useMemo(() =>
    [...articles]
      .filter(a => a.impact_score >= 60)
      .sort((a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()),
    [articles]
  );

  const featured = sorted[0] ?? null;
  const rest = sorted.slice(1);

  const ctaContext: "recall" | "used_market" | "generic" =
    activeCategory === "recall" ? "recall" :
    activeCategory === "used_market" ? "used_market" : "generic";

  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 bg-[#0d1117]/90 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/offo-logo.png" alt="OFFO" width={200} height={103} className="w-28 sm:w-32 h-auto" priority />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="hidden sm:block text-sm text-white/40 hover:text-white/70 transition-colors">
              Blog
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors"
            >
              Analyze a listing
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <header className="border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#00d97e]" />
            <span className="text-xs font-semibold text-[#00d97e] uppercase tracking-widest">EV News</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight mb-3">
            What&apos;s happening in the used EV market
          </h1>
          <p className="text-white/40 text-[0.9375rem] leading-relaxed max-w-xl">
            Recalls, pricing shifts, charging updates, and ownership news — scored by OFFO AI and updated every morning.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Category tabs ── */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-8 border-b border-white/[0.06]">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleCategoryChange(tab.value)}
              className={`flex items-center gap-1.5 flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeCategory === tab.value
                  ? "border-[#00d97e] text-[#00d97e]"
                  : "border-transparent text-white/40 hover:text-white/70 hover:border-white/20"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-white/20">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="text-center py-24 text-red-400/70 text-sm">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-white/30 text-sm">No articles found. Check back tomorrow.</p>
            <p className="text-white/15 text-xs mt-1">Updated daily at 6 AM EST.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* ── Main feed ── */}
            <div className="lg:col-span-2 space-y-3">
              {featured && <FeaturedCard article={featured} />}
              {rest.map((article, i) => (
                <div key={article.id}>
                  {i === 4 && <CtaNudge context={ctaContext} />}
                  <ArticleCard article={article} />
                </div>
              ))}
              {rest.length < 4 && <CtaNudge context={ctaContext} />}
            </div>

            {/* ── Sidebar ── */}
            <aside className="space-y-4">
              <div className="sticky top-20 space-y-4">

                {/* Analyze CTA */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <p className="text-xs font-semibold text-[#00d97e] uppercase tracking-wide mb-2">Free tool</p>
                  <h3 className="text-base font-bold text-white mb-1.5">
                    See how today&apos;s news affects your listing
                  </h3>
                  <p className="text-sm text-white/40 mb-4 leading-relaxed">
                    Paste any CarGurus or AutoTrader URL — we check recalls, battery, title history, price vs. comparables, and generate 3 negotiation scripts.
                  </p>
                  <Link
                    href="/"
                    className="block w-full text-center py-2.5 rounded-xl bg-[#00d97e] text-[#0d1117] text-sm font-semibold hover:bg-[#00c970] transition-colors"
                  >
                    Analyze a listing free →
                  </Link>
                  <p className="text-xs text-white/20 text-center mt-2">No account needed · 30 seconds</p>
                </div>

                {/* Topic nav */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                  <p className="text-xs font-semibold text-white/30 uppercase tracking-wide mb-3">Browse by topic</p>
                  <div className="space-y-0.5">
                    {CATEGORY_TABS.filter(t => t.value !== "all").map((tab) => (
                      <button
                        key={tab.value}
                        onClick={() => handleCategoryChange(tab.value)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                          activeCategory === tab.value
                            ? "bg-[#00d97e]/10 text-[#00d97e]"
                            : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
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
          <p className="text-center text-xs text-white/15 mt-12 pb-4">
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
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#00d97e] animate-spin" />
      </div>
    }>
      <NewsPageInner />
    </Suspense>
  );
}
