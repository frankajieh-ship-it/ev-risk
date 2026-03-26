"use client";

import { ExternalLink, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { TITLE_RULES, guessStateFromZip, STATE_CODES, type StateCode } from "@/lib/copart-title-rules";

interface TitleFlagsCardProps {
  zip?: string | null;
}

const IMPACT_CONFIG = {
  severe: { label: "Severe impact", badgeClass: "bg-red-100 text-red-700 border-red-200", icon: ShieldAlert, iconClass: "text-red-500" },
  moderate: { label: "Moderate impact", badgeClass: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle, iconClass: "text-amber-500" },
  mild: { label: "Mild impact", badgeClass: "bg-green-100 text-green-700 border-green-200", icon: ShieldCheck, iconClass: "text-green-500" },
};

export default function TitleFlagsCard({ zip }: TitleFlagsCardProps) {
  const userState = guessStateFromZip(zip);

  // Build display order: user's state first (if detected), then sorted by impact severity
  const severityOrder = { severe: 0, moderate: 1, mild: 2 };
  const allCodes = [...STATE_CODES] as StateCode[];

  const sorted = allCodes.sort((a, b) => {
    // User's state always first
    if (a === userState) return -1;
    if (b === userState) return 1;
    return severityOrder[TITLE_RULES[a].resale_value_impact] - severityOrder[TITLE_RULES[b].resale_value_impact];
  });

  const displayCodes = sorted.slice(0, 5);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-gray-500" />
        <h3 className="text-base font-bold text-gray-900">Rebuilt Title Requirements</h3>
      </div>

      {userState && (
        <p className="text-xs text-gray-500">
          Showing your state ({TITLE_RULES[userState].state}) first based on ZIP code.
        </p>
      )}

      <div className="space-y-3">
        {displayCodes.map((code) => {
          const rule = TITLE_RULES[code];
          const cfg = IMPACT_CONFIG[rule.resale_value_impact];
          const Icon = cfg.icon;
          const isUserState = code === userState;

          return (
            <div
              key={code}
              className={`rounded-xl border p-3 ${isUserState ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.iconClass}`} />
                  <span className="text-sm font-semibold text-gray-900">{rule.state}</span>
                  {isUserState && (
                    <span className="text-xs text-blue-600 font-medium">(your state)</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}>
                    {cfg.label}
                  </span>
                  {rule.inspection_required && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-200">
                      Inspection req.
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{rule.notes}</p>
              <a
                href={rule.dmv_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-3 h-3" />
                {rule.state} DMV info
              </a>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        All 50 states allow rebuilt titles with disclosure. Rules shown are for buyer guidance only — verify with your state DMV before purchasing.
      </p>
    </div>
  );
}
