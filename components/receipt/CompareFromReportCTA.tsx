import { ArrowRightLeft } from "lucide-react";

interface CompareFromReportCTAProps {
  reportId?: string | null;
  listingUrl?: string | null;
}

export default function CompareFromReportCTA({ reportId, listingUrl }: CompareFromReportCTAProps) {
  const aParam = reportId
    ? encodeURIComponent(reportId)
    : listingUrl
    ? encodeURIComponent(listingUrl)
    : null;

  if (!aParam) return null;

  return (
    <div className="my-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <ArrowRightLeft className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Compare with another car</p>
          <p className="text-xs text-gray-500">See how this vehicle stacks up side-by-side</p>
        </div>
      </div>
      <a
        href={`/compare?a=${aParam}`}
        className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
      >
        Compare →
      </a>
    </div>
  );
}
