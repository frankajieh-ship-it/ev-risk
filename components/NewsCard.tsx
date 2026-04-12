"use client";

import { ExternalLink } from "lucide-react";

export type NewsCategory = "routine_impact" | "recall" | "used_market" | "charging_network";

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  impact_score: number;
  category?: NewsCategory;
  key_routine_effects: string[] | null;
  ai_summary: string | null;
  post_worthy: boolean;
  scored_at: string;
}

interface NewsCardProps {
  article: NewsArticle;
  variant?: "default" | "compact";
}

const EFFECT_LABELS: Record<string, string> = {
  battery_daily_use: "🔋 Battery",
  charging:          "⚡ Charging",
  range:             "📍 Range",
  recall:            "⚠️ Recall",
  winter:            "❄️ Winter",
  infrastructure:    "🏗️ Infrastructure",
  cost:              "💰 Cost",
  software:          "📲 Software",
  used_pricing:      "💲 Used Price",
  depreciation:      "📉 Depreciation",
  network_reliability: "📶 Reliability",
};

const CATEGORY_BADGE: Record<NewsCategory, { label: string; className: string }> = {
  recall:           { label: "🔴 Recall",      className: "bg-red-500/10 text-red-400 border-red-500/20" },
  used_market:      { label: "💲 Used Market", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  charging_network: { label: "⚡ Charging",    className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  routine_impact:   { label: "📡 Routine",     className: "bg-white/[0.06] text-white/40 border-white/10" },
};

function ScoreBadge({ score, size = "default" }: { score: number; size?: "default" | "sm" }) {
  const color =
    score >= 80
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : score >= 65
      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      : "bg-white/[0.06] text-white/40 border-white/10";

  return (
    <div
      className={`flex-shrink-0 flex flex-col items-center justify-center border rounded-xl ${color} ${
        size === "sm" ? "w-10 h-10 text-sm" : "w-14 h-14 text-lg"
      }`}
    >
      <span className="font-bold leading-none">{score}</span>
      {size !== "sm" && <span className="text-xs opacity-70 mt-0.5">/ 100</span>}
    </div>
  );
}

export default function NewsCard({ article, variant = "default" }: NewsCardProps) {
  const catBadge = article.category ? CATEGORY_BADGE[article.category] : null;

  if (variant === "compact") {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 p-3 bg-white/[0.04] rounded-xl border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06] transition-colors group"
      >
        <ScoreBadge score={article.impact_score} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wide">
              {article.source}
            </p>
            {catBadge && (
              <span className={`text-[10px] px-1.5 py-0 rounded-full border font-medium ${catBadge.className}`}>
                {catBadge.label}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-white/80 line-clamp-2 leading-snug">
            {article.title}
          </p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 flex-shrink-0 mt-1 transition-colors" />
      </a>
    );
  }

  // Default (full) variant
  return (
    <div className="bg-white/[0.04] rounded-2xl border border-white/[0.08] p-4 hover:border-white/20 hover:bg-white/[0.06] transition-all">
      <div className="flex items-start gap-4">
        <ScoreBadge score={article.impact_score} />
        <div className="flex-1 min-w-0">
          {/* Source + badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-semibold text-white/30 uppercase tracking-wide">
              {article.source}
            </span>
            {catBadge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${catBadge.className}`}>
                {catBadge.label}
              </span>
            )}
            {article.post_worthy && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-[#00d97e]/10 text-[#00d97e] border-[#00d97e]/20 font-medium">
                Post-worthy
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <h3 className="text-sm font-semibold text-white/80 line-clamp-2 group-hover:text-white transition-colors leading-snug">
              {article.title}
            </h3>
          </a>

          {/* AI summary */}
          {article.ai_summary && (
            <p className="text-sm text-white/50 mt-1.5 line-clamp-2 leading-relaxed">
              {article.ai_summary}
            </p>
          )}

          {/* Tag chips */}
          {article.key_routine_effects && article.key_routine_effects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {article.key_routine_effects.map((effect) => (
                <span
                  key={effect}
                  className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40"
                >
                  {EFFECT_LABELS[effect] ?? effect.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}

          {/* Read link */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-[#00d97e]/70 hover:text-[#00d97e] transition-colors"
          >
            Read article <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
