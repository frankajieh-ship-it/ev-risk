"use client";

import { Sparkles, ChevronRight } from "lucide-react";

interface FitQuizLauncherProps {
  onClick: () => void;
}

export default function FitQuizLauncher({ onClick }: FitQuizLauncherProps) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl border-2 border-gray-200 p-4 md:p-6 hover:border-green-300 hover:shadow-lg transition-all text-left group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 md:p-3 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl group-hover:scale-110 transition-transform">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-bold text-gray-900">
            7-Question Fit Check
          </h3>
          <p className="text-xs md:text-sm text-gray-600">
            Quick assessment with vehicle details
          </p>
        </div>
      </div>

      {/* Trust cue */}
      <div className="mb-2 md:mb-3 px-2 md:px-3 py-1.5 md:py-2 bg-green-50 border border-green-100 rounded-lg">
        <p className="text-xs font-medium text-green-800">
          Anonymous — no email required
        </p>
      </div>

      {/* What you'll get bullets */}
      <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-700">
          <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
          <span>Get a clear Fit Signal</span>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-700">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
          <span>See what breaks first</span>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-700">
          <div className="w-1.5 h-1.5 bg-purple-600 rounded-full"></div>
          <span>Know what would make this annoying</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-gray-100">
        <span className="text-sm font-medium text-gray-600">
          ~60 seconds
        </span>
        <div className="flex items-center gap-1 text-sm font-semibold text-green-600 group-hover:gap-2 transition-all">
          Start Quiz
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
