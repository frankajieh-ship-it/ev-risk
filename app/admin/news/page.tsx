"use client";

/**
 * /admin/news — OFFO Routine Impact News Digest
 *
 * Shows today's AI-scored EV news articles from the daily pipeline.
 * Lets the admin generate X/Facebook/Reddit posts with one click.
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ExternalLink, Loader2, AlertTriangle, Newspaper } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  article_id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string | null;
  impact_score: number;
  is_routine_impact: boolean;
  key_routine_effects: string[] | null;
  ai_summary: string | null;
  post_worthy: boolean;
  scored_at: string | null;
}

interface XTweet { tweet: number; text: string }
interface GeneratedPosts {
  x_thread: XTweet[];
  facebook: { text: string; suggested_image_prompt?: string };
  reddit: { title: string; body: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EFFECT_EMOJI: Record<string, string> = {
  charging: "⚡",
  winter: "❄️",
  battery_daily_use: "🔋",
  recall: "🚨",
  infrastructure: "🏗️",
  range: "📍",
  cost: "💰",
};

function scoreColors(score: number) {
  if (score >= 80) return { badge: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-500" };
  if (score >= 65) return { badge: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" };
  return { badge: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-400" };
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticleCard({ article, index }: { article: Article; index: number }) {
  const { badge } = scoreColors(article.impact_score);
  const effects = article.key_routine_effects ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 hover:border-gray-300 transition-colors">
      {/* Score badge */}
      <div className={`shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center ${badge}`}>
        <span className="text-xl font-bold leading-none">{article.impact_score}</span>
        <span className="text-[10px] mt-0.5 opacity-70">score</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {article.source && (
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {article.source}
              </span>
            )}
            <p className="font-semibold text-gray-900 leading-snug mt-0.5">{article.title}</p>
          </div>
          {article.post_worthy && (
            <span className="shrink-0 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
              post-worthy
            </span>
          )}
        </div>

        {article.ai_summary && (
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{article.ai_summary}</p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {effects.map((e) => (
            <span key={e} className="text-xs text-gray-500 flex items-center gap-0.5">
              <span>{EFFECT_EMOJI[e] ?? "•"}</span>
              <span>{e.replace(/_/g, " ")}</span>
            </span>
          ))}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            Read article <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Generated Posts Output ───────────────────────────────────────────────────

function PostsOutput({ posts }: { posts: GeneratedPosts }) {
  const [activeTab, setActiveTab] = useState<"x" | "fb" | "reddit">("x");

  const tabs = [
    { id: "x" as const, label: "𝕏 X Thread" },
    { id: "fb" as const, label: "📘 Facebook" },
    { id: "reddit" as const, label: "💬 Reddit" },
  ];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-white border-b-2 border-blue-600 text-blue-700"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 bg-white space-y-3">
        {activeTab === "x" && (
          <>
            {(posts.x_thread ?? []).map((tweet) => (
              <div key={tweet.tweet}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500">Tweet {tweet.tweet}</span>
                  <span className={`text-xs font-mono ${tweet.text.length > 280 ? "text-red-600" : "text-gray-400"}`}>
                    {tweet.text.length}/280
                  </span>
                </div>
                <textarea
                  defaultValue={tweet.text}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            ))}
          </>
        )}

        {activeTab === "fb" && (
          <>
            <textarea
              defaultValue={posts.facebook?.text ?? ""}
              rows={7}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
            {posts.facebook?.suggested_image_prompt && (
              <p className="text-xs text-gray-500">
                <span className="font-semibold">📸 Image prompt:</span> {posts.facebook.suggested_image_prompt}
              </p>
            )}
          </>
        )}

        {activeTab === "reddit" && (
          <>
            <input
              defaultValue={posts.reddit?.title ?? ""}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              placeholder="Reddit title"
            />
            <textarea
              defaultValue={posts.reddit?.body ?? ""}
              rows={10}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoursBack, setHoursBack] = useState(48);
  const [minScore, setMinScore] = useState(65);
  const [postWorthyOnly, setPostWorthyOnly] = useState(false);
  const [topN, setTopN] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPosts | null>(null);
  const [genError, setGenError] = useState("");

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/news?hours=${hoursBack}&limit=100`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setArticles(data.articles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, [hoursBack]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Client-side filtering
  const filtered = articles
    .filter((a) => a.impact_score >= minScore)
    .filter((a) => !postWorthyOnly || a.post_worthy);

  async function handleGenerate() {
    const topArticles = filtered.slice(0, topN);
    if (!topArticles.length) return;

    setGenerating(true);
    setGenError("");
    setGeneratedPosts(null);

    try {
      const res = await fetch("/api/admin/news/generate-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: topArticles }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGeneratedPosts(data);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Routine Impact News Digest</h1>
          </div>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
        <button
          onClick={fetchArticles}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Time range
            </label>
            <select
              value={hoursBack}
              onChange={(e) => setHoursBack(Number(e.target.value))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {[12, 24, 48, 72, 168].map((h) => (
                <option key={h} value={h}>
                  Last {h === 168 ? "7 days" : h === 24 ? "24 hours" : `${h} hours`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Min impact score
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-gray-700 w-8 text-right">{minScore}</span>
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={postWorthyOnly}
                onChange={(e) => setPostWorthyOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Post-worthy only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Articles */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">No articles found</p>
          <p className="text-sm mt-1">
            {articles.length === 0
              ? "The daily pipeline hasn't run yet. Trigger it from GitHub Actions or run it locally."
              : "Try lowering the minimum score filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <strong>{filtered.length}</strong> article{filtered.length !== 1 ? "s" : ""}
              {articles.length !== filtered.length && (
                <span className="text-gray-400"> (of {articles.length} total)</span>
              )}
            </p>
          </div>

          <div className="space-y-3">
            {filtered.map((article, i) => (
              <ArticleCard key={article.id} article={article} index={i + 1} />
            ))}
          </div>
        </>
      )}

      {/* Generate Posts section */}
      {filtered.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Generate Posts</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Creates X thread, Facebook post, and Reddit post from the top scored articles.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm text-gray-600 shrink-0">Use top</label>
              <input
                type="range"
                min={3}
                max={Math.min(10, filtered.length)}
                value={Math.min(topN, filtered.length)}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-mono text-gray-700 w-6 text-center">
                {Math.min(topN, filtered.length)}
              </span>
              <label className="text-sm text-gray-600 shrink-0">articles</label>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "✨ Generate Posts"
              )}
            </button>
          </div>

          {genError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {genError}
            </div>
          )}

          {generatedPosts && <PostsOutput posts={generatedPosts} />}
        </div>
      )}
    </div>
  );
}
