/**
 * PersonalizationPrompt Component
 *
 * Integrates Block ask() pattern with personalization flow
 * Shows value proposition and connects to data collection
 */

import React from "react";
import type { PersonalizationAsk } from "@/core/content";

interface PersonalizationPromptProps {
  ask: PersonalizationAsk;
  onProvide: (key: string, value: any) => void;
  variant?: "inline" | "card";
}

/**
 * Inline personalization prompt (used within BlockRenderer)
 */
export function PersonalizationPrompt({
  ask,
  onProvide,
  variant = "inline",
}: PersonalizationPromptProps) {
  if (variant === "card") {
    return <PersonalizationCard ask={ask} onProvide={onProvide} />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="mb-2 flex items-start gap-2">
        <span className="text-xl">💡</span>
        <div className="flex-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-600">
            Personalization Available
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">
            {ask.message}
          </p>
        </div>
      </div>

      <button
        onClick={() => handleProvideClick(ask.key, onProvide)}
        className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        {getButtonLabel(ask.key)}
      </button>
    </div>
  );
}

/**
 * Card variant (larger, more prominent)
 */
function PersonalizationCard({
  ask,
  onProvide,
}: {
  ask: PersonalizationAsk;
  onProvide: (key: string, value: any) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-lg">
      <div className="mb-4 flex items-start gap-3">
        <span className="text-3xl">💡</span>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900">
            Get a more personalized assessment
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            {ask.message}
          </p>
        </div>
      </div>

      <button
        onClick={() => handleProvideClick(ask.key, onProvide)}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        {getButtonLabel(ask.key)}
      </button>
    </div>
  );
}

/**
 * Handle personalization click
 *
 * In production, this would:
 * 1. Open personalization modal/form
 * 2. Pre-focus specific input field
 * 3. Show value prop in modal header
 */
function handleProvideClick(key: string, onProvide: (key: string, value: any) => void) {
  // For now, call onProvide with key
  // In production, this would open a modal/form
  onProvide(key, true);
}

/**
 * Get user-friendly button label for personalization key
 */
function getButtonLabel(key: string): string {
  const labels: Record<string, string> = {
    annualMileage: "Add your annual mileage",
    dailyCommute: "Add your daily commute",
    homeCharging: "Add your charging setup",
    zipCode: "Add your location",
    chargingPatterns: "Add your charging habits",
    riskTolerance: "Set your risk tolerance",
    budgetConstraints: "Set your budget",
    weeklyMileage: "Add your weekly mileage",
    climateZone: "Add your climate zone",
    dealerVerification: "Verify with dealer",
  };

  return labels[key] || `Provide ${key}`;
}

/**
 * Integration Utilities
 */

/**
 * Map block ask keys to existing personalization form fields
 */
export const personalizationKeyMapping: Record<string, {
  formField: string;
  inputType: "number" | "text" | "boolean" | "select";
  placeholder?: string;
  options?: string[];
}> = {
  annualMileage: {
    formField: "annualMileage",
    inputType: "number",
    placeholder: "e.g., 12,000 miles/year",
  },
  dailyCommute: {
    formField: "dailyMiles",
    inputType: "number",
    placeholder: "e.g., 45 miles/day",
  },
  homeCharging: {
    formField: "homeCharging",
    inputType: "boolean",
  },
  zipCode: {
    formField: "zipCode",
    inputType: "text",
    placeholder: "e.g., 94105",
  },
  chargingPatterns: {
    formField: "chargingPatterns",
    inputType: "select",
    options: ["Daily overnight", "Opportunistic", "DC fast charging"],
  },
  riskTolerance: {
    formField: "riskTolerance",
    inputType: "select",
    options: ["Conservative", "Moderate", "Aggressive"],
  },
  weeklyMileage: {
    formField: "weeklyMileage",
    inputType: "number",
    placeholder: "e.g., 300 miles/week",
  },
};

/**
 * Collect all personalization asks from blocks
 */
export function collectPersonalizationAsks(
  blocks: Array<{ ask?: (ctx: any) => PersonalizationAsk | undefined }>,
  ctx: any
): PersonalizationAsk[] {
  const asks: PersonalizationAsk[] = [];

  for (const block of blocks) {
    const ask = block.ask?.(ctx);
    if (ask) {
      asks.push(ask);
    }
  }

  // Deduplicate by key
  const seen = new Set<string>();
  return asks.filter(ask => {
    if (seen.has(ask.key)) return false;
    seen.add(ask.key);
    return true;
  });
}

/**
 * Prioritize personalization asks by impact
 *
 * Returns asks sorted by:
 * 1. Tier (lower tier = higher priority)
 * 2. Impact on confidence
 */
export function prioritizePersonalizationAsks(
  asks: Array<PersonalizationAsk & { tier?: number; confidenceBonus?: number }>
): PersonalizationAsk[] {
  return [...asks].sort((a, b) => {
    // Sort by tier first (lower tier = higher priority)
    if (a.tier !== undefined && b.tier !== undefined && a.tier !== b.tier) {
      return a.tier - b.tier;
    }

    // Then by confidence bonus (higher bonus = higher priority)
    if (a.confidenceBonus !== undefined && b.confidenceBonus !== undefined) {
      return b.confidenceBonus - a.confidenceBonus;
    }

    return 0;
  });
}

/**
 * Example integration with PersonalizationOpportunityCard
 */
export function PersonalizationAggregator({
  asks,
  onProvide,
}: {
  asks: PersonalizationAsk[];
  onProvide: (key: string, value: any) => void;
}) {
  if (asks.length === 0) return null;

  // Show top 3 most impactful asks
  const topAsks = asks.slice(0, 3);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900">
        Personalize Your Assessment
      </h3>
      <p className="text-sm text-slate-700">
        Adding these details will increase confidence and tailor recommendations to your situation:
      </p>

      <div className="space-y-2">
        {topAsks.map((ask) => (
          <PersonalizationPrompt
            key={ask.key}
            ask={ask}
            onProvide={onProvide}
            variant="inline"
          />
        ))}
      </div>

      {asks.length > 3 && (
        <p className="text-sm text-slate-600">
          + {asks.length - 3} more personalization{asks.length - 3 > 1 ? "s" : ""} available
        </p>
      )}
    </div>
  );
}
