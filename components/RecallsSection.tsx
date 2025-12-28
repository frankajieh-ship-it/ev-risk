/**
 * Recalls Section - Calibrated Urgency Voice
 *
 * BEFORE: "2 open recalls detected. 1 critical. Urgent action recommended."
 * AFTER: Contextualized risk + Practical next step + Timeline + Why it matters
 */

import { templates, formatUrgency, type CalibratedUrgency, type UrgencyLevel } from "@/lib/voice-patterns";

interface Recall {
  id: string;
  title: string;
  description: string;
  isSafetyRelated: boolean;
  estimatedTimeline?: string; // "3–7 days", "1–2 weeks"
}

interface RecallsSectionProps {
  recalls: Recall[];
  vehicleMake?: string;
}

export default function RecallsSection({ recalls, vehicleMake = "the manufacturer" }: RecallsSectionProps) {
  if (recalls.length === 0) {
    return (
      <div className="bg-green-50 rounded-2xl shadow-lg p-8 border-2 border-green-300 mb-8">
        <h2 className="text-2xl font-bold text-green-900 mb-3 flex items-center">
          <svg className="w-7 h-7 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          No Open Recalls
        </h2>
        <p className="text-green-800">
          This vehicle has no outstanding recalls registered with NHTSA. This is a positive indicator for safety and reliability.
        </p>
      </div>
    );
  }

  const safetyRelatedCount = recalls.filter(r => r.isSafetyRelated).length;
  const primaryRecall = recalls.find(r => r.isSafetyRelated) || recalls[0];

  // Generate calibrated urgency messaging
  const urgencyLevel: UrgencyLevel = safetyRelatedCount > 0 ? "before-purchase" : "low-priority";
  const typicalTimeline = primaryRecall.estimatedTimeline || "3–7 days";

  const messaging = templates.recall(
    recalls.length,
    primaryRecall.description,
    typicalTimeline
  );

  return (
    <div className="bg-orange-50 rounded-2xl shadow-lg p-8 border-2 border-orange-300 mb-8">
      {/* Header */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
        <svg
          className="w-7 h-7 mr-3 text-orange-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Open Recalls
      </h2>

      {/* Calibrated urgency (not alarm) */}
      <div className="mb-6">
        <p className="text-lg font-semibold text-orange-900 mb-2">
          {messaging.issue}
          {safetyRelatedCount > 0 && (
            <span className="ml-2 text-sm bg-orange-200 text-orange-900 px-2 py-1 rounded">
              {safetyRelatedCount} safety-related
            </span>
          )}
        </p>
      </div>

      {/* Contextualized risk */}
      <div className="bg-white border-l-4 border-orange-500 p-5 rounded-lg mb-6">
        <h3 className="font-bold text-gray-900 mb-2">What you should know:</h3>
        <p className="text-gray-800 leading-relaxed">{messaging.context}</p>
      </div>

      {/* Recall list */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 mb-3">Recall Details:</h3>
        <div className="space-y-3">
          {recalls.map((recall) => (
            <div
              key={recall.id}
              className="bg-white p-4 rounded-lg border-2 border-orange-200"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-gray-900">{recall.title}</h4>
                {recall.isSafetyRelated && (
                  <span className="flex-shrink-0 ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-semibold">
                    Safety-related
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700">{recall.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Practical next step with timeline */}
      <div className="bg-gradient-to-r from-orange-100 to-yellow-100 border-2 border-orange-400 rounded-lg p-5 mb-6">
        <h3 className="font-bold text-gray-900 mb-3">Recommended next step:</h3>
        <p className="text-gray-800 mb-3">{messaging.action}</p>
        <div className="text-sm text-gray-700">
          <p className="font-semibold">Timeline: {typicalTimeline}</p>
        </div>
      </div>

      {/* Why it matters (decision impact) */}
      <div className="pt-4 border-t border-orange-300">
        <h3 className="font-bold text-gray-900 mb-2">Why this matters now:</h3>
        <p className="text-gray-800">{messaging.consequence}</p>
      </div>

      {/* Action buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => window.open(`https://www.nhtsa.gov/recalls`, '_blank')}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
        >
          Check NHTSA Recall Status
        </button>
        <button
          onClick={() => {/* Navigate to find dealer */}}
          className="px-5 py-2.5 bg-white hover:bg-gray-50 text-orange-700 font-semibold rounded-lg border-2 border-orange-600 transition-colors duration-200"
        >
          Find {vehicleMake} Dealer
        </button>
      </div>
    </div>
  );
}

/**
 * Example usage:
 *
 * <RecallsSection
 *   recalls={[
 *     {
 *       id: "NHTSA-23V123",
 *       title: "High-Voltage Battery Contactor",
 *       description: "a battery contactor that may cause sudden power loss in rare cases",
 *       isSafetyRelated: true,
 *       estimatedTimeline: "3–7 days"
 *     }
 *   ]}
 *   vehicleMake="Ford"
 * />
 */
