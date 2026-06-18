/**
 * Vehicle-specific knowledge injection for receipt generation.
 *
 * Looks up known issues, battery warranty, and lease-return market context
 * for a given year/make/model and returns a formatted block for prompt injection.
 */

import ownerIssueClusters from "@/data_v1.0/owner_issue_clusters.json";

interface IssueCluster {
  common_issues: Array<{
    category: string;
    frequency: string;
    issues: string[];
    severity: string;
    typical_age: string;
  }>;
  reliability_score: number;
}

// Battery warranty by make/model key (normalized). Values are human-readable strings.
const BATTERY_WARRANTIES: Record<string, string> = {
  "kia ev6":            "10 years / 100,000 miles (Kia EV6 — verify transfer to used buyer)",
  "hyundai ioniq 5":    "10 years / 100,000 miles (Hyundai Ioniq 5 — verify transfer to used buyer)",
  "hyundai ioniq 6":    "10 years / 100,000 miles (Hyundai Ioniq 6 — verify transfer to used buyer)",
  "tesla model 3":      "8 years / 100,000–120,000 miles depending on trim (Tesla standard warranty)",
  "tesla model y":      "8 years / 100,000–120,000 miles depending on trim (Tesla standard warranty)",
  "tesla model s":      "8 years / 150,000 miles (Tesla Model S)",
  "tesla model x":      "8 years / 150,000 miles (Tesla Model X)",
  "chevrolet bolt":     "8 years / 100,000 miles (Chevy Bolt — confirm post-recall battery status)",
  "chevy bolt":         "8 years / 100,000 miles (Chevy Bolt — confirm post-recall battery status)",
  "nissan leaf":        "8 years / 100,000 miles for 40kWh+ pack; 5 years / 60,000 miles for 24kWh pack",
  "ford mustang mach-e":"8 years / 100,000 miles (Ford Mach-E)",
  "volkswagen id.4":    "8 years / 100,000 miles (VW ID.4)",
  "bmw ix":             "8 years / 100,000 miles (BMW iX)",
  "rivian r1t":         "8 years / 175,000 miles (Rivian R1T)",
  "rivian r1s":         "8 years / 175,000 miles (Rivian R1S)",
  "kia ev9":            "10 years / 100,000 miles (Kia EV9 — verify transfer to used buyer)",
};

// Models where 2022–2023 lease-return wave is active
const LEASE_RETURN_MODELS = new Set([
  "ev6",
  "ioniq 5",
  "model 3",
  "model y",
  "mustang mach-e",
  "mach-e",
  "id.4",
  "id4",
]);

export interface ModelKnowledge {
  known_issues_block: string;
  battery_warranty: string | null;
  lease_return_note: string | null;
  reliability_score: number;
}

function normalizeKey(make: string, model: string): string {
  return `${make} ${model}`.toLowerCase().trim();
}

export function getModelKnowledge(
  year: number | null,
  make: string,
  model: string
): ModelKnowledge | null {
  if (!make || !model) return null;

  const key = normalizeKey(make, model);
  const clusters = ownerIssueClusters as Record<string, IssueCluster>;

  // Find matching entry — try exact normalized key first, then partial match
  let entry: IssueCluster | null = null;
  for (const [k, v] of Object.entries(clusters)) {
    if (normalizeKey(k, "").startsWith(make.toLowerCase()) && k.toLowerCase().includes(model.toLowerCase())) {
      entry = v;
      break;
    }
    // Direct match on full key
    const fullKey = k.toLowerCase().trim();
    if (fullKey === key || key.startsWith(fullKey) || fullKey.startsWith(key)) {
      entry = v;
      break;
    }
  }

  if (!entry) return null;

  // Format known issues
  const issueLines = entry.common_issues.map((issue) => {
    const issueList = issue.issues.join(", ");
    return `- ${issue.category} (${issue.frequency} frequency, ${issue.severity} severity, typical age ${issue.typical_age}): ${issueList}`;
  });
  const known_issues_block = `Known issues for ${make} ${model}:\n${issueLines.join("\n")}`;

  // Battery warranty lookup
  const battery_warranty = BATTERY_WARRANTIES[key] ?? null;

  // Lease-return wave detection — 2022 and 2023 model years only
  let lease_return_note: string | null = null;
  if (year === 2022 || year === 2023) {
    const modelLower = model.toLowerCase().trim();
    for (const leaseModel of LEASE_RETURN_MODELS) {
      if (modelLower.includes(leaseModel) || leaseModel.includes(modelLower)) {
        lease_return_note =
          `${year} ${make} ${model} lease returns are flooding the market right now — ` +
          `prices are compressed. A listing priced significantly above comparable lease returns ` +
          `may not hold value. Lease returns typically have unknown charging history — flag battery_proof_missing if no charging data is shown.`;
        break;
      }
    }
  }

  return {
    known_issues_block,
    battery_warranty,
    lease_return_note,
    reliability_score: entry.reliability_score,
  };
}
