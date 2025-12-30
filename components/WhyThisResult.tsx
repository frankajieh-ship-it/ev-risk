// components/WhyThisResult.tsx
import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface ReasonItem {
  text: string;
  type: 'positive' | 'neutral' | 'negative';
}

interface WhyThisResultProps {
  reasons: ReasonItem[];
}

export const WhyThisResult: React.FC<WhyThisResultProps> = ({ reasons }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />;
      case 'negative':
        return <XCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />;
      default:
        return <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Why This Result
      </h2>

      <div className="space-y-4">
        {reasons.map((reason, index) => (
          <div key={index} className="flex items-start gap-3">
            {getIcon(reason.type)}
            <p className="text-base text-gray-700 leading-relaxed">
              {reason.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
