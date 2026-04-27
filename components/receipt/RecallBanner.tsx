"use client";

import { AlertTriangle } from "lucide-react";

interface ActiveRecall {
  recall_id: string;
  title: string;
  component: string;
  ai_summary?: string | null;
}

interface RecallBannerProps {
  recalls: ActiveRecall[];
}

export default function RecallBanner({ recalls }: RecallBannerProps) {
  if (!recalls.length) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="font-semibold text-red-400 text-sm">
          Active Recall{recalls.length > 1 ? "s" : ""} on this vehicle
        </span>
      </div>
      <div className="space-y-1.5">
        {recalls.map((r) => (
          <div key={r.recall_id} className="text-sm text-red-300">
            <span className="font-medium">{r.component}</span>
            {r.ai_summary ? `: ${r.ai_summary}` : ""}
          </div>
        ))}
      </div>
      <a
        href="/workspace/garage"
        className="text-xs text-red-400 hover:underline mt-2 inline-block"
      >
        View full recall details in My Garage →
      </a>
    </div>
  );
}
