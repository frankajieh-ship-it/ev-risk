"use client";

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface FitSignalDisplayProps {
  fitSignal: "Good Fit" | "Conditional Fit" | "High Friction";
  oneSentenceVerdict: string;
  confidenceNote: string;
  score: number;
}

export default function FitSignalDisplay({
  fitSignal,
  oneSentenceVerdict,
  confidenceNote,
  score,
}: FitSignalDisplayProps) {
  // Styling based on fit signal
  const config = {
    "Good Fit": {
      icon: CheckCircle,
      bgColor: "from-green-50 via-white to-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-700",
      iconColor: "text-green-600",
      badgeColor: "bg-green-100 text-green-800 border-green-300",
    },
    "Conditional Fit": {
      icon: AlertTriangle,
      bgColor: "from-yellow-50 via-white to-yellow-50",
      borderColor: "border-yellow-200",
      textColor: "text-yellow-700",
      iconColor: "text-yellow-600",
      badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-300",
    },
    "High Friction": {
      icon: XCircle,
      bgColor: "from-red-50 via-white to-red-50",
      borderColor: "border-red-200",
      textColor: "text-red-700",
      iconColor: "text-red-600",
      badgeColor: "bg-red-100 text-red-800 border-red-300",
    },
  }[fitSignal];

  const Icon = config.icon;

  return (
    <div className={`bg-gradient-to-br ${config.bgColor} border-2 ${config.borderColor} rounded-2xl p-8 mb-6`}>
      {/* Fit Signal Badge */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 bg-white rounded-xl shadow-sm border ${config.borderColor}`}>
            <Icon className={`w-8 h-8 ${config.iconColor}`} />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">Fit Signal</div>
            <div className={`text-3xl font-bold ${config.textColor}`}>{fitSignal}</div>
          </div>
        </div>
        <div className={`px-4 py-2 border rounded-full font-semibold ${config.badgeColor}`}>
          Score: {score}/100
        </div>
      </div>

      {/* One-Sentence Verdict */}
      <div className="mb-4">
        <div className="text-sm font-semibold text-gray-700 mb-2">One-Sentence Verdict</div>
        <p className={`text-lg font-medium ${config.textColor} leading-relaxed`}>
          {oneSentenceVerdict}
        </p>
      </div>

      {/* Confidence Note */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-sm font-semibold text-gray-700 mb-2">Confidence & Why</div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {confidenceNote}
        </p>
      </div>
    </div>
  );
}
