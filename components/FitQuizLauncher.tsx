"use client";

import { Sparkles, ChevronRight } from "lucide-react";

interface FitQuizLauncherProps {
  onClick: () => void;
}

export default function FitQuizLauncher({ onClick }: FitQuizLauncherProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-green-300 hover:shadow-lg transition-all text-left group"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl group-hover:scale-110 transition-transform">
          <Sparkles className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            5-Question Fit Check
          </h3>
          <p className="text-sm text-gray-600">
            No vehicle in mind yet? Start here
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
          <span>Analyze your daily routine</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
          <span>Check charging fit</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
          <span>Get personalized recommendations</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <span className="text-sm font-medium text-gray-600">
          Takes 30 seconds
        </span>
        <div className="flex items-center gap-1 text-sm font-semibold text-green-600 group-hover:gap-2 transition-all">
          Start Quiz
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
