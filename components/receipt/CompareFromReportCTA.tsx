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
    <div className="my-6 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/[0.07] flex items-center justify-center shrink-0">
          <ArrowRightLeft className="w-4 h-4 text-white/50" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">Compare with another car</p>
          <p className="text-xs text-white/40">See how this vehicle stacks up side-by-side</p>
        </div>
      </div>
      <a
        href={`/compare?a=${aParam}`}
        className="shrink-0 px-4 py-2 bg-[#00d97e] text-[#0d1117] text-sm font-semibold rounded-xl hover:bg-[#00c970] transition-colors"
      >
        Compare →
      </a>
    </div>
  );
}
