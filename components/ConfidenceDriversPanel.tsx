"use client";

import { motion } from "framer-motion";
import { Shield, Database, History, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ConfidenceDriver {
  category: "data-completeness" | "history-clarity" | "routine-predictability";
  strength: "high" | "medium" | "low";
  reason: string;
}

interface ConfidenceDriversPanelProps {
  drivers: ConfidenceDriver[];
  overallConfidence: "High" | "Medium" | "Low";
}

export default function ConfidenceDriversPanel({ drivers, overallConfidence }: ConfidenceDriversPanelProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "data-completeness":
        return Database;
      case "history-clarity":
        return History;
      case "routine-predictability":
        return Zap;
      default:
        return Shield;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "data-completeness":
        return "Data Completeness";
      case "history-clarity":
        return "History Clarity";
      case "routine-predictability":
        return "Routine Predictability";
      default:
        return category;
    }
  };

  const getStrengthStyle = (strength: string) => {
    switch (strength) {
      case "high":
        return {
          icon: TrendingUp,
          iconColor: "text-green-600",
          textColor: "text-green-800",
          bgColor: "bg-green-50",
          borderColor: "border-green-300",
          badge: "bg-green-100 text-green-700 border-green-300",
        };
      case "medium":
        return {
          icon: Minus,
          iconColor: "text-yellow-600",
          textColor: "text-yellow-800",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-300",
          badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
        };
      case "low":
        return {
          icon: TrendingDown,
          iconColor: "text-red-600",
          textColor: "text-red-800",
          bgColor: "bg-red-50",
          borderColor: "border-red-300",
          badge: "bg-red-100 text-red-700 border-red-300",
        };
      default:
        return {
          icon: Minus,
          iconColor: "text-gray-600",
          textColor: "text-gray-800",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-300",
          badge: "bg-gray-100 text-gray-700 border-gray-300",
        };
    }
  };

  const getOverallConfidenceStyle = () => {
    switch (overallConfidence) {
      case "High":
        return {
          bg: "bg-green-50",
          border: "border-green-300",
          textColor: "text-green-800",
          badge: "bg-green-100 text-green-700 border-green-300",
        };
      case "Medium":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-300",
          textColor: "text-yellow-800",
          badge: "bg-yellow-100 text-yellow-700 border-yellow-300",
        };
      case "Low":
        return {
          bg: "bg-red-50",
          border: "border-red-300",
          textColor: "text-red-800",
          badge: "bg-red-100 text-red-700 border-red-300",
        };
      default:
        return {
          bg: "bg-gray-50",
          border: "border-gray-300",
          textColor: "text-gray-800",
          badge: "bg-gray-100 text-gray-700 border-gray-300",
        };
    }
  };

  const overallStyle = getOverallConfidenceStyle();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg p-8 mb-6"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              Why We're Confident (or Not)
            </h2>
          </div>
          <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${overallStyle.badge}`}>
            {overallConfidence} Confidence
          </span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Transparency in how we assess this vehicle. Confidence reflects data completeness, history clarity, and routine predictability — not guarantees.
        </p>
      </div>

      {/* Drivers */}
      <div className="space-y-4">
        {drivers.map((driver, idx) => {
          const CategoryIcon = getCategoryIcon(driver.category);
          const strengthStyle = getStrengthStyle(driver.strength);
          const StrengthIcon = strengthStyle.icon;

          return (
            <div
              key={idx}
              className={`${strengthStyle.bgColor} border-2 ${strengthStyle.borderColor} rounded-xl p-5 transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-4">
                {/* Category Icon */}
                <div className="flex-shrink-0">
                  <CategoryIcon className="w-6 h-6 text-blue-600" />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-gray-900 text-base">
                      {getCategoryLabel(driver.category)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <StrengthIcon className={`w-5 h-5 ${strengthStyle.iconColor}`} />
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${strengthStyle.badge}`}>
                        {driver.strength.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {driver.reason}
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
          <strong>Note:</strong> Users trust systems that explain themselves. This panel shows exactly what data we have, what we're missing, and how that affects our confidence in the assessment.
        </p>
      </div>
    </motion.div>
  );
}
