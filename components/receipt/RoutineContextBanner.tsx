import Link from "next/link";

const LABEL_STYLES: Record<string, { badge: string; dot: string }> = {
  "Great Fit":   { badge: "bg-green-500/10 text-green-400 border-green-500/20",  dot: "bg-green-400" },
  "Good Fit":    { badge: "bg-green-500/10 text-green-400 border-green-500/20",  dot: "bg-green-400" },
  "Mixed Fit":   { badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  "High Friction": { badge: "bg-red-500/10 text-red-400 border-red-500/20",       dot: "bg-red-400" },
};

interface RoutineContextBannerProps {
  label: string;
  score: number;
  summary: string;
}

export default function RoutineContextBanner({ label, score, summary }: RoutineContextBannerProps) {
  const style = LABEL_STYLES[label] ?? LABEL_STYLES["Mixed Fit"];

  return (
    <div className="my-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">
            Personalized for your EV routine
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {label}
            </span>
            <span className="text-xs text-white/40">{score}/100</span>
          </div>
          <p className="text-sm text-white/70">{summary}</p>
        </div>
        <Link
          href="/#fit-check"
          className="shrink-0 text-xs text-white/40 hover:text-white/70 hover:underline whitespace-nowrap"
        >
          Update routine →
        </Link>
      </div>
    </div>
  );
}
