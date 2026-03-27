import { Check } from "lucide-react";
import { PRICING_PLANS } from "@/lib/pricing-plans";

export default function FreePaidMatrix() {
  const { free, full_report, subscription } = PRICING_PLANS;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {/* Free column */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {free.label}
        </p>
        <p className="text-2xl font-bold text-gray-900 mb-3">Free</p>
        <ul className="space-y-2">
          {free.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <Check className="w-4 h-4 text-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Paid column */}
      <div className="rounded-xl border-2 border-blue-600 bg-blue-50 p-4 relative">
        <span className="absolute top-3 right-3 text-[10px] font-semibold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          one-time
        </span>
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
          {full_report.label}
        </p>
        <p className="text-2xl font-bold text-gray-900 mb-3">
          ${full_report.price_usd}
        </p>
        <ul className="space-y-2">
          {full_report.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
              <Check className="w-4 h-4 text-blue-600 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Subscription row — only if enabled */}
      {subscription.enabled && (
        <div className="sm:col-span-2 rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-700">{subscription.label}</p>
            <p className="text-xs text-gray-500">Unlimited reports, all features</p>
          </div>
          <p className="text-lg font-bold text-gray-900 shrink-0">
            ${subscription.price_usd}
            <span className="text-xs font-normal text-gray-500">/mo</span>
          </p>
        </div>
      )}
    </div>
  );
}
