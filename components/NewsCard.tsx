"use client";

import { ExternalLink } from "lucide-react";

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  impact_score: number;
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
};

function ScoreBadge({ score, size = "default" }: { score: number; size?: "default" | "sm" }) {
  const color =
    score >= 80
      ? "bg-green-50 text-green-700 border-green-200"
      : score >= 65
      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
      : "bg-red-50 text-red-700 border-red-200";

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
  if (variant === "compact") {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 transition-colors group"
      >
        <ScoreBadge score={article.impact_score} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
            {article.source}
          </p>
          <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
            {article.title}
          </p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
      </a>
    );
  }

  // Default (full) variant
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-4">
        <ScoreBadge score={article.impact_score} />
        <div className="flex-1 min-w-0">
          {/* Source + badges row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {article.source}
            </span>
            {article.post_worthy && (
              <span className="text-xs px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200 font-medium">
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
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors leading-snug">
              {article.title}
            </h3>
          </a>

          {/* AI summary */}
          {article.ai_summary && (
            <p className="text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
              {article.ai_summary}
            </p>
          )}

          {/* Tag chips */}
          {article.key_routine_effects && article.key_routine_effects.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {article.key_routine_effects.map((effect) => (
                <span
                  key={effect}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
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
            className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            Read article <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
