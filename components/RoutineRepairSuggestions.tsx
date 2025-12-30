// components/RoutineRepairSuggestions.tsx
// Turns insight into guidance, not judgment
import React from 'react';
import { Lightbulb, TrendingUp, CheckCircle } from 'lucide-react';

interface Suggestion {
  action: string;
  impact: string;
  impactPercentage?: number;
  effort: 'low' | 'medium' | 'high';
}

interface RoutineRepairSuggestionsProps {
  suggestions: Suggestion[];
  currentFitLevel: 'good' | 'conditional' | 'high-friction';
}

const effortConfig = {
  low: {
    label: 'Low effort',
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  medium: {
    label: 'Medium effort',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100'
  },
  high: {
    label: 'High effort',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100'
  }
};

export const RoutineRepairSuggestions: React.FC<RoutineRepairSuggestionsProps> = ({
  suggestions,
  currentFitLevel
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Lightbulb className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            Routine Repair Suggestions
          </h2>
        </div>
        <p className="text-gray-600">
          Insight into guidance — specific actions that reduce friction
        </p>
      </div>

      {/* Current State */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          Current fit level: {currentFitLevel === 'good' ? 'Good Fit' : currentFitLevel === 'conditional' ? 'Conditional Fit' : 'High Friction'}
        </h3>
        <p className="text-sm text-blue-800">
          {currentFitLevel === 'good'
            ? 'Your current setup works well. These suggestions can make it even better.'
            : currentFitLevel === 'conditional'
            ? 'These changes could move you toward a more stable, low-friction setup.'
            : 'These changes are strongly recommended to reduce ongoing friction and regret risk.'
          }
        </p>
      </div>

      {/* Suggestions */}
      <div className="space-y-4 mb-6">
        {suggestions.map((suggestion, index) => {
          const effortStyle = effortConfig[suggestion.effort];

          return (
            <div key={index} className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h4 className="text-base font-semibold text-gray-900">
                      {suggestion.action}
                    </h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${effortStyle.bgColor} ${effortStyle.color}`}>
                      {effortStyle.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-gray-700">
                      <strong>Impact:</strong> {suggestion.impact}
                      {suggestion.impactPercentage && (
                        <span className="ml-1 font-semibold text-green-600">
                          (~{suggestion.impactPercentage}% friction reduction)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Prioritization Guidance */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <h4 className="font-semibold text-green-900 mb-2">
          How to prioritize
        </h4>
        <ul className="space-y-2 text-sm text-green-800">
          <li className="flex items-start gap-2">
            <span className="text-green-600 flex-shrink-0">•</span>
            <span><strong>Low effort, high impact:</strong> Start here — quick wins that meaningfully reduce friction</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 flex-shrink-0">•</span>
            <span><strong>High effort:</strong> Only pursue if friction is currently causing real stress</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 flex-shrink-0">•</span>
            <span><strong>Conditional fit:</strong> Focus on stabilizing your primary charging strategy first</span>
          </li>
        </ul>
      </div>

      {/* Guidance Not Judgment Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>These are suggestions, not requirements.</strong> They turn behavioral insights into
          actionable improvements. You decide which (if any) make sense for your situation.
        </p>
      </div>
    </div>
  );
};
