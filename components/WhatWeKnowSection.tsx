// components/WhatWeKnowSection.tsx
import React from 'react';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

interface WhatWeKnowSectionProps {
  hasPersonalization: boolean;
  onAddInfo?: () => void;
}

export const WhatWeKnowSection: React.FC<WhatWeKnowSectionProps> = ({
  hasPersonalization,
  onAddInfo
}) => {
  const confidentAbout = [
    "Battery degradation risk based on age and mileage",
    "Expected real-world range for this model",
    "Known reliability issues and recalls",
    "Climate impact on battery in your ZIP code"
  ];

  const lessCertainAbout = [
    "Your specific charging reliability and backup options",
    "How charging fits into your actual daily schedule",
    "Whether range anxiety will affect your peace of mind",
    "Hidden costs specific to your usage pattern"
  ];

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          What We Know vs. What We Don't
        </h2>
        <p className="text-gray-600">
          Being honest about the limits of listing data
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* What We're Confident About */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="bg-green-100 p-2 rounded-lg mr-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              We're confident about:
            </h3>
          </div>
          <ul className="space-y-3">
            {confidentAbout.map((item, index) => (
              <li key={index} className="flex items-start text-sm text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What We're Less Certain About */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <div className="bg-amber-100 p-2 rounded-lg mr-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              We're less certain about:
            </h3>
          </div>
          <ul className="space-y-3">
            {lessCertainAbout.map((item, index) => (
              <li key={index} className="flex items-start text-sm text-gray-700">
                <AlertCircle className="w-4 h-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CTA for Personalization */}
      {!hasPersonalization && onAddInfo && (
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-base font-semibold text-gray-900 mb-2">
                Want a clearer answer?
              </h4>
              <p className="text-sm text-gray-700 mb-4">
                Add 2 minutes of info about your charging situation and daily routine to get a more personalized assessment.
              </p>
            </div>
            <button
              onClick={onAddInfo}
              className="ml-4 flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Add your info
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      )}

      {/* Honesty note */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Our approach:</strong> We show you what we know and what we don't.
          Listing data gives us the vehicle side. Your context fills in the ownership side.
          Both matter for predicting regret vs. satisfaction.
        </p>
      </div>
    </div>
  );
};
