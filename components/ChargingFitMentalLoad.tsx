// components/ChargingFitMentalLoad.tsx
import React from 'react';
import { Zap, Clock, MapPin, Brain, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ChargingFitMentalLoadProps {
  homeCharging: boolean;
  dailyMiles: number;
  realWorldRange: number;
  chargerDensity: string;
  zipCode: string;
}

export const ChargingFitMentalLoad: React.FC<ChargingFitMentalLoadProps> = ({
  homeCharging,
  dailyMiles,
  realWorldRange,
  chargerDensity,
  zipCode
}) => {
  // Calculate key metrics
  const dailyRangeUsage = (dailyMiles / realWorldRange) * 100;
  const chargingFrequency = homeCharging ?
    (dailyMiles > realWorldRange * 0.7 ? "Daily" : dailyMiles > realWorldRange * 0.3 ? "Every 2-3 days" : "Weekly") :
    (dailyMiles > realWorldRange * 0.5 ? "Every 1-2 days" : "Every 3-4 days");

  // Assess mental load level
  const getMentalLoadLevel = (): { level: string; color: string; description: string } => {
    if (homeCharging && dailyRangeUsage < 50) {
      return {
        level: "Low",
        color: "green",
        description: "Set it and forget it — charging becomes as automatic as parking"
      };
    }
    if (homeCharging && dailyRangeUsage < 70) {
      return {
        level: "Low-Moderate",
        color: "blue",
        description: "Mostly automatic, occasional planning needed for longer trips"
      };
    }
    if (!homeCharging && chargerDensity === "Excellent") {
      return {
        level: "Moderate",
        color: "amber",
        description: "Requires consistent planning but infrastructure supports it"
      };
    }
    if (!homeCharging || dailyRangeUsage > 70) {
      return {
        level: "High",
        color: "orange",
        description: "Charging becomes a regular part of your mental to-do list"
      };
    }
    return {
      level: "Moderate",
      color: "amber",
      description: "Some mental overhead, manageable with routine"
    };
  };

  const mentalLoad = getMentalLoadLevel();

  // Determine if charging is predictable
  const isChargingPredictable = homeCharging || chargerDensity === "Excellent" || chargerDensity === "Good";

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Charging Fit & Mental Load
        </h2>
        <p className="text-gray-600">
          The hidden factor that determines if you'll love or regret this EV
        </p>
      </div>

      {/* Key Question Grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Can you count on charging? */}
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-start mb-4">
            <div className={`p-3 rounded-lg mr-4 ${isChargingPredictable ? 'bg-green-100' : 'bg-orange-100'}`}>
              <Zap className={`w-6 h-6 ${isChargingPredictable ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                Can you count on charging?
              </h3>
              <p className="text-sm text-gray-600">
                {homeCharging ? (
                  <span className="text-green-700 font-medium">Yes — Home charging gives you control</span>
                ) : chargerDensity === "Excellent" || chargerDensity === "Good" ? (
                  <span className="text-blue-700 font-medium">Mostly — {chargerDensity} public infrastructure in your area</span>
                ) : (
                  <span className="text-orange-700 font-medium">Challenging — {chargerDensity} charger density requires careful planning</span>
                )}
              </p>
            </div>
          </div>
          {!homeCharging && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
              <p className="text-xs text-amber-900">
                <strong>Mental tax:</strong> Without home charging, you'll need to remember to charge
                before it becomes urgent. This adds ongoing cognitive load.
              </p>
            </div>
          )}
        </div>

        {/* How often will you plug in? */}
        <div className="border border-gray-200 rounded-xl p-6">
          <div className="flex items-start mb-4">
            <div className="bg-blue-100 p-3 rounded-lg mr-4">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                How often you'll actually plug in
              </h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{chargingFrequency}</span> based on your {dailyMiles} mi/day commute
                and this vehicle's {realWorldRange} mi real-world range
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Daily range usage:</span>
              <span className="font-semibold text-gray-900">{dailyRangeUsage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  dailyRangeUsage < 50 ? 'bg-green-500' :
                  dailyRangeUsage < 70 ? 'bg-blue-500' :
                  'bg-orange-500'
                }`}
                style={{ width: `${Math.min(dailyRangeUsage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mental Load Assessment */}
      <div className={`border-2 rounded-xl p-6 mb-6 ${
        mentalLoad.color === 'green' ? 'border-green-200 bg-green-50' :
        mentalLoad.color === 'blue' ? 'border-blue-200 bg-blue-50' :
        mentalLoad.color === 'amber' ? 'border-amber-200 bg-amber-50' :
        'border-orange-200 bg-orange-50'
      }`}>
        <div className="flex items-start">
          <div className={`p-3 rounded-lg mr-4 ${
            mentalLoad.color === 'green' ? 'bg-green-100' :
            mentalLoad.color === 'blue' ? 'bg-blue-100' :
            mentalLoad.color === 'amber' ? 'bg-amber-100' :
            'bg-orange-100'
          }`}>
            <Brain className={`w-6 h-6 ${
              mentalLoad.color === 'green' ? 'text-green-600' :
              mentalLoad.color === 'blue' ? 'text-blue-600' :
              mentalLoad.color === 'amber' ? 'text-amber-600' :
              'text-orange-600'
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Predicted Mental Load
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                mentalLoad.color === 'green' ? 'bg-green-200 text-green-900' :
                mentalLoad.color === 'blue' ? 'bg-blue-200 text-blue-900' :
                mentalLoad.color === 'amber' ? 'bg-amber-200 text-amber-900' :
                'bg-orange-200 text-orange-900'
              }`}>
                {mentalLoad.level}
              </span>
            </div>
            <p className="text-gray-700 text-sm">
              {mentalLoad.description}
            </p>
          </div>
        </div>
      </div>

      {/* Where Frustration Usually Shows Up */}
      <div className="border border-gray-200 rounded-xl p-6">
        <div className="flex items-start mb-4">
          <div className="bg-purple-100 p-3 rounded-lg mr-4">
            <AlertTriangle className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Where frustration usually shows up
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Based on patterns from real owner experiences
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {!homeCharging && (
            <div className="flex items-start bg-orange-50 border border-orange-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-gray-900 mb-1">No home charging setup</p>
                <p className="text-gray-700">
                  This is the #1 predictor of EV regret. Public charging works, but it requires treating
                  "find a charger" as a recurring task — not a one-time problem to solve.
                </p>
              </div>
            </div>
          )}

          {dailyRangeUsage > 70 && (
            <div className="flex items-start bg-orange-50 border border-orange-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-gray-900 mb-1">Daily commute uses &gt;{dailyRangeUsage.toFixed(0)}% of range</p>
                <p className="text-gray-700">
                  When your daily routine uses most of the battery, you lose flexibility for spontaneous
                  trips. Weather, traffic, or detours can trigger range anxiety.
                </p>
              </div>
            </div>
          )}

          {homeCharging && dailyRangeUsage < 50 && (
            <div className="flex items-start bg-green-50 border border-green-200 rounded-lg p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-gray-900 mb-1">Ideal setup for stress-free ownership</p>
                <p className="text-gray-700">
                  Home charging + comfortable range buffer means you'll rarely think about charging.
                  This is the setup where people say "I'll never go back to gas."
                </p>
              </div>
            </div>
          )}

          {!homeCharging && (chargerDensity === "Poor" || chargerDensity === "Moderate") && (
            <div className="flex items-start bg-orange-50 border border-orange-200 rounded-lg p-4">
              <AlertTriangle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-gray-900 mb-1">
                  {chargerDensity} charging infrastructure{zipCode && zipCode !== "00000" ? ` in ZIP ${zipCode}` : " in your area"}
                </p>
                <p className="text-gray-700">
                  Limited nearby chargers mean you'll need backup plans. Owners in similar areas report
                  constantly monitoring charge levels and planning routes around chargers.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Insight */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-800">
          <strong>Why this matters more than range:</strong> Range is about capability. Charging fit is about
          whether using that capability feels automatic or requires constant mental overhead. Most EV regret
          traces back to underestimating this daily cognitive load.
        </p>
      </div>
    </div>
  );
};
