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

// ============================================
// P0/P1: SEASONAL SENSITIVITY TYPES
// ============================================

/**
 * Climate Seasonality - User's area climate type
 */
export type ClimateSeasonality =
  | "MILD"
  | "COLD_WINTER"
  | "HOT_SUMMER"
  | "MIXED"
  | "UNKNOWN";

/**
 * Winter Long Days - Frequency of long driving days in winter
 */
export type WinterLongDays =
  | "RARE"
  | "MONTHLY"
  | "WEEKLY"
  | "UNKNOWN";

/**
 * Parked Outside - Cold-soak sensitivity proxy
 */
export type ParkedOutside =
  | "YES"
  | "NO"
  | "SOMETIMES"
  | "UNKNOWN";

/**
 * Seasonal Sensitivity Level - Engine output
 */
export type SeasonalSensitivity = "LOW" | "MEDIUM" | "HIGH";

/**
 * Seasonal Trigger Tags - Specific seasonal friction indicators
 */
export type SeasonalTriggerTag =
  | "WINTER_BUFFER_COMPRESSION"
  | "COLD_RECOVERY_RISK"
  | "COLD_START_PRECONDITIONING"
  | "SUMMER_HEAT_DEGRADATION";

// ============================================
// P0/P1: PREDICTABILITY TYPES
// ============================================

/**
 * Charging Anchor Type - Primary charging location
 */
export type ChargingAnchorType =
  | "HOME"
  | "WORK"
  | "DESTINATION"
  | "PUBLIC_ANCHOR"
  | "NONE";

/**
 * Backup Option - Reliability of backup charging
 */
export type BackupOption =
  | "YES_RELIABLE"
  | "MAYBE"
  | "NONE"
  | "UNKNOWN";

/**
 * Public Anchor Reliability - For public charging anchor users
 */
export type PublicAnchorReliability =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "UNKNOWN";

/**
 * Predictability Level - Engine output
 */
export type PredictabilityLevel = "HIGH" | "MEDIUM" | "LOW";

// ============================================
// P0/P1: PLANNING & THREAD TYPES
// ============================================

/**
 * Planning Tolerance - Derived from execution/downtime tolerance
 */
export type PlanningTolerance = "LOW" | "MEDIUM" | "HIGH";

/**
 * Thread Type - Reddit thread context for analytics
 */
export type ThreadType =
  | "first_ev"
  | "no_home_charging"
  | "comparison"
  | "relocation"
  | "winter"
  | "battery_health"
  | "company_car"
  | "general";
