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
 * Context Trigger - Why the user is checking
 */
export type ContextTrigger =
  | "moved_home"
  | "changed_commute"
  | "changed_schedule"
  | "charging_changed"
  | "just_rechecking";

/**
 * Charging Access Type
 */
export type ChargingAccess =
  | "home_l2"
  | "apartment_shared_l2"
  | "public_l2"
  | "dc_fast_primary"
  | "mixed";

/**
 * Charging Reliability
 */
export type Reliability =
  | "usually_available"
  | "sometimes_available"
  | "unpredictable";

/**
 * Weekly Charging Moments
 */
export type WeeklyChargingMoments = "1_2" | "3_4" | "5_plus";

/**
 * User Inputs Types
 */
export interface UserInputs {
  // Context
  contextTrigger?: ContextTrigger;

  // Driving patterns
  annualMileage?: number;
  dailyCommute?: number;
  weeklyMileage?: number;

  // Charging
  hasHomeCharging?: boolean;
  chargingPatterns?: "daily_overnight" | "opportunistic" | "dc_fast";

  // Charging Fit (Mental Overhead v1)
  chargingAccess?: ChargingAccess;
  chargingReliability?: Reliability;
  weeklyChargingMoments?: WeeklyChargingMoments;

  // Location
  zipCode?: string;
  climateZone?: "hot" | "moderate" | "cold";

  // Risk
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  budgetConstraints?: number;

  // Verification
  dealerVerification?: boolean;
}
