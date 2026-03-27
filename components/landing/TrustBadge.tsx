"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function TrustBadge() {
  const [totalChecks, setTotalChecks] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.total_checks && typeof data.total_checks === "number" && data.total_checks > 0) {
          setTotalChecks(data.total_checks);
        }
      })
      .catch(() => {});
  }, []);

  if (totalChecks === null) return null;

  const formatted = totalChecks >= 1000
    ? `${Math.floor(totalChecks / 100) * 100}+`
    : `${totalChecks}+`;

  return (
    <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mt-3">
      <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
      <span>Used by <strong className="text-gray-700">{formatted} buyers</strong> to check EV listings</span>
    </div>
  );
}
