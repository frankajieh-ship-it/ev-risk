/**
 * Data Quality & Confidence Section
 *
 * Displays "What We Know vs. What We Don't Know" for transparency
 */

import { KnownDataPoint, UnknownDataPoint, RiskFactor } from '@/types/report';

interface DataQualitySectionProps {
  knownData: KnownDataPoint[];
  unknownData: UnknownDataPoint[];
  risks: RiskFactor[];
  nextSteps: string[];
  overallConfidence: 'high' | 'medium' | 'low';
  confidenceNote?: string;
}

export default function DataQualitySection({
  knownData,
  unknownData,
  risks,
  nextSteps,
  overallConfidence,
  confidenceNote,
}: DataQualitySectionProps) {
  const confidenceColor = {
    high: 'text-green-700 bg-green-50 border-green-200',
    medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    low: 'text-red-700 bg-red-50 border-red-200',
  }[overallConfidence];

  const confidenceLabel = {
    high: 'High Confidence',
    medium: 'Medium Confidence',
    low: 'Low Confidence - More Data Needed',
  }[overallConfidence];

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 mb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            📊 Data Quality & Confidence
          </h2>
          <p className="text-gray-600">
            Here's what we know about this vehicle, and what's still missing
          </p>
          {confidenceNote && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">Confidence Level: Medium</span>
                <br />
                <span className="text-blue-800">Reason: {confidenceNote}</span>
              </p>
            </div>
          )}
        </div>
        <div className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm ${confidenceColor} ml-4 h-fit`}>
          {confidenceLabel}
        </div>
      </div>

      {/* What We Know */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          What We Know About This Vehicle
        </h3>

        <div className="space-y-3">
          {knownData.map((item, idx) => (
            <div key={idx} className="flex items-start p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{item.label}</span>
                  <ConfidenceBadge confidence={item.confidence} />
                </div>
                <p className="text-gray-700">{item.value}</p>
                <p className="text-xs text-gray-500 mt-1">Source: {item.source}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What We Couldn't Verify - NEW SECTION B */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Not Verified From This Listing
        </h3>

        <div className="bg-orange-50 border-l-4 border-orange-400 p-5 rounded-lg mb-4">
          <p className="text-sm text-orange-900 mb-4">
            The following details could not be verified from the listing data. These are <strong>common gaps</strong> in used EV listings
            and can be obtained through standard pre-purchase steps.
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded border border-orange-200">
              <p className="font-semibold text-gray-900 text-sm flex items-center">
                <svg className="w-4 h-4 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Vehicle-Specific Battery State of Health (SOH)
              </p>
              <p className="text-xs text-gray-600 mt-1">Actual remaining capacity vs. original</p>
            </div>

            <div className="bg-white p-3 rounded border border-orange-200">
              <p className="font-semibold text-gray-900 text-sm flex items-center">
                <svg className="w-4 h-4 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                DC Fast-Charging History
              </p>
              <p className="text-xs text-gray-600 mt-1">Frequency of high-speed charging sessions</p>
            </div>

            <div className="bg-white p-3 rounded border border-orange-200">
              <p className="font-semibold text-gray-900 text-sm flex items-center">
                <svg className="w-4 h-4 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Warranty Claim History
              </p>
              <p className="text-xs text-gray-600 mt-1">Previous battery-related repairs or claims</p>
            </div>

            <div className="bg-white p-3 rounded border border-orange-200">
              <p className="font-semibold text-gray-900 text-sm flex items-center">
                <svg className="w-4 h-4 mr-2 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                VIN-Level Recall Completion
              </p>
              <p className="text-xs text-gray-600 mt-1">Which recalls (if any) have been completed</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-orange-200">
            <p className="text-xs text-orange-800">
              <strong>Note:</strong> These gaps are extremely common in used EV listings. Dealers and private sellers rarely provide battery diagnostics upfront.
              <strong className="text-orange-900"> This is normal and addressable through standard pre-purchase inspection.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* What We Don't Know */}
      {unknownData.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            What We Don't Know (Yet)
          </h3>

          <div className="space-y-4">
            {unknownData.map((item, idx) => (
              <div key={idx} className="border-l-4 border-yellow-400 pl-4 py-3">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{item.field}</h4>
                  <ImportanceBadge importance={item.importance} />
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Why it matters:</span>
                    <p className="text-gray-600 mt-1">{item.whyItMatters}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">How to find it:</span>
                    <p className="text-gray-600 mt-1">{item.howToFind}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Identified Risks */}
      {risks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Identified Risk Factors
          </h3>

          <div className="space-y-4">
            {risks.map((risk, idx) => (
              <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityClass(risk.severity)}`}>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{risk.message}</h4>
                  <SeverityBadge severity={risk.severity} />
                </div>
                <p className="text-gray-700 text-sm mb-3">{risk.explanation}</p>

                {risk.mitigationSteps && risk.mitigationSteps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="font-medium text-gray-900 text-sm mb-2">Mitigation steps:</p>
                    <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                      {risk.mitigationSteps.map((step, stepIdx) => (
                        <li key={stepIdx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Next Steps */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recommended Next Steps
        </h3>

        <ol className="space-y-3">
          {nextSteps.map((step, idx) => (
            <li key={idx} className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                {idx + 1}
              </span>
              <p className="text-gray-700 pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// Helper Components

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors = {
    high: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-orange-100 text-orange-800',
    user_provided: 'bg-blue-100 text-blue-800',
  }[confidence] || 'bg-gray-100 text-gray-800';

  const labels = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    user_provided: 'User Provided',
  }[confidence] || confidence;

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colors}`}>
      {labels}
    </span>
  );
}

function ImportanceBadge({ importance }: { importance: string }) {
  const colors = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
  }[importance] || 'bg-gray-100 text-gray-800';

  const labels = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
  }[importance] || importance;

  return (
    <span className={`px-2 py-1 rounded text-xs font-bold ${colors}`}>
      {labels}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-600 text-white',
    medium: 'bg-yellow-600 text-white',
    low: 'bg-green-600 text-white',
  }[severity] || 'bg-gray-600 text-white';

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function getSeverityClass(severity: string): string {
  return {
    critical: 'border-red-300 bg-red-50',
    high: 'border-orange-300 bg-orange-50',
    medium: 'border-yellow-300 bg-yellow-50',
    low: 'border-green-300 bg-green-50',
  }[severity] || 'border-gray-300 bg-gray-50';
}
