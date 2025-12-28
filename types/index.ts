// types/index.ts

/**
 * Vehicle Data Types
 */
export interface VehicleData {
  // Basic info
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  odometer?: number;

  // Battery data
  batteryData?: {
    degradation?: number;  // Percentage
    confidence?: "high" | "medium" | "low";
  };
  batteryHealthReport?: boolean;

  // Recalls
  recalls?: Array<{
    id: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    isSafetyRelated?: boolean;
  }>;

  // Service history
  serviceRecords?: Array<{
    date: string;
    type: string;
    mileage: number;
  }>;

  // Known issues
  knownIssues?: Array<{
    title: string;
    severity: "high" | "medium" | "low";
    description: string;
  }>;

  // Reliability
  reliabilityScore?: number; // 0-100

  // Charging
  chargingCompatibility?: string;

  // Range
  estimatedRange?: number;
  rangeAdequacy?: number; // 0-100

  // Warranty
  warrantyRemaining?: number; // months
}

/**
 * User Inputs Types
 */
export interface UserInputs {
  // Driving patterns
  annualMileage?: number;
  dailyCommute?: number;
  weeklyMileage?: number;

  // Charging
  hasHomeCharging?: boolean;
  chargingPatterns?: "daily_overnight" | "opportunistic" | "dc_fast";

  // Location
  zipCode?: string;
  climateZone?: "hot" | "moderate" | "cold";

  // Risk
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  budgetConstraints?: number;

  // Verification
  dealerVerification?: boolean;
}
