"use client";

import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface EVHistoryFlag {
  type: "warning" | "caution" | "neutral";
  flag: string;
  explanation: string;
  probability: "inferred" | "likely" | "observed";
}

interface EVHistoryFlagsProps {
  flags: EVHistoryFlag[];
}

export default function EVHistoryFlags({ flags }: EVHistoryFlagsProps) {
  if (flags.length === 0) return null;

  const getFlagStyle = (type: string) => {
    switch (type) {
      case "warning":
        return {
          bg: "bg-red-50",
          border: "border-red-300",
          icon: AlertTriangle,
          iconColor: "text-red-600",
          textColor: "text-red-800",
          badge: "bg-red-100 text-red-700 border-red-300",
        };
      case "caution":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-300",
          icon: AlertCircle,
          iconColor: "text-yellow-600",
          textColor: "text-yellow-800",
          badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
        };
      case "neutral":
        return {
          bg: "bg-blue-50/50",
          border: "border-blue-200",
          icon: Info,
          iconColor: "text-blue-600",
          textColor: "text-blue-800",
          badge: "bg-blue-100 text-blue-700 border-blue-200",
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-200",
          icon: Info,
          iconColor: "text-gray-600",
          textColor: "text-gray-800",
          badge: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  const getProbabilityBadge = (probability: string) => {
    switch (probability) {
      case "observed":
        return { label: "Observed", color: "bg-green-100 text-green-700 border-green-300" };
      case "likely":
        return { label: "Likely", color: "bg-yellow-100 text-yellow-700 border-yellow-300" };
      case "inferred":
        return { label: "Inferred", color: "bg-gray-100 text-gray-700 border-gray-300" };
      default:
        return { label: "Unknown", color: "bg-gray-100 text-gray-700 border-gray-300" };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg p-8 mb-6"
    >
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          EV-Specific History Signals
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Non-mechanical risk factors specific to EVs. These aren't covered by traditional Carfax reports but matter for battery longevity and ownership experience.
        </p>
      </div>

      {/* Flags */}
      <div className="space-y-4">
        {flags.map((flag, idx) => {
          const style = getFlagStyle(flag.type);
          const Icon = style.icon;
          const probabilityBadge = getProbabilityBadge(flag.probability);

          return (
            <div
              key={idx}
              className={`${style.bg} border-2 ${style.border} rounded-xl p-5 transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  <Icon className={`w-6 h-6 ${style.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`font-bold ${style.textColor} text-base`}>
                      {flag.flag}
                    </h3>
                    <span
                      className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold border ${probabilityBadge.color} flex-shrink-0`}
                      title="Probability level: how confident we are in this assessment"
                    >
                      {probabilityBadge.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {flag.explanation}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Note */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500 leading-relaxed">
          <strong>Note:</strong> EVs aren't low-risk just because they have fewer moving parts. Battery health depends on <span className="font-semibold text-gray-700">charging habits, climate exposure, and usage patterns</span> — factors not captured by traditional vehicle history reports. You're not inheriting mechanical wear; you're inheriting <span className="font-semibold text-gray-700">usage patterns</span> that will directly impact your ownership experience.
        </p>
      </div>
    </motion.div>
  );
}
