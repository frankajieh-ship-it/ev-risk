/**
 * Risk Assessment Engine
 *
 * Evaluates EV battery risk based on available data
 * Clearly tracks what we know vs. what we don't know
 */

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

export interface RiskAssessment {
  // What we know
  knownData: KnownDataPoint[];

  // What we don't know
  unknownData: UnknownDataPoint[];

  // Identified risks
  risks: RiskFactor[];

  // Overall confidence in assessment
  overallConfidence: 'high' | 'medium' | 'low';

  // Recommended next steps
  nextSteps: string[];
}

export class RiskAssessor {
  private static RISK_FACTORS = {
    BATTERY_AGE: 'battery_age',
    MILEAGE: 'mileage',
    CLIMATE: 'climate',
    CHARGING_PATTERN: 'charging_pattern',
    SERVICE_HISTORY: 'service_history',
    WARRANTY: 'warranty',
    FAST_CHARGING: 'fast_charging',
  };

  /**
   * Assess risk based on available vehicle data and user inputs
   */
  static assess(vehicleData: any, userInputs: any): RiskAssessment {
    const known: KnownDataPoint[] = [];
    const unknown: UnknownDataPoint[] = [];
    const risks: RiskFactor[] = [];

    // Process known data from listing
    if (vehicleData.year) {
      const batteryAge = new Date().getFullYear() - vehicleData.year;
      known.push({
        label: 'Vehicle Age',
        value: `${batteryAge} years (${vehicleData.year} model)`,
        confidence: 'high',
        source: vehicleData.dataSource ? `${vehicleData.dataSource} listing` : 'User input',
      });

      // Assess age-related risk
      if (batteryAge > 8) {
        risks.push({
          factor: this.RISK_FACTORS.BATTERY_AGE,
          severity: 'high',
          message: 'Battery is beyond typical warranty period',
          explanation: 'Most EV batteries have 8-year/100k mile warranties. Replacement costs $5k-$20k.',
          mitigationSteps: [
            'Request battery health report from dealer',
            'Budget for potential battery replacement',
            'Consider extended warranty if available',
          ],
        });
      } else if (batteryAge > 5) {
        risks.push({
          factor: this.RISK_FACTORS.BATTERY_AGE,
          severity: 'medium',
          message: 'Battery entering higher degradation phase',
          explanation: 'Degradation typically accelerates after 5 years (2-3% per year becomes 4-5%).',
        });
      }
    }

    if (vehicleData.mileage) {
      known.push({
        label: 'Current Mileage',
        value: `${vehicleData.mileage.toLocaleString()} miles`,
        confidence: 'high',
        source: vehicleData.dataSource ? `${vehicleData.dataSource} listing` : 'User input',
      });

      // Assess mileage-related risk
      if (vehicleData.mileage > 100000) {
        risks.push({
          factor: this.RISK_FACTORS.MILEAGE,
          severity: 'high',
          message: 'High mileage indicates significant battery use',
          explanation: 'At 100k+ miles, expect 15-25% capacity loss on most EVs.',
          mitigationSteps: [
            'Request battery diagnostic report',
            'Test drive to verify actual range',
            'Check for battery warranty coverage',
          ],
        });
      } else if (vehicleData.mileage > 60000) {
        risks.push({
          factor: this.RISK_FACTORS.MILEAGE,
          severity: 'medium',
          message: 'Moderate mileage - typical degradation expected',
          explanation: 'Expected 8-15% capacity loss at this mileage.',
        });
      }
    }

    if (vehicleData.make && vehicleData.model) {
      known.push({
        label: 'Vehicle Model',
        value: `${vehicleData.make} ${vehicleData.model}`,
        confidence: 'high',
        source: vehicleData.dataSource ? `${vehicleData.dataSource} listing` : 'User input',
      });
    }

    if (vehicleData.trim) {
      known.push({
        label: 'Trim/Battery Size',
        value: vehicleData.trim,
        confidence: 'medium',
        source: vehicleData.dataSource ? `${vehicleData.dataSource} listing` : 'User input',
      });
    }

    if (vehicleData.price) {
      known.push({
        label: 'Asking Price',
        value: `$${vehicleData.price.toLocaleString()}`,
        confidence: 'high',
        source: `${vehicleData.dataSource} listing`,
      });
    }

    if (vehicleData.vin) {
      known.push({
        label: 'VIN',
        value: vehicleData.vin,
        confidence: 'high',
        source: `${vehicleData.dataSource} listing`,
      });
    }

    // Add user-provided data
    if (userInputs.zipCode) {
      known.push({
        label: 'Location (ZIP Code)',
        value: userInputs.zipCode,
        confidence: 'user_provided',
        source: 'User input',
      });
    }

    if (userInputs.dailyMiles) {
      known.push({
        label: 'Expected Daily Use',
        value: `${userInputs.dailyMiles} miles/day (~${(userInputs.dailyMiles * 365).toLocaleString()} miles/year)`,
        confidence: 'user_provided',
        source: 'User input',
      });
    }

    if (typeof userInputs.homeCharging === 'boolean') {
      known.push({
        label: 'Home Charging Access',
        value: userInputs.homeCharging ? 'Yes' : 'No',
        confidence: 'user_provided',
        source: 'User input',
      });

      if (!userInputs.homeCharging) {
        risks.push({
          factor: this.RISK_FACTORS.FAST_CHARGING,
          severity: 'medium',
          message: 'Reliance on public fast charging accelerates degradation',
          explanation: 'Frequent DC fast charging creates more heat stress on the battery.',
          mitigationSteps: [
            'Limit fast charging to 80% when possible',
            'Use Level 2 charging when available',
            'Monitor battery temperature during charging',
          ],
        });
      }
    }

    // Track critical unknowns
    unknown.push({
      field: 'Battery State of Health (SOH)',
      importance: 'critical',
      whyItMatters: 'Directly indicates remaining battery capacity and replacement timeline. A 2022 EV with 20% degradation is worth $5k-$10k less than one with 5% degradation.',
      howToFind: 'Request dealer OBD-II battery diagnostic report. Look for "SOH %" or "Capacity remaining". Apps like LeafSpy (Nissan) or TeslaFi (Tesla) can also show this.',
    });

    unknown.push({
      field: 'Charging History',
      importance: 'high',
      whyItMatters: 'Frequent fast charging and charging to 100% daily accelerates degradation by 20-40% vs. gentle charging habits.',
      howToFind: 'Ask seller about charging habits. For Teslas, check supercharger usage in vehicle history. Some EVs log this in the infotainment system.',
    });

    unknown.push({
      field: 'Service History',
      importance: 'high',
      whyItMatters: 'Shows if battery issues were previously reported/repaired. Also indicates general care level (tire rotations, coolant flushes, etc.).',
      howToFind: 'Request full service records from dealer. Check CARFAX or AutoCheck for reported services.',
    });

    unknown.push({
      field: 'Climate Exposure History',
      importance: 'medium',
      whyItMatters: 'Batteries in hot climates (Arizona, Texas, Florida) degrade 15-25% faster than moderate climates. Cold climates also reduce usable capacity in winter.',
      howToFind: 'Check vehicle registration history. CARFAX shows states where vehicle was registered.',
    });

    if (!vehicleData.vin) {
      unknown.push({
        field: 'Vehicle VIN',
        importance: 'high',
        whyItMatters: 'VIN enables recall lookup, theft check, accident history, and exact battery configuration verification.',
        howToFind: 'Request from seller or dealer. Should be visible on dashboard (driver side) or door jamb.',
      });
    }

    // Calculate overall confidence
    const criticalUnknowns = unknown.filter(u => u.importance === 'critical').length;
    const highSeverityRisks = risks.filter(r => r.severity === 'high' || r.severity === 'critical').length;

    let overallConfidence: 'high' | 'medium' | 'low';
    if (criticalUnknowns > 2 || highSeverityRisks > 2) {
      overallConfidence = 'low';
    } else if (criticalUnknowns > 0 || highSeverityRisks > 0) {
      overallConfidence = 'medium';
    } else {
      overallConfidence = 'high';
    }

    // Generate next steps
    const nextSteps = this.generateNextSteps(unknown, risks);

    return {
      knownData: known,
      unknownData: unknown,
      risks,
      overallConfidence,
      nextSteps,
    };
  }

  /**
   * Generate actionable next steps based on unknowns and risks
   */
  private static generateNextSteps(unknown: UnknownDataPoint[], risks: RiskFactor[]): string[] {
    const steps: string[] = [];

    // Prioritize critical unknowns
    const criticalUnknowns = unknown.filter(u => u.importance === 'critical');
    if (criticalUnknowns.length > 0) {
      steps.push(`**Before purchasing**: ${criticalUnknowns[0].howToFind}`);
    }

    // Add risk mitigation steps
    const highRisks = risks.filter(r => r.severity === 'high' || r.severity === 'critical');
    if (highRisks.length > 0 && highRisks[0].mitigationSteps) {
      steps.push(...highRisks[0].mitigationSteps!.slice(0, 2));
    }

    // Always recommend inspection
    steps.push('Schedule pre-purchase inspection with certified EV technician ($150-$300)');

    // Add VIN check if missing
    if (unknown.some(u => u.field === 'Vehicle VIN')) {
      steps.push('Obtain VIN and run CARFAX/AutoCheck report ($40-$50)');
    } else {
      steps.push('Run CARFAX/AutoCheck report using VIN ($40-$50)');
    }

    // Add warranty check
    steps.push('Verify remaining manufacturer battery warranty coverage');

    return steps.slice(0, 5); // Limit to top 5 actions
  }
}
