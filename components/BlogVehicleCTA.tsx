import Link from "next/link";

interface BlogVehicleCTAProps {
  make: string;
  model: string;
  year?: string;
}

export default function BlogVehicleCTA({ make, model, year }: BlogVehicleCTAProps) {
  const params = new URLSearchParams({ make, model, ...(year ? { year } : {}) });
  const label = [year, make, model].filter(Boolean).join(" ");
  return (
    <div className="my-8 p-5 rounded-xl border border-blue-100 bg-blue-50">
      <p className="text-sm font-semibold text-blue-900 mb-1">
        Looking at a {label}?
      </p>
      <p className="text-sm text-blue-700 mb-3">
        Paste your listing and get battery health, recalls, price check, and 3 negotiation scripts — free, in 10 seconds.
      </p>
      <Link
        href={`/receipt?${params.toString()}`}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        Analyze this {make} {model} →
      </Link>
    </div>
  );
}
