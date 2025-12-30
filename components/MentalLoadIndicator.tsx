// components/MentalLoadIndicator.tsx
import React from 'react';
import { Brain } from 'lucide-react';

export type MentalLoadLevel = 'low' | 'medium' | 'high';

interface MentalLoadIndicatorProps {
  level: MentalLoadLevel;
}

const mentalLoadConfig = {
  low: {
    emoji: '🟢',
    label: 'Low mental overhead',
    description: 'Charging becomes automatic, like plugging in your phone at night',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900'
  },
  medium: {
    emoji: '🟡',
    label: 'Ongoing planning required',
    description: 'You\'ll need to think about charging regularly, but it\'s manageable with routine',
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-900'
  },
  high: {
    emoji: '🔴',
    label: 'Frequent attention required',
    description: 'Charging will be a regular mental task — "Where can I charge?" becomes recurring',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-900'
  }
};

export const MentalLoadIndicator: React.FC<MentalLoadIndicatorProps> = ({ level }) => {
  const config = mentalLoadConfig[level];

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-900">
          Mental Load Indicator
        </h2>
      </div>

      <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl p-6`}>
        <div className="flex items-start gap-4">
          <div className="text-4xl flex-shrink-0">
            {config.emoji}
          </div>
          <div>
            <h3 className={`text-xl font-bold ${config.textColor} mb-2`}>
              {config.label}
            </h3>
            <p className="text-base text-gray-700">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Why this matters:</strong> This maps directly to what real EV owners complain about.
          Range is about capability — mental load is about whether using that capability feels automatic or exhausting.
        </p>
      </div>
    </div>
  );
};
