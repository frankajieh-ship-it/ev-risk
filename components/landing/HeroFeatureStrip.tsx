import { Check } from "lucide-react";

const FREE_FEATURES = [
  "Verdict",
  "Top 3 risks",
  "3 seller questions",
];

const FULL_FEATURES = [
  "Full breakdown",
  "Negotiation script",
  "Checklist + PDF export",
  "Compare support",
];

export default function HeroFeatureStrip() {
  return (
    <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 sm:divide-x sm:divide-gray-200">
        {/* Free column */}
        <div className="sm:pr-6 flex-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Free</p>
          <ul className="space-y-1.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Full analysis column */}
        <div className="sm:pl-6 flex-1">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-2">Full analysis — free</p>
          <ul className="space-y-1.5">
            {FULL_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
