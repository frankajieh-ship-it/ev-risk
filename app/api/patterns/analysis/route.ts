/**
 * Behavioral Pattern Analysis API
 *
 * GET /api/patterns/analysis
 * Returns aggregated insights and pattern clusters
 */

import { NextRequest, NextResponse } from "next/server";
import type {
  BehavioralPatternRecord,
  PatternAnalysis,
  HousingType,
  Region,
} from "@/types/behavioralPatterns";

// Import from parent route (in production, use shared database)
// For MVP, we'll need to fetch from the main endpoint
async function fetchPatterns(adminKey: string): Promise<BehavioralPatternRecord[]> {
  // In production, this would query the database directly
  // For now, return empty array (will be populated via POST to /api/patterns)
  return [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adminKey = searchParams.get("key");

    // Admin authentication
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const patterns = await fetchPatterns(adminKey);

    // Analyze patterns and create clusters
    const analyses = generatePatternAnalyses(patterns);

    return NextResponse.json({
      success: true,
      total_patterns: patterns.length,
      pattern_clusters: analyses,
      insights: generateKeyInsights(patterns),
    });
  } catch (error: any) {
    console.error("[Pattern Analysis] Error:", error);
    return NextResponse.json(
      { error: "Failed to analyze patterns", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Generate pattern cluster analyses
 */
function generatePatternAnalyses(
  patterns: BehavioralPatternRecord[]
): PatternAnalysis[] {
  if (patterns.length === 0) {
    return [];
  }

  // Cluster 1: "More chargers ≠ less anxiety"
  const quantityVsAnxiety = patterns.filter((p) =>
    p.behavioral_pattern.pre_purchase_assumption
      .toLowerCase()
      .includes("more chargers")
  );

  // Cluster 2: "Predictability > Availability"
  const predictabilityGap = patterns.filter(
    (p) =>
      p.tags.includes("predictability_issue") &&
      !p.tags.includes("availability_issue")
  );

  // Cluster 3: "Apartment + Public Only = High Friction"
  const apartmentFriction = patterns.filter(
    (p) =>
      p.user_context.housing === "apartment" &&
      (p.user_context.charging_access === "public_only" ||
        p.user_context.charging_access === "dcfc_primary")
  );

  const clusters: PatternAnalysis[] = [];

  if (quantityVsAnxiety.length > 0) {
    clusters.push(createAnalysis("Charger quantity ≠ reduced anxiety", quantityVsAnxiety));
  }

  if (predictabilityGap.length > 0) {
    clusters.push(
      createAnalysis("Predictability matters more than availability", predictabilityGap)
    );
  }

  if (apartmentFriction.length > 0) {
    clusters.push(
      createAnalysis("Apartment + Public-only charging = High friction", apartmentFriction)
    );
  }

  return clusters;
}

/**
 * Create a pattern analysis from a cluster
 */
function createAnalysis(
  clusterName: string,
  patterns: BehavioralPatternRecord[]
): PatternAnalysis {
  const housingBreakdown: Record<HousingType, number> = {
    apartment: 0,
    condo: 0,
    single_family_home: 0,
    townhouse: 0,
    other: 0,
  };

  const regionBreakdown: Record<Region, number> = {
    Northeast: 0,
    Southeast: 0,
    Midwest: 0,
    Southwest: 0,
    West: 0,
    Pacific_Northwest: 0,
    Mountain_West: 0,
    International: 0,
  };

  const rootCauseMap: Record<string, number> = {};
  let totalCognitiveLoad = 0;
  const sampleQuotes: string[] = [];

  const outcomeDistribution = {
    adapted_successfully: 0,
    ongoing_friction: 0,
    regret: 0,
    resolved: 0,
  };

  patterns.forEach((p) => {
    // Housing breakdown
    housingBreakdown[p.user_context.housing] += 1;

    // Region breakdown
    regionBreakdown[p.user_context.region] += 1;

    // Root causes
    const rootCause = p.behavioral_pattern.root_cause;
    rootCauseMap[rootCause] = (rootCauseMap[rootCause] || 0) + 1;

    // Cognitive load
    totalCognitiveLoad += p.behavioral_pattern.cognitive_load_rating;

    // Sample quotes
    if (sampleQuotes.length < 5) {
      sampleQuotes.push(p.behavioral_pattern.pre_purchase_assumption);
    }

    // Outcome distribution
    outcomeDistribution[p.behavioral_pattern.outcome] += 1;
  });

  const commonRootCauses = Object.entries(rootCauseMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cause]) => cause);

  return {
    pattern_cluster: clusterName,
    frequency: patterns.length,
    housing_breakdown: housingBreakdown,
    region_breakdown: regionBreakdown,
    avg_cognitive_load: totalCognitiveLoad / patterns.length,
    common_root_causes: commonRootCauses,
    sample_quotes: sampleQuotes,
    outcome_distribution: outcomeDistribution,
  };
}

/**
 * Generate key insights summary
 */
function generateKeyInsights(patterns: BehavioralPatternRecord[]) {
  if (patterns.length === 0) {
    return {
      summary: "No patterns collected yet.",
      recommendations: [],
    };
  }

  const avgCognitiveLoad =
    patterns.reduce((sum, p) => sum + p.behavioral_pattern.cognitive_load_rating, 0) /
    patterns.length;

  const perceptionGapCount = patterns.filter((p) =>
    p.tags.includes("perception_gap")
  ).length;

  const adaptationSuccessRate =
    patterns.filter((p) => p.behavioral_pattern.outcome === "adapted_successfully")
      .length / patterns.length;

  return {
    summary: `Analyzed ${patterns.length} behavioral patterns. Average cognitive load: ${avgCognitiveLoad.toFixed(1)}/5. Perception gap detected in ${((perceptionGapCount / patterns.length) * 100).toFixed(0)}% of cases.`,
    avg_cognitive_load: avgCognitiveLoad,
    perception_gap_rate: perceptionGapCount / patterns.length,
    adaptation_success_rate: adaptationSuccessRate,
    recommendations: generateRecommendations(patterns),
  };
}

/**
 * Generate product recommendations based on patterns
 */
function generateRecommendations(patterns: BehavioralPatternRecord[]): string[] {
  const recommendations: string[] = [];

  // Check for predictability issues
  const predictabilityIssues = patterns.filter((p) =>
    p.tags.includes("predictability_issue")
  ).length;

  if (predictabilityIssues > patterns.length * 0.3) {
    recommendations.push(
      "Emphasize charging predictability over charger count in copy"
    );
  }

  // Check for apartment friction
  const apartmentFriction = patterns.filter(
    (p) => p.user_context.housing === "apartment" && p.behavioral_pattern.cognitive_load_rating >= 4
  ).length;

  if (apartmentFriction > 0) {
    recommendations.push(
      "Create apartment-specific guidance emphasizing backup plan proximity"
    );
  }

  // Check for perception gaps
  const perceptionGaps = patterns.filter((p) => p.tags.includes("perception_gap")).length;

  if (perceptionGaps > patterns.length * 0.4) {
    recommendations.push(
      "Add 'What buyers assume vs. reality' comparison in charging fit block"
    );
  }

  return recommendations;
}
