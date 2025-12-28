/**
 * Smart Defaults & Auto-Complete System
 *
 * Infers context from IP/location, device, and usage patterns
 * to pre-fill form intelligently without asking users
 */

interface IPLocation {
  state?: string;
  country?: string;
  zipCode?: string;
}

interface InferredContext {
  climateZone?: 'hot' | 'cold' | 'moderate';
  techLevel?: 'comfortable' | 'average' | 'cautious';
  likelyCommuter?: boolean;
  likelyFamilyShopper?: boolean;
}

// Infer from IP/location
export const inferClimate = (ipLocation: IPLocation): 'hot' | 'cold' | 'moderate' => {
  const hotStates = ['AZ', 'TX', 'FL', 'NV', 'CA', 'LA', 'MS', 'AL', 'GA'];
  const coldStates = ['MN', 'WI', 'MI', 'ND', 'SD', 'MT', 'WY', 'ME', 'VT', 'NH', 'AK'];

  if (!ipLocation.state) return 'moderate';

  if (hotStates.includes(ipLocation.state)) return 'hot';
  if (coldStates.includes(ipLocation.state)) return 'cold';
  return 'moderate';
};

// Infer from device/browser
export const inferTechComfort = (): 'comfortable' | 'average' | 'cautious' => {
  if (typeof window === 'undefined') return 'average';

  const userAgent = navigator.userAgent;

  // Users on latest iOS/Android probably more tech-comfortable
  const isModernDevice =
    userAgent.includes('iPhone OS 1') ||
    userAgent.includes('Android 1') ||
    userAgent.includes('Chrome/1') ||
    userAgent.includes('Safari/1');

  // Check for modern browser features
  const hasModernFeatures =
    'serviceWorker' in navigator &&
    'fetch' in window &&
    'Promise' in window;

  if (isModernDevice && hasModernFeatures) return 'comfortable';
  if (hasModernFeatures) return 'average';
  return 'cautious';
};

// Infer lifestyle from time of visit
export const inferUsagePatterns = (): Partial<InferredContext> => {
  if (typeof window === 'undefined') return {};

  const hour = new Date().getHours();
  const day = new Date().getDay();
  const isWeekday = day >= 1 && day <= 5;

  // Morning commute time (7-9 AM on weekdays)
  if (hour >= 7 && hour <= 9 && isWeekday) {
    return { likelyCommuter: true };
  }

  // Evening family shopping time (8-10 PM)
  if (hour >= 20 && hour <= 22) {
    return { likelyFamilyShopper: true };
  }

  return {};
};

// Question context - WHY we're asking
export const questionContext: Record<string, string> = {
  dailyMiles: "So we can check if the EV's range works for your typical day",
  zipCode: "Helps us assess climate impact and local charging infrastructure",
  homeCharging: "Affects which EVs are practical for your situation and ownership costs",
  riskTolerance: "Calibrates recommendations to match your comfort level",
  trim: "Improves battery chemistry and degradation estimates",
  vin: "Enables recall and warranty verification",
};

// Auto-complete form logic
export const autoCompleteForm = (formData: any, context: { ipLocation?: IPLocation }): any => {
  const defaults: any = {};

  // Infer climate if ZIP code is provided but not used yet
  if (formData.zipCode && context.ipLocation) {
    // This would be populated by a reverse geocoding service
    // For now, we'll use it when we have IP location data
  }

  const usagePatterns = inferUsagePatterns();

  // Suggest daily miles based on usage patterns
  if (usagePatterns.likelyCommuter && !formData.dailyMiles) {
    defaults.dailyMiles = 40; // Average US commute is ~32 miles/day
  } else if (usagePatterns.likelyFamilyShopper && !formData.dailyMiles) {
    defaults.dailyMiles = 25; // Family errands
  }

  return {
    ...defaults,
    ...formData, // User data overrides defaults
    _autoCompleted: Object.keys(defaults).filter(k => !formData[k])
  };
};

// Progressive disclosure - only show what's needed
export const showRelevantQuestions = (
  formData: any,
  vehicleData?: { price?: number; techComplexity?: number }
): string[] => {
  const missing: string[] = [];

  // Always need core fields
  if (!formData.model) missing.push('model');
  if (!formData.year) missing.push('year');
  if (!formData.currentMileage) missing.push('currentMileage');
  if (!formData.zipCode) missing.push('zipCode');
  if (!formData.dailyMiles) missing.push('dailyMiles');
  if (formData.homeCharging === undefined) missing.push('homeCharging');
  if (!formData.riskTolerance) missing.push('riskTolerance');

  // Optional but helpful
  if (!formData.trim) missing.push('trim');
  if (!formData.vin) missing.push('vin');

  return missing;
};

// Value-first communication helpers
export const getFieldExplanation = (fieldName: string): string => {
  return questionContext[fieldName] || '';
};

export const getFieldImportance = (fieldName: string): 'required' | 'recommended' | 'optional' => {
  const required = ['model', 'year', 'currentMileage', 'zipCode', 'dailyMiles', 'homeCharging', 'riskTolerance'];
  const optional = ['trim', 'vin'];

  if (required.includes(fieldName)) return 'required';
  if (optional.includes(fieldName)) return 'optional';
  return 'recommended';
};
