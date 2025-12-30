// components/WhatsMissing.tsx
import React from 'react';
import { TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';

interface WhatsMissingProps {
  currentConfidence: number;
  potentialConfidence: number;
  missingDataPoints: string[];
  onUpgrade?: () => void;
}

export const WhatsMissing: React.FC<WhatsMissingProps> = ({
  currentConfidence,
  potentialConfidence,
  missingDataPoints,
  onUpgrade
}) => {
  const confidenceGain = potentialConfidence - currentConfidence;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">
          What's Missing
        </h2>
      </div>

      {/* Confidence Improvement Visualization */}
      <div className="bg-gradient-to-br from-blue-50 to-green-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Current Confidence</p>
            <p className="text-3xl font-bold text-gray-900">{currentConfidence}%</p>
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-6 h-6 text-blue-600" />
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">With Battery Data</p>
            <p className="text-3xl font-bold text-green-600">{potentialConfidence}%</p>
          </div>
        </div>

        <div className="bg-white/50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">
            +{confidenceGain}% confidence increase possible
          </p>
          <p className="text-sm text-gray-700">
            With battery health data, we can move from educated guesses to data-backed predictions.
          </p>
        </div>
      </div>

      {/* What We're Missing */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Missing Data Points:
        </h3>
        <ul className="space-y-3">
          {missingDataPoints.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-gray-600">{index + 1}</span>
              </div>
              <p className="text-sm text-gray-700">{item}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA for Full Report */}
      {onUpgrade && (
        <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-xl p-6 text-white">
          <h4 className="text-lg font-bold mb-2">Get the Full Picture</h4>
          <p className="text-sm mb-4 text-blue-50">
            Battery health analysis, degradation projections, and repair cost estimates included.
          </p>
          <button
            onClick={onUpgrade}
            className="w-full bg-white text-blue-600 font-semibold py-3 px-6 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            Upgrade to Full Report
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Trust Note */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Our approach:</strong> The free check gives you the routine fit signal.
          The paid report adds battery-specific risk analysis. Both matter, but routine fit is often the deciding factor.
        </p>
      </div>
    </div>
  );
};
