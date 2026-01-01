"use client";

import { motion } from "framer-motion";
import { Battery, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BatteryHealthContextProps {
  currentHealth: number;
  assessment: "typical" | "above-average" | "below-average" | "unusually-strong" | "faster-decline";
  comparisonText: string;
  benchmarkNote: string;
}

export default function BatteryHealthContext({
  currentHealth,
  assessment,
  comparisonText,
  benchmarkNote,
}: BatteryHealthContextProps) {
  const getAssessmentStyle = () => {
    switch (assessment) {
      case "unusually-strong":
        return {
          bg: "bg-green-50",
          border: "border-green-300",
          icon: TrendingUp,
          iconColor: "text-green-600",
          textColor: "text-green-800",
          badge: "bg-green-100 text-green-700 border-green-300",
        };
      case "above-average":
        return {
          bg: "bg-green-50/50",
          border: "border-green-200",
          icon: TrendingUp,
          iconColor: "text-green-500",
          textColor: "text-green-700",
          badge: "bg-green-50 text-green-700 border-green-200",
        };
      case "typical":
        return {
          bg: "bg-blue-50/30",
          border: "border-blue-200",
          icon: Minus,
          iconColor: "text-blue-600",
          textColor: "text-blue-800",
          badge: "bg-blue-100 text-blue-700 border-blue-200",
        };
      case "below-average":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          icon: TrendingDown,
          iconColor: "text-yellow-600",
          textColor: "text-yellow-800",
          badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
        };
      case "faster-decline":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          icon: TrendingDown,
          iconColor: "text-red-600",
          textColor: "text-red-800",
          badge: "bg-red-100 text-red-700 border-red-200",
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-200",
          icon: Battery,
          iconColor: "text-gray-600",
          textColor: "text-gray-800",
          badge: "bg-gray-100 text-gray-700 border-gray-200",
        };
    }
  };

  const style = getAssessmentStyle();
  const Icon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`${style.bg} border-2 ${style.border} rounded-xl p-5 inline-flex items-center gap-4`}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        <Icon className={`w-6 h-6 ${style.iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-bold ${style.textColor} text-lg`}>
            {comparisonText}
          </h4>
        </div>
        <p className="text-xs text-gray-600 italic">
          {benchmarkNote}
        </p>
      </div>

      {/* Badge */}
      <div className="flex-shrink-0">
        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${style.badge}`}>
          {currentHealth.toFixed(0)}% Health
        </span>
      </div>
    </motion.div>
  );
}
