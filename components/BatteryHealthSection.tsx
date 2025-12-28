/**
 * Battery Health Section - Decision-Supporting Voice
 *
 * BEFORE: "Battery degradation estimated at 12.4% based on mileage proxy. Confidence: Medium."
 * AFTER: Practical meaning + Context + Confidence explained + Action with value
 */

import { formatMetric, templates, type MetricCommunication } from "@/lib/voice-patterns";

interface BatteryHealthSectionProps {
  degradationPercent: number; // 0-100
  originalRange?: number; // Miles (default: 263 for Model 3 SR)
  hasPersonalization?: boolean; // Whether user provided annual mileage
  onPersonalize?: () => void; // Callback to add personalization
}

export default function BatteryHealthSection({
  degradationPercent,
  originalRange = 263,
  hasPersonalization = false,
  onPersonalize,
}: BatteryHealthSectionProps) {
  // Generate messaging using template
  const messaging = templates.batteryHealth(degradationPercent, originalRange);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-blue-200 mb-8">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
        <svg
          className="w-7 h-7 mr-3 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        {messaging.metric}
      </h2>

      {/* Estimate with range (not false precision) */}
      <div className="mb-6">
        <p className="text-gray-800 leading-relaxed">{messaging.estimate}</p>
      </div>

      {/* Practical meaning */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-lg mb-6">
        <h3 className="font-bold text-blue-900 mb-2">What this means for you:</h3>
        <p className="text-blue-800">{messaging.practicalMeaning}</p>
      </div>

      {/* Confidence explanation */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 mb-2">
          Confidence: {messaging.confidence.label}
        </h3>
        <div className="text-sm text-gray-700 space-y-2">
          <p>{messaging.confidence.practicalMeaning}</p>
          <p className="text-gray-600">{messaging.confidence.basedOn}</p>
          {!hasPersonalization && (
            <p className="text-gray-600">{messaging.confidence.whatsMissing}</p>
          )}
        </div>
      </div>

      {/* Action with quantified value */}
      {!hasPersonalization && messaging.action && onPersonalize && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-5">
          <h3 className="font-bold text-gray-900 mb-3">
            To improve this estimate:
          </h3>
          <p className="text-sm text-gray-800 mb-4">
            <span className="font-semibold">Share {messaging.action.dataPoint}</span> →
            We'll {messaging.action.analysis} → which adjusts{" "}
            {messaging.action.outcome} by{" "}
            <span className="font-bold text-green-700">
              {messaging.action.quantifiedRange}
            </span>
          </p>
          <button
            onClick={onPersonalize}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
          >
            Add your annual mileage
          </button>
        </div>
      )}

      {/* Decision impact */}
      {messaging.confidence.decisionImpact && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Decision impact:</span>{" "}
            {messaging.confidence.decisionImpact}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Example usage:
 *
 * <BatteryHealthSection
 *   degradationPercent={12.4}
 *   originalRange={263}
 *   hasPersonalization={false}
 *   onPersonalize={() => router.push('/?section=personalization')}
 * />
 */
