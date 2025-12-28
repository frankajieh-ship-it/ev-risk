// core/blocks/registry.ts

import type { Block, Tier } from "../content";

/**
 * Block Metadata
 *
 * Tracks implementation status, dependencies, and documentation for each block
 */
export interface BlockMetadata {
  id: string;
  tier: Tier;
  description: string;
  signalsRequired: string[];
  personalizationSignals?: string[];
  lastUpdated: string; // ISO date (YYYY-MM-DD)
  status: "implemented" | "planned" | "deprecated";
  version: number; // 1, 2, 3... for version tracking
  migratedFrom?: string; // Old section name if migrated
  examples?: string[]; // Example usage scenarios
  testCoverage?: boolean;
}

/**
 * Block Registry
 *
 * Central registry of all blocks for:
 * - Documentation generation
 * - Test coverage tracking
 * - Migration status tracking
 * - Dependency analysis
 */
export const blockRegistry: Record<string, BlockMetadata> = {
  // Tier 1: Safety & Reliability
  "recalls.safety.text.v1": {
    id: "recalls.safety.text.v1",
    tier: 1,
    description: "Shows open recalls with calibrated urgency and completion timeline",
    signalsRequired: ["recalls"],
    personalizationSignals: ["dealerVerification"],
    lastUpdated: "2025-12-28",
    status: "implemented",
    version: 1,
    migratedFrom: "Recalls Section (legacy)",
    examples: [
      "2 open recalls, 1 safety-critical",
      "0 open recalls (clean)",
      "1 recall with dealer completion verified",
    ],
    testCoverage: true,
  },

  "known.failures.text.v1": {
    id: "known.failures.text.v1",
    tier: 1,
    description: "Known failure modes and stranded risk for specific model years",
    signalsRequired: ["modelYear", "knownIssues"],
    lastUpdated: "2025-12-28",
    status: "planned",
    version: 1,
    examples: [
      "2017 Bolt: High-voltage battery contactor known issue",
      "2018 Leaf: Passive cooling degradation in hot climates",
    ],
    testCoverage: false,
  },

  // Tier 2: Battery Health
  "battery.health.metric.v1": {
    id: "battery.health.metric.v1",
    tier: 2,
    description: "Battery degradation estimation with replacement timeline",
    signalsRequired: ["batteryData"],
    personalizationSignals: ["annualMileage", "chargingPatterns"],
    lastUpdated: "2025-12-28",
    status: "implemented",
    version: 1,
    migratedFrom: "Battery Health Section (legacy)",
    examples: [
      "12% degradation, medium confidence (no annual mileage)",
      "12% degradation, high confidence (with annual mileage)",
      "No battery data (withheld)",
    ],
    testCoverage: true,
  },

  "battery.trajectory.metric.v1": {
    id: "battery.trajectory.metric.v1",
    tier: 2,
    description: "Projected battery degradation trajectory over time",
    signalsRequired: ["batteryData", "vehicleAge"],
    personalizationSignals: ["annualMileage", "climateZone"],
    lastUpdated: "2025-12-28",
    status: "planned",
    version: 1,
    examples: [
      "Projected 18% degradation by year 7",
      "Replacement likely needed in 3-5 years",
    ],
    testCoverage: false,
  },

  // Tier 3: Cost Exposure
  "warranty.gaps.text.v1": {
    id: "warranty.gaps.text.v1",
    tier: 3,
    description: "Battery warranty coverage gaps and exposure",
    signalsRequired: ["warrantyData", "vehicleAge", "mileage"],
    lastUpdated: "2025-12-28",
    status: "planned",
    version: 1,
    examples: [
      "2 years remaining on 8yr/100k warranty",
      "Out of warranty, full replacement exposure",
    ],
    testCoverage: false,
  },

  "maintenance.probability.metric.v1": {
    id: "maintenance.probability.metric.v1",
    tier: 3,
    description: "Probability of major maintenance events in next 3 years",
    signalsRequired: ["vehicleAge", "mileage", "modelReliability"],
    personalizationSignals: ["annualMileage"],
    lastUpdated: "2025-12-28",
    status: "planned",
    version: 1,
    examples: [
      "15% probability of major service in next 3 years",
      "High mileage vehicle: 35% probability",
    ],
    testCoverage: false,
  },

  // Tier 4: Convenience & Fit
  "range.fit.metric.v1": {
    id: "range.fit.metric.v1",
    tier: 4,
    description: "Daily commute fit assessment with margin calculation",
    signalsRequired: ["estimatedRange"],
    personalizationSignals: ["dailyCommute", "weeklyMileage"],
    lastUpdated: "2025-12-28",
    status: "planned",
    version: 1,
    examples: [
      "45 miles/day uses 20% of range (excellent fit)",
      "85 miles/day uses 38% of range (good fit)",
      "125 miles/day uses 55% of range (challenging fit)",
    ],
    testCoverage: false,
  },

  "charging.infra.text.v1": {
    id: "charging.infra.text.v1",
    tier: 4,
    description: "Charging infrastructure assessment and cost impact",
    signalsRequired: ["chargingNetwork"],
    personalizationSignals: ["homeCharging", "zipCode"],
    lastUpdated: "2025-12-28",
    status: "planned",
    version: 1,
    examples: [
      "Home charging: 60% cost savings vs public",
      "No home charging: $800-$1200/year additional cost",
      "47 public stations nearby (ZIP: 94105)",
    ],
    testCoverage: false,
  },
};

/**
 * Registry Utilities
 */

/**
 * Get all blocks by tier
 */
export function getBlocksByTier(tier: Tier): BlockMetadata[] {
  return Object.values(blockRegistry)
    .filter(b => b.tier === tier)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Get all implemented blocks
 */
export function getImplementedBlocks(): BlockMetadata[] {
  return Object.values(blockRegistry)
    .filter(b => b.status === "implemented")
    .sort((a, b) => (a.tier - b.tier) || a.id.localeCompare(b.id));
}

/**
 * Get blocks missing test coverage
 */
export function getBlocksMissingTests(): BlockMetadata[] {
  return Object.values(blockRegistry)
    .filter(b => b.status === "implemented" && !b.testCoverage)
    .sort((a, b) => (a.tier - b.tier) || a.id.localeCompare(b.id));
}

/**
 * Get blocks by status
 */
export function getBlocksByStatus(status: BlockMetadata["status"]): BlockMetadata[] {
  return Object.values(blockRegistry)
    .filter(b => b.status === status)
    .sort((a, b) => (a.tier - b.tier) || a.id.localeCompare(b.id));
}

/**
 * Get blocks requiring specific signal
 */
export function getBlocksRequiringSignal(signal: string): BlockMetadata[] {
  return Object.values(blockRegistry)
    .filter(b =>
      b.signalsRequired.includes(signal) ||
      b.personalizationSignals?.includes(signal)
    )
    .sort((a, b) => (a.tier - b.tier) || a.id.localeCompare(b.id));
}

/**
 * Generate migration status report
 */
export function getMigrationStatus(): {
  total: number;
  implemented: number;
  planned: number;
  deprecated: number;
  percentComplete: number;
} {
  const blocks = Object.values(blockRegistry);
  const total = blocks.length;
  const implemented = blocks.filter(b => b.status === "implemented").length;
  const planned = blocks.filter(b => b.status === "planned").length;
  const deprecated = blocks.filter(b => b.status === "deprecated").length;

  return {
    total,
    implemented,
    planned,
    deprecated,
    percentComplete: Math.round((implemented / total) * 100),
  };
}

/**
 * Generate test coverage report
 */
export function getTestCoverageStatus(): {
  total: number;
  tested: number;
  untested: number;
  percentCovered: number;
} {
  const implemented = getImplementedBlocks();
  const total = implemented.length;
  const tested = implemented.filter(b => b.testCoverage).length;
  const untested = total - tested;

  return {
    total,
    tested,
    untested,
    percentCovered: total > 0 ? Math.round((tested / total) * 100) : 0,
  };
}

/**
 * Validate block ID matches registry
 */
export function validateBlock(block: Block): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const metadata = blockRegistry[block.id];

  if (!metadata) {
    errors.push(`Block ID "${block.id}" not found in registry`);
    return { valid: false, errors };
  }

  if (metadata.status === "deprecated") {
    errors.push(`Block "${block.id}" is deprecated`);
  }

  if (block.tier !== metadata.tier) {
    errors.push(`Block tier mismatch: expected ${metadata.tier}, got ${block.tier}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get registry documentation in markdown format
 */
export function generateRegistryDocs(): string {
  const lines: string[] = [];

  lines.push("# Block Registry");
  lines.push("");
  lines.push("**Auto-generated documentation from block registry**");
  lines.push("");

  const status = getMigrationStatus();
  const coverage = getTestCoverageStatus();

  lines.push("## Status Overview");
  lines.push("");
  lines.push(`- **Total Blocks**: ${status.total}`);
  lines.push(`- **Implemented**: ${status.implemented} (${status.percentComplete}%)`);
  lines.push(`- **Planned**: ${status.planned}`);
  lines.push(`- **Test Coverage**: ${coverage.tested}/${coverage.total} (${coverage.percentCovered}%)`);
  lines.push("");

  for (let tier = 1; tier <= 4; tier++) {
    const tierBlocks = getBlocksByTier(tier as Tier);
    if (tierBlocks.length === 0) continue;

    const tierLabels = {
      1: "Safety & Reliability",
      2: "Battery Health",
      3: "Cost Exposure",
      4: "Convenience & Fit",
    };

    lines.push(`## Tier ${tier}: ${tierLabels[tier as 1|2|3|4]}`);
    lines.push("");

    for (const block of tierBlocks) {
      const statusBadge =
        block.status === "implemented" ? "✅" :
        block.status === "planned" ? "⏳" : "❌";

      const testBadge = block.testCoverage ? "🧪" : "";

      lines.push(`### ${statusBadge} ${testBadge} ${block.id}`);
      lines.push("");
      lines.push(`**Description**: ${block.description}`);
      lines.push("");
      lines.push(`**Signals Required**: ${block.signalsRequired.join(", ")}`);

      if (block.personalizationSignals?.length) {
        lines.push(`**Personalization Signals**: ${block.personalizationSignals.join(", ")}`);
      }

      lines.push(`**Last Updated**: ${block.lastUpdated}`);
      lines.push(`**Version**: v${block.version}`);

      if (block.migratedFrom) {
        lines.push(`**Migrated From**: ${block.migratedFrom}`);
      }

      if (block.examples?.length) {
        lines.push("");
        lines.push("**Examples**:");
        for (const example of block.examples) {
          lines.push(`- ${example}`);
        }
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}
