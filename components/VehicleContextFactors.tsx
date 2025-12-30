// components/VehicleContextFactors.tsx
import React from 'react';
import { Battery, Wrench, Home } from 'lucide-react';

interface BatteryRisk {
  score: number;
  degradation_percent: number;
  estimated_replacement_cost: number;
  chemistry: string;
  details: string;
}

interface PlatformRisk {
  score: number;
  critical_recalls: number;
  total_recalls: number;
  reliability_score: number;
  details: string;
}

interface OwnershipFit {
  score: number;
  climate_impact: string;
  charger_density: string;
  annual_miles_fit: string;
  details: string;
}

interface VehicleContextFactorsProps {
  batteryRisk: BatteryRisk;
  platformRisk: PlatformRisk;
  ownershipFit: OwnershipFit;
}

export const VehicleContextFactors: React.FC<VehicleContextFactorsProps> = ({
  batteryRisk,
  platformRisk,
  ownershipFit,
}) => {
  // Helper to get context description based on score
  const getContextLevel = (score: number): { text: string; colorClass: string } => {
    if (score >= 80) return { text: "Favorable", colorClass: "text-green-700 bg-green-50 border-green-200" };
    if (score >= 60) return { text: "Moderate Consideration", colorClass: "text-amber-700 bg-amber-50 border-amber-200" };
    return { text: "Needs Attention", colorClass: "text-orange-700 bg-orange-50 border-orange-200" };
  };

  const batteryContext = getContextLevel(batteryRisk.score);
  const platformContext = getContextLevel(platformRisk.score);
  const ownershipContext = getContextLevel(ownershipFit.score);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Key Context Factors
        </h2>
        <p className="text-gray-600">
          Understanding the specific considerations for this vehicle and your situation
        </p>
      </div>

      <div className="space-y-6">
        {/* Battery Health Context */}
        <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-blue-100 p-3 rounded-lg mr-4">
                <Battery className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Battery Health Context
                </h3>
                <p className="text-sm text-gray-600">
                  {batteryRisk.chemistry} chemistry
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${batteryContext.colorClass}`}>
              {batteryContext.text}
            </span>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">{batteryRisk.details}</p>
              <div className="flex items-center justify-between text-sm mt-3">
                <span className="text-gray-600">Estimated degradation:</span>
                <span className="font-semibold text-gray-900">
                  {batteryRisk.degradation_percent.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Replacement cost estimate:</span>
                <span className="font-semibold text-gray-900">
                  ${batteryRisk.estimated_replacement_cost.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Visual indicator */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  batteryRisk.score >= 80 ? 'bg-green-500' :
                  batteryRisk.score >= 60 ? 'bg-amber-500' :
                  'bg-orange-500'
                }`}
                style={{ width: `${batteryRisk.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Platform Reliability Context */}
        <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-purple-100 p-3 rounded-lg mr-4">
                <Wrench className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Platform Reliability Context
                </h3>
                <p className="text-sm text-gray-600">
                  Known issues and recalls
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${platformContext.colorClass}`}>
              {platformContext.text}
            </span>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-2">{platformRisk.details}</p>
              {platformRisk.critical_recalls > 0 && (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800 font-medium">
                    ⚠️ {platformRisk.critical_recalls} critical recall(s) identified
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Verify completion status with seller before purchase
                  </p>
                </div>
              )}
            </div>

            {/* Visual indicator */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  platformRisk.score >= 80 ? 'bg-green-500' :
                  platformRisk.score >= 60 ? 'bg-amber-500' :
                  'bg-orange-500'
                }`}
                style={{ width: `${platformRisk.score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Ownership Fit Context */}
        <div className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className="bg-green-100 p-3 rounded-lg mr-4">
                <Home className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Your Ownership Fit
                </h3>
                <p className="text-sm text-gray-600">
                  Climate, charging, and usage match
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${ownershipContext.colorClass}`}>
              {ownershipContext.text}
            </span>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">{ownershipFit.details}</p>
            </div>

            {/* Visual indicator */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  ownershipFit.score >= 80 ? 'bg-green-500' :
                  ownershipFit.score >= 60 ? 'bg-amber-500' :
                  'bg-orange-500'
                }`}
                style={{ width: `${ownershipFit.score}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contextual footer */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> These factors represent context-specific considerations, not universal ratings.
          What matters most depends on your priorities, budget, and circumstances.
        </p>
      </div>
    </div>
  );
};
