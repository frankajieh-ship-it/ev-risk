"use client";

import { CheckCircle, XCircle, Clock } from "lucide-react";

interface Props {
  make: string;
  model: string;
  year: number;
  mileage: number;
}

interface CoverageRow {
  type: string;
  limit: string;
  remainingMiles: number | null;
  remainingMonths: number | null;
  active: boolean;
  evOnly?: boolean;
}

// Months since start of the model year (Jan 1 of that year)
function monthsSinceModelYear(year: number): number {
  const start = new Date(`${year}-01-01`).getTime();
  return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24 * 30.44)));
}

const EV_MAKES = new Set(["tesla", "rivian", "lucid", "polestar", "fisker"]);
const EV_MODEL_KEYWORDS = ["bolt", "leaf", "ioniq", "ev6", "ev9", "mach-e", "mustang mache", "id.4", "id.3", "r1t", "r1s", "air", "lightning", "hummer ev", "lyriq", "blazer ev", "equinox ev", "silverado ev", "f-150 lightning", "prologue", "visiq", "ariya", "bz4x"];

function isEv(make: string, model: string): boolean {
  if (EV_MAKES.has(make.toLowerCase())) return true;
  const mo = model.toLowerCase();
  return EV_MODEL_KEYWORDS.some((kw) => mo.includes(kw));
}

// Per-make warranty terms: [bumper months, bumper miles, powertrain months, powertrain miles]
// EV battery always 96mo/100k (federal minimum). Corrosion always 60mo.
function getWarrantyTerms(make: string): { bumperMo: number; bumperMi: number; powertrainMo: number; powertrainMi: number } {
  const mk = make.toLowerCase();
  if (mk === "tesla") return { bumperMo: 48, bumperMi: 50000, powertrainMo: 96, powertrainMi: 100000 };
  if (mk === "rivian") return { bumperMo: 60, bumperMi: 60000, powertrainMo: 120, powertrainMi: 175000 };
  if (mk === "lucid") return { bumperMo: 48, bumperMi: 50000, powertrainMo: 96, powertrainMi: 130000 };
  if (mk === "hyundai" || mk === "kia") return { bumperMo: 60, bumperMi: 60000, powertrainMo: 120, powertrainMi: 100000 };
  if (mk === "genesis") return { bumperMo: 60, bumperMi: 60000, powertrainMo: 120, powertrainMi: 100000 };
  if (mk === "ford") return { bumperMo: 36, bumperMi: 36000, powertrainMo: 60, powertrainMi: 60000 };
  if (mk === "volkswagen" || mk === "vw") return { bumperMo: 48, bumperMi: 50000, powertrainMo: 60, powertrainMi: 60000 };
  if (mk === "bmw" || mk === "mini") return { bumperMo: 48, bumperMi: 50000, powertrainMo: 48, powertrainMi: 50000 };
  if (mk === "mercedes-benz" || mk === "mercedes") return { bumperMo: 48, bumperMi: 50000, powertrainMo: 48, powertrainMi: 50000 };
  if (mk === "audi") return { bumperMo: 48, bumperMi: 50000, powertrainMo: 48, powertrainMi: 50000 };
  if (mk === "toyota" || mk === "lexus") return { bumperMo: 36, bumperMi: 36000, powertrainMo: 60, powertrainMi: 60000 };
  if (mk === "honda" || mk === "acura") return { bumperMo: 36, bumperMi: 36000, powertrainMo: 60, powertrainMi: 60000 };
  if (mk === "nissan" || mk === "infiniti") return { bumperMo: 36, bumperMi: 36000, powertrainMo: 60, powertrainMi: 60000 };
  // GM family: Chevrolet, Buick, GMC, Cadillac
  return { bumperMo: 36, bumperMi: 36000, powertrainMo: 60, powertrainMi: 60000 };
}

export default function WarrantyCoverageCard({ make, model, year, mileage }: Props) {
  if (!make || !model || !year || year < 2010) return null;

  const ev = isEv(make, model);
  const terms = getWarrantyTerms(make);
  const ageMonths = monthsSinceModelYear(year);

  function row(type: string, limit: string, miLimit: number | null, moLimit: number | null, evOnly = false): CoverageRow {
    if (evOnly && !ev) return { type, limit, remainingMiles: null, remainingMonths: null, active: false, evOnly: true };
    const remMi = miLimit !== null ? miLimit - mileage : null;
    const remMo = moLimit !== null ? moLimit - ageMonths : null;
    const active = (remMi === null || remMi > 0) && (remMo === null || remMo > 0);
    return { type, limit, remainingMiles: remMi, remainingMonths: remMo, active, evOnly };
  }

  const rows: CoverageRow[] = [
    row("Basic / Bumper-to-Bumper", `${terms.bumperMo / 12} yr / ${terms.bumperMi.toLocaleString()} mi`, terms.bumperMi, terms.bumperMo),
    row("Powertrain", ev ? "8 yr / 100,000 mi" : `${terms.powertrainMo / 12} yr / ${terms.powertrainMi.toLocaleString()} mi`, ev ? 100000 : terms.powertrainMi, ev ? 96 : terms.powertrainMo),
    row("EV Battery (high voltage)", "8 yr / 100,000 mi", 100000, 96, true),
    row("Corrosion", "5 yr / unlimited mi", null, 60),
  ].filter((r) => !(r.evOnly && !ev));

  const anyActive = rows.some((r) => r.active);

  return (
    <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.01]">
      <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Warranty Coverage</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/25 text-left">
              <th className="pb-2 font-medium pr-4">Coverage</th>
              <th className="pb-2 font-medium pr-4">Limit</th>
              <th className="pb-2 font-medium pr-4">Remaining Miles</th>
              <th className="pb-2 font-medium pr-4">Remaining Time</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {rows.map((r) => {
              const miOk = r.remainingMiles === null || r.remainingMiles > 0;
              const moOk = r.remainingMonths === null || r.remainingMonths > 0;
              const expired = !r.active;
              return (
                <tr key={r.type} className={expired ? "opacity-40" : ""}>
                  <td className="py-2 pr-4 font-medium text-white/60 whitespace-nowrap">{r.type}</td>
                  <td className="py-2 pr-4 text-white/40 whitespace-nowrap">{r.limit}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {r.remainingMiles === null ? <span className="text-white/25">—</span>
                      : miOk ? <span className="text-white/60">{r.remainingMiles.toLocaleString()} mi</span>
                      : <span className="text-red-400/70">Exceeded</span>}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {r.remainingMonths === null ? <span className="text-white/25">—</span>
                      : moOk ? <span className="text-white/60">{r.remainingMonths} mo</span>
                      : <span className="text-red-400/70">Expired</span>}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    {expired
                      ? <span className="inline-flex items-center gap-1 text-red-400/60"><XCircle className="w-3 h-3" /> Expired</span>
                      : r.remainingMonths !== null && r.remainingMonths <= 6
                        ? <span className="inline-flex items-center gap-1 text-amber-400"><Clock className="w-3 h-3" /> Expiring soon</span>
                        : <span className="inline-flex items-center gap-1 text-[#00d97e]/70"><CheckCircle className="w-3 h-3" /> Active</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {anyActive && (
        <p className="text-[10px] text-white/20 mt-2">Estimate based on model year and mileage — verify coverage and transferability with the selling dealer.</p>
      )}
    </div>
  );
}
