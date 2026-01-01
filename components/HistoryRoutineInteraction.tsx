"use client";

import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp, Clock } from "lucide-react";

interface InteractionSignal {
  type: "friction" | "buffer" | "low-stress";
  headline: string;
  explanation: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
}

interface HistoryRoutineInteractionProps {
  signals: InteractionSignal[];
}

export default function HistoryRoutineInteraction({ signals }: HistoryRoutineInteractionProps) {
  const getSignalIcon = (type: string) => {
    switch (type) {
      case "friction":
        return AlertTriangle;
      case "buffer":
        return TrendingUp;
      case "low-stress":
        return Clock;
      default:
        return AlertTriangle;
    }
  };

  const getSignalStyle = (type: string) => {
    switch (type) {
      case "friction":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          iconColor: "text-red-600",
          textColor: "text-red-800",
        };
      case "buffer":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          iconColor: "text-yellow-600",
          textColor: "text-yellow-800",
        };
      case "low-stress":
        return {
          bg: "bg-green-50",
          border: "border-green-200",
          iconColor: "text-green-600",
          textColor: "text-green-800",
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-200",
          iconColor: "text-gray-600",
          textColor: "text-gray-800",
        };
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "HIGH":
        return "bg-red-100 text-red-700 border-red-300";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "LOW":
        return "bg-blue-100 text-blue-700 border-blue-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
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
          History × Routine Interaction
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          How this car's history will feel in your daily life. This is the gap between what Carfax tells you (what happened)
          and what you'll actually experience (what it will feel like).
        </p>
      </div>

      {/* Signals */}
      <div className="space-y-4">
        {signals.map((signal, idx) => {
          const Icon = getSignalIcon(signal.type);
          const style = getSignalStyle(signal.type);

          return (
            <div
              key={idx}
              className={`${style.bg} border-2 ${style.border} rounded-xl p-5 transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <Icon className={`w-6 h-6 ${style.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`font-bold ${style.textColor} text-lg`}>
                      {signal.headline}
                    </h3>
                    <span
                      className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold border ${getImpactBadge(signal.impact)} flex-shrink-0`}
                    >
                      {signal.impact} IMPACT
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {signal.explanation}
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
          <strong>Note:</strong> This section combines vehicle history data (if available) with your reported routine.
          Without battery health reports or charging history, some interactions are inferred from age and usage patterns.
        </p>
      </div>
    </motion.div>
  );
}
