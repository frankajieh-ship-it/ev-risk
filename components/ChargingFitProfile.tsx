// components/ChargingFitProfile.tsx
// THE MOAT - This is what competitors can't replicate
import React from 'react';
import { Zap, Clock, MapPin, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export type ChargingStrategy = 'missing' | 'fragile' | 'stable';

interface ChargingFitProfileProps {
  primaryStrategy: ChargingStrategy;
  primaryDetails: string;
  hasBackupWithin15Min: boolean;
  backupDetails?: string;
  chargingCadence: string;
  failureMode: string;
  homeCharging: boolean;
  chargerDensity: string;
}

const strategyConfig = {
  missing: {
    icon: XCircle,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    iconColor: 'text-red-600',
    badgeColor: 'bg-red-100 text-red-900',
    label: '❌ Missing'
  },
  fragile: {
    icon: AlertTriangle,
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    iconColor: 'text-amber-600',
    badgeColor: 'bg-amber-100 text-amber-900',
    label: '⚠️ Fragile'
  },
  stable: {
    icon: CheckCircle,
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    iconColor: 'text-green-600',
    badgeColor: 'bg-green-100 text-green-900',
    label: '✅ Stable'
  }
};

export const ChargingFitProfile: React.FC<ChargingFitProfileProps> = ({
  primaryStrategy,
  primaryDetails,
  hasBackupWithin15Min,
  backupDetails,
  chargingCadence,
  failureMode,
  homeCharging,
  chargerDensity
}) => {
  const config = strategyConfig[primaryStrategy];
  const Icon = config.icon;

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Charging Fit Profile
        </h2>
        <p className="text-gray-600">
          Your moat — this analysis reflects real owner experience patterns
        </p>
      </div>

      {/* Primary Charging Strategy */}
      <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl p-6 mb-6`}>
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-full ${config.bgColor} border-2 ${config.borderColor}`}>
            <Icon className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Primary charging strategy
              </h3>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${config.badgeColor}`}>
                {config.label}
              </span>
            </div>
            <p className="text-base text-gray-700">
              {primaryDetails}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Key Factors */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Backup Option */}
        <div className="border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Backup option within 10–15 min</h4>
          </div>
          <div className="flex items-center gap-2 mb-2">
            {hasBackupWithin15Min ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={`font-semibold ${hasBackupWithin15Min ? 'text-green-700' : 'text-red-700'}`}>
              {hasBackupWithin15Min ? 'Yes' : 'No'}
            </span>
          </div>
          {backupDetails && (
            <p className="text-sm text-gray-600">{backupDetails}</p>
          )}
        </div>

        {/* Expected Charging Cadence */}
        <div className="border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-gray-900">Expected charging cadence</h4>
          </div>
          <p className="text-lg font-bold text-gray-900">{chargingCadence}</p>
          <p className="text-sm text-gray-600 mt-1">Based on your {homeCharging ? 'home' : 'public'} charging setup</p>
        </div>
      </div>

      {/* Failure Mode */}
      <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-orange-900 mb-2">Failure mode</h4>
            <p className="text-sm text-orange-800">{failureMode}</p>
          </div>
        </div>
      </div>

      {/* Reddit Language Connection */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Why this matters:</strong> This directly reflects Reddit language from real owners.
          Most EV regret traces back to mismatched charging strategies, not battery specs.
        </p>
      </div>
    </div>
  );
};
