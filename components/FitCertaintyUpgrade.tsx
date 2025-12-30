// components/FitCertaintyUpgrade.tsx
import React from 'react';
import { TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';

interface FitCertaintyUpgradeProps {
  beforeConfidence: number;
  afterConfidence: number;
  dataClosedGap: string[];
  stillUncertain?: string[];
}

export const FitCertaintyUpgrade: React.FC<FitCertaintyUpgradeProps> = ({
  beforeConfidence,
  afterConfidence,
  dataClosedGap,
  stillUncertain = []
}) => {
  const confidenceGain = afterConfidence - beforeConfidence;

  return (
    <div className="bg-gradient-to-br from-green-50 via-white to-blue-50 rounded-2xl shadow-xl p-8 mb-8 border-2 border-green-200">
      {/* Confidence Upgrade Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Initial Assessment</p>
            <p className="text-4xl font-bold text-gray-400">{beforeConfidence}%</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-12 h-0.5 bg-gray-300"></div>
            <TrendingUp className="w-8 h-8 text-green-600" />
            <div className="w-12 h-0.5 bg-gray-300"></div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">With Full Data</p>
            <p className="text-4xl font-bold text-green-600">{afterConfidence}%</p>
          </div>
        </div>

        <div className="inline-flex items-center px-6 py-3 bg-green-100 border-2 border-green-300 rounded-full">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          <span className="text-lg font-bold text-green-900">
            Confidence upgraded: +{confidenceGain}%
          </span>
        </div>
      </div>

      {/* What Closed the Gap */}
      <div className="bg-white rounded-xl p-6 mb-6 border border-green-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          What data closed the gap
        </h3>
        <ul className="space-y-3">
          {dataClosedGap.map((item, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-700">{item}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* What Still Remains Uncertain */}
      {stillUncertain.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-amber-600 mr-2" />
            What still remains uncertain
          </h3>
          <ul className="space-y-3">
            {stillUncertain.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-sm text-gray-700">{item}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reframing Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>This is a confidence purchase, not an info purchase.</strong> The report doesn't
          recommend buying or avoiding — it reduces the uncertainty that leads to regret.
        </p>
      </div>
    </div>
  );
};
