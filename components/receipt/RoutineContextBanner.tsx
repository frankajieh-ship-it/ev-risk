import Link from "next/link";

const LABEL_STYLES: Record<string, { badge: string; dot: string }> = {
  "Great Fit":   { badge: "bg-green-100 text-green-800 border-green-300",  dot: "bg-green-500" },
  "Good Fit":    { badge: "bg-green-100 text-green-800 border-green-300",  dot: "bg-green-400" },
  "Mixed Fit":   { badge: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-400" },
  "High Friction": { badge: "bg-red-100 text-red-800 border-red-300",       dot: "bg-red-500" },
};

interface RoutineContextBannerProps {
  label: string;
  score: number;
  summary: string;
}

export default function RoutineContextBanner({ label, score, summary }: RoutineContextBannerProps) {
  const style = LABEL_STYLES[label] ?? LABEL_STYLES["Mixed Fit"];

  return (
    <div className="my-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">
            Personalized for your EV routine
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${style.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {label}
            </span>
            <span className="text-xs text-gray-500">{score}/100</span>
          </div>
          <p className="text-sm text-gray-700">{summary}</p>
        </div>
        <Link
          href="/#fit-check"
          className="shrink-0 text-xs text-blue-500 hover:text-blue-700 hover:underline whitespace-nowrap"
        >
          Update routine →
        </Link>
      </div>
    </div>
  );
}
