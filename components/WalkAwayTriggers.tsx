// components/WalkAwayTriggers.tsx
// Self-protection, not fear — prominent and actionable
import React from 'react';
import { Shield, AlertTriangle, XCircle } from 'lucide-react';

interface Trigger {
  condition: string;
  reason: string;
  severity: 'critical' | 'warning';
  isTriggered: boolean;
}

interface WalkAwayTriggersProps {
  triggers: Trigger[];
  anyTriggered: boolean;
}

export const WalkAwayTriggers: React.FC<WalkAwayTriggersProps> = ({ triggers, anyTriggered }) => {
  const criticalTriggers = triggers.filter(t => t.severity === 'critical' && t.isTriggered);
  const warningTriggers = triggers.filter(t => t.severity === 'warning' && t.isTriggered);
  const allClear = !anyTriggered;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border-2 border-orange-200">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-orange-600" />
          <h2 className="text-2xl font-bold text-gray-900">
            Walk-Away Triggers
          </h2>
        </div>
        <p className="text-gray-600">
          Self-protection, not fear — pause before committing if any of these are true
        </p>
      </div>

      {/* Overall Status */}
      {allClear ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <Shield className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-green-900 mb-2">
                ✅ No walk-away triggers detected
              </h3>
              <p className="text-base text-green-800">
                Based on available data, there are no critical red flags that would suggest
                avoiding this vehicle. This doesn't guarantee a perfect fit, but indicates
                no obvious deal-breakers.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className={`border-2 rounded-xl p-6 mb-6 ${
          criticalTriggers.length > 0
            ? 'bg-red-50 border-red-300'
            : 'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-start gap-4">
            <AlertTriangle className={`w-8 h-8 flex-shrink-0 ${
              criticalTriggers.length > 0 ? 'text-red-600' : 'text-amber-600'
            }`} />
            <div>
              <h3 className={`text-xl font-bold mb-2 ${
                criticalTriggers.length > 0 ? 'text-red-900' : 'text-amber-900'
              }`}>
                {criticalTriggers.length > 0 ? '🛑 Critical triggers found' : '⚠️ Warning triggers found'}
              </h3>
              <p className={`text-base ${
                criticalTriggers.length > 0 ? 'text-red-800' : 'text-amber-800'
              }`}>
                {criticalTriggers.length > 0
                  ? 'Strongly consider pausing before committing. These issues significantly increase regret risk.'
                  : 'These concerns warrant additional research or negotiation leverage before proceeding.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Critical Triggers */}
      {criticalTriggers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
            <XCircle className="w-5 h-5 mr-2" />
            Critical Issues
          </h3>
          <div className="space-y-3">
            {criticalTriggers.map((trigger, index) => (
              <div key={index} className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4">
                <p className="font-semibold text-red-900 mb-1">{trigger.condition}</p>
                <p className="text-sm text-red-800">{trigger.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning Triggers */}
      {warningTriggers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Concerns to Address
          </h3>
          <div className="space-y-3">
            {warningTriggers.map((trigger, index) => (
              <div key={index} className="bg-amber-50 border-l-4 border-amber-600 rounded-lg p-4">
                <p className="font-semibold text-amber-900 mb-1">{trigger.condition}</p>
                <p className="text-sm text-amber-800">{trigger.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Triggers (Reference) */}
      <div className="border border-gray-200 rounded-xl p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Complete trigger checklist
        </h3>
        <div className="space-y-2">
          {triggers.map((trigger, index) => (
            <div key={index} className="flex items-start gap-3">
              {trigger.isTriggered ? (
                <XCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  trigger.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                }`} />
              ) : (
                <div className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0 mt-0.5"></div>
              )}
              <p className={`text-sm ${trigger.isTriggered ? 'font-semibold' : 'text-gray-600'}`}>
                {trigger.condition}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Self-Protection Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Important:</strong> This does not recommend buying or avoiding. Walk-away triggers
          help you recognize when a vehicle introduces unnecessary risk to your specific situation.
        </p>
      </div>
    </div>
  );
};
