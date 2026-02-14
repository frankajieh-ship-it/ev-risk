/**
 * SamplePreview — Static mock verdict card (server component)
 *
 * Shows a YELLOW verdict example to demonstrate what the receipt
 * looks like. Includes a blurred teaser overlay.
 */

import { AlertTriangle, HelpCircle } from "lucide-react";

export default function SamplePreview() {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Mock verdict banner */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-yellow-900" />
          </div>
          <div>
            <p className="text-sm font-semibold text-yellow-900">
              YELLOW &mdash; Proceed with Caution
            </p>
            <p className="text-xs text-yellow-700 mt-0.5">
              2022 Tesla Model 3 Long Range &middot; $28,500 &middot; 47,000 mi
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Sample risk flags */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Risk Flags
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              No service records provided &mdash; request maintenance history
              before buying
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              Price is 12% below market average for this model and mileage
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              47k miles is above average for a 2022 &mdash; check for fleet or
              rideshare use
            </li>
          </ul>
        </div>

        {/* Sample must-ask questions */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Must-Ask Questions
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              Can you provide the full service history or Carfax report?
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-700">
              <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              Was this vehicle ever used for rideshare, rental, or fleet
              purposes?
            </li>
          </ul>
        </div>
      </div>

      {/* Blurred teaser overlay */}
      <div className="relative">
        <div
          className="p-5 pt-0 space-y-3 blur-sm select-none"
          aria-hidden="true"
        >
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-5/6" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
          <p className="text-sm font-medium text-gray-700 text-center px-4">
            Paste your listing above to unlock the full analysis
          </p>
        </div>
      </div>
    </div>
  );
}
