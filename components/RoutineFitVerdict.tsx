// components/RoutineFitVerdict.tsx
import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type RoutineFitLevel = 'good-fit' | 'conditional-fit' | 'high-friction';

interface RoutineFitVerdictProps {
  level: RoutineFitLevel;
  condition?: string; // For conditional fit: what they need to do
}

const verdictConfig = {
  'good-fit': {
    icon: CheckCircle,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-600',
    title: 'Good Fit',
    description: 'This EV is likely to fit your routine with low ongoing friction.'
  },
  'conditional-fit': {
    icon: AlertTriangle,
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
    title: 'Conditional Fit',
    description: 'This EV can work, but only if you'
  },
  'high-friction': {
    icon: XCircle,
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconColor: 'text-orange-600',
    title: 'High Friction Risk',
    description: 'This setup is likely to become annoying or stressful over time.'
  }
};

export const RoutineFitVerdict: React.FC<RoutineFitVerdictProps> = ({
  level,
  condition
}) => {
  const config = verdictConfig[level];
  const Icon = config.icon;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      {/* One-Line Verdict */}
      <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-2xl p-8 mb-6`}>
        <div className="flex items-start gap-4">
          <div className={`p-4 rounded-full ${config.bgColor} border-2 ${config.borderColor}`}>
            <Icon className={`w-8 h-8 ${config.iconColor}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {config.title}
              {level === 'conditional-fit' && condition && (
                <span className="block text-2xl md:text-3xl font-semibold text-gray-700 mt-2">
                  {config.description} {condition} consistently.
                </span>
              )}
              {level !== 'conditional-fit' && (
                <span className="block text-xl md:text-2xl font-normal text-gray-700 mt-2">
                  {config.description}
                </span>
              )}
            </h2>
          </div>
        </div>
      </div>

      {/* Important Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-gray-700">
          ⚠️ <strong>This is not a recommendation to buy or avoid</strong> — it's a routine fit signal.
        </p>
      </div>
    </div>
  );
};
