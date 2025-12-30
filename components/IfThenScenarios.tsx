// components/IfThenScenarios.tsx
// Removes anxiety without false certainty
import React from 'react';
import { ArrowRight, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface Scenario {
  condition: string;
  outcome: string;
  impactType: 'positive' | 'negative' | 'warning';
}

interface IfThenScenariosProps {
  scenarios: Scenario[];
}

export const IfThenScenarios: React.FC<IfThenScenariosProps> = ({ scenarios }) => {
  const getIcon = (impactType: string) => {
    switch (impactType) {
      case 'positive':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'negative':
        return <TrendingDown className="w-5 h-5 text-red-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
    }
  };

  const getBgColor = (impactType: string) => {
    switch (impactType) {
      case 'positive':
        return 'bg-green-50 border-green-200';
      case 'negative':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-amber-50 border-amber-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          If–Then Scenarios
        </h2>
        <p className="text-gray-600">
          Smart, not preachy — understand how changes affect your ownership experience
        </p>
      </div>

      <div className="space-y-4">
        {scenarios.map((scenario, index) => (
          <div key={index} className={`border-2 rounded-xl p-5 ${getBgColor(scenario.impactType)}`}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                {getIcon(scenario.impactType)}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-base font-semibold text-gray-900">
                    If {scenario.condition}
                  </span>
                  <ArrowRight className="w-5 h-5 text-gray-400 hidden sm:block" />
                </div>
                <p className="text-base text-gray-700">
                  {scenario.outcome}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Smart Not Preachy Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>How to use this:</strong> These scenarios help you understand trade-offs without
          telling you what to do. Each "if" represents a choice you can make or avoid.
        </p>
      </div>
    </div>
  );
};
