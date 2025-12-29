"use client";

/**
 * Quick Pattern Capture Component
 *
 * Purpose: Reduce friction in pattern submission
 * Key Features:
 * - Paste quote → auto-suggest context
 * - One-click emotional tags
 * - Pre-filled templates for common patterns
 * - Smart root cause dropdown
 */

import { useState } from "react";

interface QuickPatternCaptureProps {
  onSubmit: (pattern: any) => void;
  onCancel?: () => void;
}

const emotionTags = [
  { emoji: "😰", label: "Anxiety", tag: "charging_anxiety" },
  { emoji: "😲", label: "Surprise", tag: "perception_gap" },
  { emoji: "😞", label: "Regret", tag: "regret" },
  { emoji: "😊", label: "Success", tag: "adaptation_success" },
  { emoji: "🤔", label: "Confusion", tag: "mental_overhead" },
];

const behavioralSignalTags = [
  { label: "Predictability failure", tag: "predictability_failure" },
  { label: "Mental overhead", tag: "mental_overhead" },
  { label: "Planning fatigue", tag: "planning_fatigue" },
  { label: "False sense of availability", tag: "false_sense_of_availability" },
  { label: "Backup-plan dependency", tag: "backup_plan_dependency" },
  { label: "Edge-case fixation", tag: "edge_case_fixation" },
  { label: "Routine mismatch", tag: "routine_mismatch" },
  { label: "Habit success", tag: "habit_success" },
];

const commonRootCauses = [
  "Unpredictable availability, not quantity",
  "Mental planning overhead, not physical access",
  "Routine disruption, not absolute limitation",
  "Battery condition uncertainty amplifies charging concerns",
  "Expectation mismatch: specs vs. real-world experience",
  "Apartment charging infrastructure gap",
  "Seasonal variation (cold weather impact)",
  "Custom (enter below)...",
];

const patternTemplates = {
  charger_quantity: {
    assumption: "More chargers in area = less anxiety",
    experience: "Still anxious despite many chargers nearby",
    rootCause: "Unpredictable availability, not quantity",
    tags: ["charging_anxiety", "perception_gap", "predictability_issue"],
  },
  apartment_charging: {
    assumption: "Public charging would work fine for apartment living",
    experience: "Constantly checking apps, adjusting schedule around charger availability",
    rootCause: "Routine disruption, not absolute limitation",
    tags: ["apartment_living", "routine_friction", "mental_overhead"],
  },
  battery_percent: {
    assumption: "Battery % tells me how far I can go",
    experience: "Battery % doesn't account for cold weather, highway speed, etc.",
    rootCause: "Expectation mismatch: specs vs. real-world experience",
    tags: ["perception_gap", "behavioral_risk"],
  },
};

export default function QuickPatternCapture({ onSubmit, onCancel }: QuickPatternCaptureProps) {
  const [step, setStep] = useState<"quote" | "context" | "analysis">("quote");
  const [quote, setQuote] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedBehavioralSignals, setSelectedBehavioralSignals] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Context fields (legacy)
  const [housing, setHousing] = useState("apartment");
  const [chargingAccess, setChargingAccess] = useState("public_only");
  const [region, setRegion] = useState("Northeast");
  const [ownershipStage, setOwnershipStage] = useState("3_6_months");

  // CMO Phase 2 - Structured Context (required)
  const [structuredHousing, setStructuredHousing] = useState("");
  const [regionType, setRegionType] = useState("");
  const [structuredOwnership, setStructuredOwnership] = useState("");
  const [vehicleClass, setVehicleClass] = useState("");
  const [structuredOutcome, setStructuredOutcome] = useState("");

  // Analysis fields
  const [assumption, setAssumption] = useState("");
  const [experience, setExperience] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [customRootCause, setCustomRootCause] = useState("");
  const [cognitiveLoad, setCognitiveLoad] = useState(3);
  const [outcome, setOutcome] = useState("ongoing_friction");
  const [sourceUrl, setSourceUrl] = useState("");

  // CMO Phase 2 - Required Fields
  const [patternType, setPatternType] = useState("");
  const [productSurfaces, setProductSurfaces] = useState<string[]>([]);

  // CMO Phase 2 - Structured Analysis (3-line enforced)
  const [analysisAssumptionFailed, setAnalysisAssumptionFailed] = useState("");
  const [analysisOverheadCreated, setAnalysisOverheadCreated] = useState("");
  const [analysisWhatWouldHelp, setAnalysisWhatWouldHelp] = useState("");

  // CMO Phase 2.5 - Structured Analysis Dropdowns
  const [behavioralFailureMode, setBehavioralFailureMode] = useState("");
  const [assumptionFailedStructured, setAssumptionFailedStructured] = useState("");
  const [assumptionFailedCustom, setAssumptionFailedCustom] = useState("");
  const [regretReduction, setRegretReduction] = useState("");
  const [regretReductionCustom, setRegretReductionCustom] = useState("");

  const toggleEmotion = (tag: string) => {
    if (selectedEmotions.includes(tag)) {
      setSelectedEmotions(selectedEmotions.filter((t) => t !== tag));
    } else {
      setSelectedEmotions([...selectedEmotions, tag]);
    }
  };

  const toggleProductSurface = (surface: string) => {
    if (productSurfaces.includes(surface)) {
      setProductSurfaces(productSurfaces.filter((s) => s !== surface));
    } else {
      setProductSurfaces([...productSurfaces, surface]);
    }
  };

  const toggleBehavioralSignal = (signal: string) => {
    if (selectedBehavioralSignals.includes(signal)) {
      setSelectedBehavioralSignals(selectedBehavioralSignals.filter((s) => s !== signal));
    } else {
      setSelectedBehavioralSignals([...selectedBehavioralSignals, signal]);
    }
  };

  const applyTemplate = (templateKey: keyof typeof patternTemplates) => {
    const template = patternTemplates[templateKey];
    setAssumption(template.assumption);
    setExperience(template.experience);
    setRootCause(template.rootCause);
    setSelectedEmotions(template.tags);
    setSelectedTemplate(templateKey);
  };

  const handleSubmit = () => {
    const finalRootCause = rootCause === "Custom (enter below)..." ? customRootCause : rootCause;

    const pattern = {
      source: sourceUrl.includes("reddit.com")
        ? "reddit_electricvehicles"
        : sourceUrl.includes("twitter.com")
          ? "user_feedback"
          : "direct_interview",
      source_url: sourceUrl || undefined,
      user_context: {
        housing,
        region,
        ownership_stage: ownershipStage,
        charging_access: chargingAccess,
        structured_housing: structuredHousing,
        region_type: regionType,
        structured_ownership_stage: structuredOwnership,
        vehicle_class: vehicleClass,
        structured_outcome: structuredOutcome,
      },
      behavioral_pattern: {
        pre_purchase_assumption: assumption,
        actual_experience: experience,
        root_cause: finalRootCause,
        cognitive_load_rating: cognitiveLoad,
        outcome,
        confidence: "high",
        pattern_type: patternType,
        product_surfaces_impacted: productSurfaces,
        analysis_assumption_failed: analysisAssumptionFailed,
        analysis_mental_overhead_created: analysisOverheadCreated,
        analysis_what_would_help: analysisWhatWouldHelp,
        behavioral_failure_mode: behavioralFailureMode,
        assumption_failed_structured: assumptionFailedStructured,
        assumption_failed_custom: assumptionFailedStructured === "custom" ? assumptionFailedCustom : undefined,
        regret_reduction: regretReduction,
        regret_reduction_custom: regretReduction === "custom" ? regretReductionCustom : undefined,
      },
      tags: selectedEmotions.length > 0 ? selectedEmotions : ["mental_overhead"],
      behavioral_signal_tags: selectedBehavioralSignals,
      notes: quote ? `Original quote: "${quote}"` : undefined,
      extracted_by: "manual",
    };

    onSubmit(pattern);
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded ${step === "quote" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
            1. Quote
          </span>
          <span className={`px-3 py-1 rounded ${step === "context" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
            2. Context
          </span>
          <span className={`px-3 py-1 rounded ${step === "analysis" ? "bg-blue-600 text-white" : "bg-gray-200"}`}>
            3. Analysis
          </span>
        </div>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>

      {/* Step 1: Quote Capture */}
      {step === "quote" && (
        <div className="space-y-4">
          <div>
            <label className="block text-lg font-medium mb-2">What did the user say?</label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Paste exact quote from Reddit/Twitter/forum...

Example:
'I thought more chargers = less stress. I was wrong. Even with 15+ chargers nearby, I'm constantly checking apps to see which ones are available.'"
              className="w-full p-3 border rounded h-32 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">{quote.length}/500 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Source URL (optional)</label>
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://reddit.com/r/electricvehicles/comments/..."
              className="w-full p-2 border rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Emotional Tags (optional)</label>
            <div className="flex flex-wrap gap-2">
              {emotionTags.map((tag) => (
                <button
                  key={tag.tag}
                  onClick={() => toggleEmotion(tag.tag)}
                  className={`px-3 py-2 rounded-lg border-2 transition-all ${
                    selectedEmotions.includes(tag.tag)
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-xl mr-1">{tag.emoji}</span>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Behavioral Signal Tags * <span className="text-xs text-gray-600">(product relevance - at least one required)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {behavioralSignalTags.map((tag) => (
                <button
                  key={tag.tag}
                  onClick={() => toggleBehavioralSignal(tag.tag)}
                  className={`px-3 py-2 rounded border-2 text-sm transition-all ${
                    selectedBehavioralSignals.includes(tag.tag)
                      ? "border-purple-600 bg-purple-50 text-purple-800 font-medium"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep("context")}
              disabled={selectedBehavioralSignals.length === 0}
              className="flex-1 bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next: Add Context →
            </button>
          </div>
          {selectedBehavioralSignals.length === 0 && (
            <p className="text-sm text-red-600 text-center">
              ⚠️ Select at least one behavioral signal tag to continue
            </p>
          )}
        </div>
      )}

      {/* Step 2: Context */}
      {step === "context" && (
        <div className="space-y-4">
          <h3 className="font-medium">User Context</h3>

          {/* CMO Phase 2 - Structured Context (Required) */}
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-green-900 mb-3">📊 Structured Context (Required)</h4>
            <p className="text-xs text-gray-700 mb-3">Turns anecdotes into patternable data</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Housing Type *</label>
                <select
                  value={structuredHousing}
                  onChange={(e) => setStructuredHousing(e.target.value)}
                  className="w-full p-2 border-2 rounded"
                >
                  <option value="">Select housing...</option>
                  <option value="apartment_no_charger">Apartment (no charger)</option>
                  <option value="apartment_shared_l2">Apartment (shared L2)</option>
                  <option value="apartment_dedicated">Apartment (dedicated)</option>
                  <option value="sfh_l1">SFH (L1)</option>
                  <option value="sfh_l2">SFH (L2)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Region Type *</label>
                <select
                  value={regionType}
                  onChange={(e) => setRegionType(e.target.value)}
                  className="w-full p-2 border-2 rounded"
                >
                  <option value="">Select region type...</option>
                  <option value="urban">Urban</option>
                  <option value="suburban">Suburban</option>
                  <option value="rural">Rural</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ownership Stage *</label>
                <select
                  value={structuredOwnership}
                  onChange={(e) => setStructuredOwnership(e.target.value)}
                  className="w-full p-2 border-2 rounded"
                >
                  <option value="">Select stage...</option>
                  <option value="considering">Considering</option>
                  <option value="less_than_3_months">&lt;3 months</option>
                  <option value="3_to_12_months">3–12 months</option>
                  <option value="1_plus_years">1+ year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Vehicle Class *</label>
                <select
                  value={vehicleClass}
                  onChange={(e) => setVehicleClass(e.target.value)}
                  className="w-full p-2 border-2 rounded"
                >
                  <option value="">Select vehicle class...</option>
                  <option value="standard_range">Standard range</option>
                  <option value="long_range">Long range</option>
                  <option value="tesla_compatible">Tesla-compatible</option>
                  <option value="non_tesla_compatible">Non-Tesla compatible</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Outcome *</label>
                <select
                  value={structuredOutcome}
                  onChange={(e) => setStructuredOutcome(e.target.value)}
                  className="w-full p-2 border-2 rounded"
                >
                  <option value="">Select outcome...</option>
                  <option value="effortless">Effortless</option>
                  <option value="friction">Friction</option>
                  <option value="regret">Regret</option>
                </select>
              </div>
            </div>
          </div>

          {/* Legacy fields (hidden, kept for compatibility) */}
          <input type="hidden" value={housing} />
          <input type="hidden" value={chargingAccess} />
          <input type="hidden" value={region} />
          <input type="hidden" value={ownershipStage} />

          <div className="flex gap-2">
            <button
              onClick={() => setStep("quote")}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep("analysis")}
              disabled={
                !structuredHousing ||
                !regionType ||
                !structuredOwnership ||
                !vehicleClass ||
                !structuredOutcome
              }
              className="flex-1 bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next: Analysis →
            </button>
          </div>
          {(!structuredHousing || !regionType || !structuredOwnership || !vehicleClass || !structuredOutcome) && (
            <p className="text-sm text-red-600 text-center">
              ⚠️ All structured context fields required to continue
            </p>
          )}
        </div>
      )}

      {/* Step 3: Analysis */}
      {step === "analysis" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium mb-2">💡 Quick Templates</h4>
            <p className="text-sm text-gray-700 mb-3">
              Common patterns we see - click to pre-fill:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => applyTemplate("charger_quantity")}
                className={`px-3 py-2 rounded text-sm ${
                  selectedTemplate === "charger_quantity"
                    ? "bg-blue-600 text-white"
                    : "bg-white border hover:border-blue-300"
                }`}
              >
                More chargers ≠ less anxiety
              </button>
              <button
                onClick={() => applyTemplate("apartment_charging")}
                className={`px-3 py-2 rounded text-sm ${
                  selectedTemplate === "apartment_charging"
                    ? "bg-blue-600 text-white"
                    : "bg-white border hover:border-blue-300"
                }`}
              >
                Apartment charging friction
              </button>
              <button
                onClick={() => applyTemplate("battery_percent")}
                className={`px-3 py-2 rounded text-sm ${
                  selectedTemplate === "battery_percent"
                    ? "bg-blue-600 text-white"
                    : "bg-white border hover:border-blue-300"
                }`}
              >
                Battery % ≠ real range
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Pre-Purchase Assumption *</label>
            <textarea
              value={assumption}
              onChange={(e) => setAssumption(e.target.value)}
              placeholder="What did they believe before buying?"
              className="w-full p-2 border rounded h-20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Actual Experience *</label>
            <textarea
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="What actually happened?"
              className="w-full p-2 border rounded h-20 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Root Cause *</label>
            <select
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              className="w-full p-2 border rounded text-sm"
            >
              <option value="">Select common cause...</option>
              {commonRootCauses.map((cause) => (
                <option key={cause} value={cause}>
                  {cause}
                </option>
              ))}
            </select>
            {rootCause === "Custom (enter below)..." && (
              <textarea
                value={customRootCause}
                onChange={(e) => setCustomRootCause(e.target.value)}
                placeholder="Enter custom root cause..."
                className="w-full p-2 border rounded mt-2 text-sm"
              />
            )}
          </div>

          {/* CMO Phase 2.5 - Structured Analysis Dropdowns (Discipline Enforcement) */}
          <div className="bg-indigo-50 border-2 border-indigo-300 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-900 mb-2">🎯 Structured Analysis (Required)</h4>
            <p className="text-xs text-gray-700 mb-3">Force discipline - turns insight into product logic</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Behavioral Failure Mode *
                </label>
                <select
                  value={behavioralFailureMode}
                  onChange={(e) => setBehavioralFailureMode(e.target.value)}
                  className="w-full p-2 border-2 rounded text-sm"
                >
                  <option value="">Select failure mode...</option>
                  <option value="charging_unpredictability">Charging unpredictability</option>
                  <option value="routine_disruption">Routine disruption</option>
                  <option value="backup_plan_absence">Backup plan absence</option>
                  <option value="edge_case_dominance">Edge-case dominance</option>
                  <option value="cognitive_load_planning_fatigue">Cognitive load / planning fatigue</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  What assumption failed? *
                </label>
                <select
                  value={assumptionFailedStructured}
                  onChange={(e) => setAssumptionFailedStructured(e.target.value)}
                  className="w-full p-2 border-2 rounded text-sm"
                >
                  <option value="">Select assumption...</option>
                  <option value="chargers_would_usually_be_available">Chargers would usually be available</option>
                  <option value="range_mattered_more_than_routine">Range mattered more than routine</option>
                  <option value="fast_charging_could_be_primary">Fast charging could be primary</option>
                  <option value="custom">Custom (enter below)</option>
                </select>
                {assumptionFailedStructured === "custom" && (
                  <textarea
                    value={assumptionFailedCustom}
                    onChange={(e) => setAssumptionFailedCustom(e.target.value)}
                    placeholder="Enter custom assumption that failed..."
                    className="w-full p-2 border-2 rounded mt-2 text-sm h-16"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  What would have reduced regret? *
                </label>
                <select
                  value={regretReduction}
                  onChange={(e) => setRegretReduction(e.target.value)}
                  className="w-full p-2 border-2 rounded text-sm"
                >
                  <option value="">Select intervention...</option>
                  <option value="better_expectation_setting">Better expectation setting</option>
                  <option value="different_vehicle_class">Different vehicle class</option>
                  <option value="mixed_car_strategy">Mixed-car strategy</option>
                  <option value="not_buying_yet">Not buying yet</option>
                  <option value="custom">Custom (enter below)</option>
                </select>
                {regretReduction === "custom" && (
                  <textarea
                    value={regretReductionCustom}
                    onChange={(e) => setRegretReductionCustom(e.target.value)}
                    placeholder="Enter custom regret reduction..."
                    className="w-full p-2 border-2 rounded mt-2 text-sm h-16"
                  />
                )}
              </div>
            </div>
          </div>

          {/* CMO Phase 2 - 3-Line Freeform Analysis (Optional) */}
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 mb-2">📝 Freeform Analysis (Optional)</h4>
            <p className="text-xs text-gray-700 mb-3">Additional context beyond structured fields</p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  1. What assumption failed? (optional)
                </label>
                <textarea
                  value={analysisAssumptionFailed}
                  onChange={(e) => setAnalysisAssumptionFailed(e.target.value)}
                  placeholder="Example: The user assumed charger count implied availability."
                  className="w-full p-2 border-2 rounded text-sm h-16"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  2. What mental overhead did this create? (optional)
                </label>
                <textarea
                  value={analysisOverheadCreated}
                  onChange={(e) => setAnalysisOverheadCreated(e.target.value)}
                  placeholder="Example: This created constant monitoring behavior (checking PlugShare 3-4x per day)."
                  className="w-full p-2 border-2 rounded text-sm h-16"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  3. What would have reduced this earlier? (optional)
                </label>
                <textarea
                  value={analysisWhatWouldHelp}
                  onChange={(e) => setAnalysisWhatWouldHelp(e.target.value)}
                  placeholder="Example: Explicitly surfacing predictability vs availability would have recalibrated expectations."
                  className="w-full p-2 border-2 rounded text-sm h-16"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cognitive Load</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={cognitiveLoad}
                  onChange={(e) => setCognitiveLoad(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-lg font-bold w-12 text-center">
                  {cognitiveLoad}/5
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {cognitiveLoad === 1 && "Low - minimal planning overhead"}
                {cognitiveLoad === 2 && "Mild - occasional inconvenience"}
                {cognitiveLoad === 3 && "Moderate - noticeable daily impact"}
                {cognitiveLoad === 4 && "High - significant mental burden"}
                {cognitiveLoad === 5 && "Extreme - constant stress"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Outcome</label>
              <select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="adapted_successfully">✅ Adapted Successfully</option>
                <option value="ongoing_friction">⚠️ Ongoing Friction</option>
                <option value="regret">😞 Regret</option>
                <option value="resolved">✓ Resolved</option>
              </select>
            </div>
          </div>

          {/* CMO Phase 2 - Required Fields */}
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
            <h4 className="font-semibold text-orange-900 mb-3">🔧 Required Pattern Classification</h4>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Behavioral Pattern Type * <span className="text-xs text-gray-600">(maps directly to product blocks)</span>
              </label>
              <select
                value={patternType}
                onChange={(e) => setPatternType(e.target.value)}
                className="w-full p-2 border-2 rounded text-sm"
              >
                <option value="">Select pattern type...</option>
                <option value="charging_predictability_failure">Charging predictability failure</option>
                <option value="routine_friction_planning_burden">Routine friction / planning burden</option>
                <option value="edge_case_dominance">Edge-case dominance</option>
                <option value="battery_uncertainty_amplification">Battery uncertainty amplification</option>
                <option value="infrastructure_uncertainty">Infrastructure uncertainty</option>
                <option value="expectation_mismatch">Expectation mismatch</option>
                <option value="successful_low_overhead_fit">Successful low-overhead fit</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Product Surface Impacted * <span className="text-xs text-gray-600">(select all that apply - at least one required)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleProductSurface("phase_0_5_messaging")}
                  className={`px-3 py-2 rounded border-2 text-sm text-left transition-all ${
                    productSurfaces.includes("phase_0_5_messaging")
                      ? "border-orange-600 bg-orange-100 text-orange-900"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Phase 0.5 messaging
                </button>
                <button
                  type="button"
                  onClick={() => toggleProductSurface("charging_fit_block")}
                  className={`px-3 py-2 rounded border-2 text-sm text-left transition-all ${
                    productSurfaces.includes("charging_fit_block")
                      ? "border-orange-600 bg-orange-100 text-orange-900"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Charging Fit block
                </button>
                <button
                  type="button"
                  onClick={() => toggleProductSurface("battery_health_block")}
                  className={`px-3 py-2 rounded border-2 text-sm text-left transition-all ${
                    productSurfaces.includes("battery_health_block")
                      ? "border-orange-600 bg-orange-100 text-orange-900"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Battery Health block
                </button>
                <button
                  type="button"
                  onClick={() => toggleProductSurface("decision_state_summary")}
                  className={`px-3 py-2 rounded border-2 text-sm text-left transition-all ${
                    productSurfaces.includes("decision_state_summary")
                      ? "border-orange-600 bg-orange-100 text-orange-900"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Decision State Summary
                </button>
                <button
                  type="button"
                  onClick={() => toggleProductSurface("language_terminology")}
                  className={`px-3 py-2 rounded border-2 text-sm text-left transition-all ${
                    productSurfaces.includes("language_terminology")
                      ? "border-orange-600 bg-orange-100 text-orange-900"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Language / terminology
                </button>
                <button
                  type="button"
                  onClick={() => toggleProductSurface("do_not_ship_guardrail")}
                  className={`px-3 py-2 rounded border-2 text-sm text-left transition-all ${
                    productSurfaces.includes("do_not_ship_guardrail")
                      ? "border-orange-600 bg-orange-100 text-orange-900"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Do-not-ship guardrail
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep("context")}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                !assumption ||
                !experience ||
                !rootCause ||
                !patternType ||
                productSurfaces.length === 0 ||
                selectedBehavioralSignals.length === 0 ||
                !behavioralFailureMode ||
                !assumptionFailedStructured ||
                (assumptionFailedStructured === "custom" && !assumptionFailedCustom) ||
                !regretReduction ||
                (regretReduction === "custom" && !regretReductionCustom)
              }
              className="flex-1 bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ✓ Submit Pattern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
