/**
 * Report Data Structures
 *
 * Defines the complete report schema with all analysis results
 */

export interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  trim?: string;
  mileage: number;
  vin?: string;
  price?: number;
}

export interface UserInputs {
  zipCode: string;
  dailyMiles: number;
  homeCharging: boolean;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';

  // Extended inputs (future)
  climate?: 'hot' | 'mild_cold' | 'unsure';
  documents?: Array<'battery_health' | 'service_records' | 'obd_screenshots'>;
}

export interface KnownDataPoint {
  label: string;
  value: string | number;
  confidence: 'high' | 'medium' | 'low' | 'user_provided';
  source: string; // e.g., "AutoTrader listing", "User input"
}

export interface UnknownDataPoint {
  field: string;
  importance: 'critical' | 'high' | 'medium';
  whyItMatters: string;
  howToFind: string;
}

export interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  explanation: string;
  mitigationSteps?: string[];
}

export interface AnalysisResults {
  // What we know
  known: KnownDataPoint[];

  // What we don't know
  unknown: UnknownDataPoint[];

  // Identified risks
  risks: RiskFactor[];

  // Overall confidence (0-100)
  confidenceScore: number;

  // Actionable next steps
  nextSteps: string[];

  // Overall recommendation
  overallConfidence: 'high' | 'medium' | 'low';
}

export interface Report {
  id: string; // UUID
  timestamp: Date;
  sourceUrl?: string; // Listing URL if provided

  // Vehicle information
  vehicle: VehicleInfo;

  // User inputs
  userInputs: UserInputs;

  // Analysis results
  analysis: AnalysisResults;

  // Buy confidence score (legacy - may deprecate)
  buyConfidence?: {
    score: number;
    color: string;
    label: string;
    breakdown: any;
  };

  // Status tracking
  status: 'draft' | 'paid' | 'free';
  is_free?: boolean;

  // Metadata
  created_at: Date;
  updated_at?: Date;
}

export interface ProcessingStatus {
  processId: string;
  status: 'extracting' | 'analyzing' | 'identifying' | 'assessing' | 'generating' | 'complete';
  progress: number; // 0-100
  message: string;
  complete: boolean;
  result?: Report;
  error?: string;
}
