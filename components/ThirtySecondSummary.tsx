"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, XCircle, TrendingUp, Shield, Lightbulb } from "lucide-react";

interface ThirtySecondSummaryProps {
  fitSignal: "Good Fit" | "Good Fit — with conditions" | "Conditional Fit" | "High Friction";
  oneLiner: string;
  becomesAnnoyingIf: string;
  whatBreaksFirst: string[];
  confidence: "High" | "Medium" | "Low";
  confidenceWhy: string[];
  topDrivers: Array<{ label: string; impact: "HIGH" | "MEDIUM" | "LOW" }>;
  planB: string[];
}

export default function ThirtySecondSummary({
  fitSignal,
  oneLiner,
  becomesAnnoyingIf,
  whatBreaksFirst,
  confidence,
  confidenceWhy,
  topDrivers,
  planB,
}: ThirtySecondSummaryProps) {
  // Determine colors and icons based on fit signal
  const getFitSignalStyle = () => {
    switch (fitSignal) {
      case "Good Fit":
      case "Good Fit — with conditions":
        return {
          bg: "bg-green-50/50", // Softened green background
          border: "border-green-200",
          text: "text-green-800",
          icon: CheckCircle,
          iconColor: "text-green-600",
        };
      case "Conditional Fit":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          text: "text-yellow-800",
          icon: AlertTriangle,
          iconColor: "text-yellow-600",
        };
      case "High Friction":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-800",
          icon: XCircle,
          iconColor: "text-red-600",
        };
    }
  };

  const style = getFitSignalStyle();
  const Icon = style.icon;

  const getImpactBadgeStyle = (impact: "HIGH" | "MEDIUM" | "LOW") => {
    switch (impact) {
      case "HIGH":
        return "bg-red-100 text-red-700 border-red-200";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "LOW":
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  const getConfidenceBadgeStyle = () => {
    switch (confidence) {
      case "High":
        return "bg-green-100 text-green-700 border-green-200";
      case "Medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Low":
        return "bg-red-100 text-red-700 border-red-200";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-2xl border-2 border-gray-200 shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 px-6 py-4">
        <h2 className="text-2xl font-bold text-white">30-Second Summary</h2>
        <p className="text-blue-100 text-sm">Everything you need to know, above the fold</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Fit Signal */}
        <div className={`${style.bg} border-2 ${style.border} rounded-xl p-4`}>
          <div className="flex items-center gap-3 mb-3">
            <Icon className={`w-6 h-6 ${style.iconColor}`} />
            <div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Fit Signal</div>
              <div className={`text-xl font-bold ${style.text}`}>{fitSignal}</div>
            </div>
          </div>

          <p className="text-gray-800 font-medium mb-3">{oneLiner}</p>
          <div className="bg-white/80 border border-gray-200 rounded-lg p-3 mt-2">
            <p className="text-gray-800 text-sm">
              <span className="font-semibold text-gray-900">Becomes annoying if:</span> {becomesAnnoyingIf}
            </p>
          </div>
        </div>

        {/* What Breaks First */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-gray-900">What Breaks First</h3>
          </div>
          <ul className="space-y-2">
            {whatBreaksFirst.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-orange-600 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Confidence */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-900">Confidence</h3>
            <span
              className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold border ${getConfidenceBadgeStyle()}`}
              title="Confidence reflects data completeness and routine predictability — not guarantees"
            >
              {confidence}
            </span>
          </div>
          <p className="text-xs text-gray-600 mb-2 italic">
            Reflects data completeness and routine predictability — not guarantees
          </p>
          <ul className="space-y-2">
            {confidenceWhy.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Top Drivers */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-900">Top Drivers</h3>
          </div>
          <div className="space-y-2">
            {topDrivers.map((driver, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{driver.label}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getImpactBadgeStyle(driver.impact)}`}>
                  {driver.impact}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan B */}
        <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-4 border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-green-600" />
            <h3 className="font-bold text-gray-900">Plan B</h3>
          </div>
          <ul className="space-y-2">
            {planB.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-600 mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="bg-gray-100 px-6 py-3 border-t border-gray-200">
        <p className="text-xs text-gray-600 text-center">
          ⚠️ This report explains fit and uncertainty. It does not rate vehicles or recommend purchases.
        </p>
      </div>
    </motion.div>
  );
}
