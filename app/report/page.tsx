"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import DataQualitySection from "@/components/DataQualitySection";
import PersonalizationOpportunityCard from "@/components/PersonalizationOpportunityCard";
import DataQualityDecisionConfidence from "@/components/DataQualityDecisionConfidence";
import WhatsMissingModule from "@/components/WhatsMissingModule";
import DecisionStateSummary from "@/components/DecisionStateSummary";
import { VehicleContextFactors } from "@/components/VehicleContextFactors";
import { WhatWeKnowSection } from "@/components/WhatWeKnowSection";
import { ChargingFitMentalLoad } from "@/components/ChargingFitMentalLoad";
import { RoutineFitVerdict } from "@/components/RoutineFitVerdict";
import { WhyThisResult } from "@/components/WhyThisResult";
import { MentalLoadIndicator } from "@/components/MentalLoadIndicator";
import { WhatsMissing } from "@/components/WhatsMissing";
import FitSignalDisplay from "@/components/FitSignalDisplay";
import ThirtySecondSummary from "@/components/ThirtySecondSummary";
import HistoryRoutineInteraction from "@/components/HistoryRoutineInteraction";
import BatteryHealthContext from "@/components/BatteryHealthContext";
import WhatSellersHide from "@/components/WhatSellersHide";
import EVHistoryFlags from "@/components/EVHistoryFlags";
import ConfidenceDriversPanel from "@/components/ConfidenceDriversPanel";
import ShareDropdown from "@/components/ShareDropdown";
import SaveForLaterModal from "@/components/SaveForLaterModal";
import DebugPanel from "@/components/DebugPanel";
import { generateConfidenceData, type ConfidenceInputs } from "@/lib/confidence-calculator";
import { generateDebugData } from "@/lib/debug-helpers";
import { generateMissingDataExplanations, getPrimaryMissingExplanation, generatePersonalizationOpportunities } from "@/lib/missing-data-generator";
import { calculateRoutineFitClient } from "@/lib/routine-fit-client";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { KnownDataPoint, UnknownDataPoint, RiskFactor } from "@/types/report";

interface BatteryRisk {
  score: number;
  weight: number;
  degradation_percent: number;
  estimated_replacement_cost: number;
  chemistry: string;
  details: string;
}

interface PlatformRisk {
  score: number;
  weight: number;
  critical_recalls: number;
  total_recalls: number;
  reliability_score: number;
  details: string;
}

interface OwnershipFit {
  score: number;
  weight: number;
  climate_impact: "Favorable" | "Moderate" | "Challenging";
  charger_density: string;
  annual_miles_fit: "Good" | "Moderate" | "Poor";
  details: string;
}

interface HistoryRoutineSignal {
  type: "friction" | "buffer" | "low-stress";
  headline: string;
  explanation: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
}

interface BatteryHealthContext {
  currentHealth: number;
  assessment: "typical" | "above-average" | "below-average" | "unusually-strong" | "faster-decline";
  comparisonText: string;
  benchmarkNote: string;
}

interface EVHistoryFlag {
  type: "warning" | "caution" | "neutral";
  flag: string;
  explanation: string;
  probability: "inferred" | "likely" | "observed";
}

interface ConfidenceDriver {
  category: "data-completeness" | "history-clarity" | "routine-predictability";
  strength: "high" | "medium" | "low";
  reason: string;
}

interface BuyConfidence {
  overall_score: number;
  rating: "GREEN" | "YELLOW" | "RED"; // DEPRECATED: Use fit_signal instead
  fit_signal: "Good Fit" | "Good Fit — with conditions" | "Conditional Fit" | "High Friction";
  emoji: "🟢" | "🟡" | "🔴";
  recommendation: string;
  one_sentence_verdict: string;
  becomes_annoying_if: string;
  what_breaks_first: string[];
  confidence: "High" | "Medium" | "Low"; // Changed from ALL CAPS to Title Case
  confidence_note: string;
  confidence_why: string[];
  top_drivers: Array<{ label: string; impact: "HIGH" | "MEDIUM" | "LOW" }>;
  plan_b: string[];
  battery_risk: BatteryRisk;
  platform_risk: PlatformRisk;
  ownership_fit: OwnershipFit;
  history_routine_signals?: HistoryRoutineSignal[];
  battery_health_context?: BatteryHealthContext;
  ev_history_flags?: EVHistoryFlag[];
  confidence_drivers?: ConfidenceDriver[];
}

interface DataQuality {
  knownData: KnownDataPoint[];
  unknownData: UnknownDataPoint[];
  risks: RiskFactor[];
  nextSteps: string[];
  overallConfidence: 'high' | 'medium' | 'low';
  dataSource?: string;
  autoFilledFields?: string[];
  confidenceNote?: string;
}

interface ReportData {
  success: boolean;
  input: {
    model: string;
    year: number;
    trim?: string;
    vin?: string;
    currentMileage?: number;
    zipCode: string;
    dailyMiles: number;
    homeCharging: boolean;
    riskTolerance: string;
  };
  confidence: BuyConfidence;
  breakdown: string[];
  dataQuality?: DataQuality;
  timestamp: string;
}

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);

  // Event tracking
  const { trackButtonClick } = useEventTracking();

  // Ref for scrolling to personalization section (must be at top level)
  const personalizationRef = useRef<HTMLDivElement>(null);

  // Check for debug mode
  const isDebugMode = searchParams.get("debug") === "1";

  useEffect(() => {
    // Check for 'data' param (normal flow) or 'payload' param (after payment)
    const dataParam = searchParams.get("data");
    const payloadParam = searchParams.get("payload");
    const paidParam = searchParams.get("paid");
    const reportIdParam = searchParams.get("reportId");

    console.log("[Report Page] useEffect triggered:", { dataParam: !!dataParam, payloadParam: !!payloadParam });

    // Set paid status and reportId
    setIsPaid(paidParam === "true");
    setReportId(reportIdParam);

    if (dataParam) {
      const loadData = async () => {
        try {
          const parsed = JSON.parse(dataParam);
          console.log("[Report Page] Successfully parsed data:", parsed);

          // Check if it's raw vehicle data or full report data
          if (!parsed.confidence || !parsed.input) {
            // Raw vehicle data - need to score it with defaults
            console.log("[Report Page] Detected raw vehicle data, generating score with defaults");

            // Call scoring API with defaults for missing user context
            const scoringResponse = await fetch("/api/score", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: parsed.model || "Unknown Vehicle",
                year: parsed.year || new Date().getFullYear(),
                currentMileage: parsed.currentMileage || 0,
                zipCode: "00000", // Default - will show as missing data
                dailyMiles: 40, // Average default
                homeCharging: false, // Conservative default
                riskTolerance: "moderate", // Default
              }),
            });

            if (!scoringResponse.ok) {
              throw new Error("Failed to generate score");
            }

            const scoredData = await scoringResponse.json();
            console.log("[Report Page] Generated score:", scoredData);
            setReportData(scoredData);

            // Track report_view event
            trackButtonClick("report_view", "report-page");
            return;
          }

          setReportData(parsed as ReportData);

          // Track report_view event
          trackButtonClick("report_view", "report-page");
        } catch (e) {
          console.error("Failed to parse report data:", e);
          router.push("/");
        }
      };

      loadData();
    } else if (payloadParam) {
      try {
        // Decode base64 payload (with Unicode support)
        const decoded = decodeURIComponent(
          atob(payloadParam)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const parsed = JSON.parse(decoded) as ReportData;
        console.log("[Report Page] Successfully parsed payload data:", parsed);
        setReportData(parsed);

        // Track report_view event
        trackButtonClick("report_view", "report-page");
      } catch (e) {
        console.error("Failed to parse payload:", e);
        router.push("/");
      }
    } else {
      console.log("[Report Page] No data or payload found, redirecting to home");
      router.push("/");
    }
  }, [searchParams, router]);

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  const { confidence, input, breakdown } = reportData;

  // Additional safety check for input data
  if (!input || !confidence) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      </div>
    );
  }

  // Phase 0.5: Calculate confidence and determine activation
  const confidenceInputs: ConfidenceInputs = {
    listing: {
      hasMileage: !!(input as any).currentMileage,
      hasAge: !!input.year,
      hasModel: !!input.model,
      hasTrim: !!(input as any).trim,
      hasVIN: !!(input as any).vin,
    },
    personalization: {
      hasDrivingPattern: !!input.dailyMiles,
      hasChargingAccess: input.homeCharging !== undefined,
      hasRiskTolerance: !!input.riskTolerance,
      hasZipCode: !!input.zipCode,
    },
    batteryHealth: {
      hasSOHReport: false, // Not available in MVP
      hasChargingHistory: false, // Not available in MVP
    },
  };

  const phase05Data = generateConfidenceData(confidenceInputs);

  // Calculate routine fit assessment for FREE VERSION
  const routineFit = calculateRoutineFitClient({
    dailyMiles: input.dailyMiles,
    homeCharging: input.homeCharging,
    chargerDensity: confidence.ownership_fit.charger_density,
    realWorldRange: 250, // TODO: Get from range data
    overall_score: confidence.overall_score
  });

  // Vehicle context for missing data generation
  const vehicleContext = {
    model: input.model,
    age: new Date().getFullYear() - input.year,
    mileage: (input as any).currentMileage || undefined,
    range: undefined, // Will enhance when range data available
    hasBatteryReport: false,
    hasChargingInfo: false,
  };

  const personalizationContext = {
    hasDrivingPattern: confidenceInputs.personalization.hasDrivingPattern,
    hasChargingAccess: confidenceInputs.personalization.hasChargingAccess,
    hasRiskTolerance: confidenceInputs.personalization.hasRiskTolerance,
    hasZipCode: confidenceInputs.personalization.hasZipCode,
  };

  const missingDataPoints = generateMissingDataExplanations(vehicleContext, personalizationContext);
  const primaryMissing = getPrimaryMissingExplanation(vehicleContext);
  const personalizationOpportunities = generatePersonalizationOpportunities(vehicleContext, personalizationContext);

  const scrollToPersonalization = () => {
    personalizationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Determine background color based on rating
  const bgColorClass = {
    GREEN: "from-green-50 via-white to-green-50",
    YELLOW: "from-yellow-50 via-white to-yellow-50",
    RED: "from-red-50 via-white to-red-50",
  }[confidence.rating];

  const scoreColorClass = {
    GREEN: "text-green-600",
    YELLOW: "text-yellow-600",
    RED: "text-red-600",
  }[confidence.rating];

  const badgeColorClass = {
    GREEN: "bg-green-100 text-green-800 border-green-300",
    YELLOW: "bg-yellow-100 text-yellow-800 border-yellow-300",
    RED: "bg-red-100 text-red-800 border-red-300",
  }[confidence.rating];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgColorClass}`}>
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Back Button and Actions */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            New Analysis
          </button>

          <div className="flex gap-3">
            {isPaid && reportId && (
              <a
                href={`/api/report/${reportId}/pdf`}
                download
                onClick={() => trackButtonClick("report_save_click", "report-page")}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </a>
            )}
            <button
              onClick={() => {
                trackButtonClick("report_save_click", "report-page");
                window.print();
              }}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
            <ShareDropdown
              vehicle={`${input.year} ${input.model}`}
              fitSignal={confidence.fit_signal}
              oneLiner={confidence.one_sentence_verdict}
              becomesAnnoyingIf={confidence.becomes_annoying_if}
              whatBreaksFirst={confidence.what_breaks_first}
              onShare={() => trackButtonClick("report_share_click", "report-page")}
            />
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            Share to sanity-check opinions — no personal info included
          </p>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">
            EV-Risk™ Report
          </h1>
          <p className="text-sm text-gray-500 mb-2 italic">
            Explains fit and uncertainty — not recommendations
          </p>
          <p className="text-gray-600 text-lg font-medium mb-3">
            {input.year} {input.model}
          </p>
          {/* META FRAMING: Philosophy Statement */}
          <p className="text-sm text-gray-600 max-w-2xl mx-auto leading-relaxed">
            You're not just buying a vehicle — you're inheriting a <span className="font-semibold text-gray-900">usage history</span>.
            This report bridges the gap between what happened (Carfax) and what it will <span className="font-semibold text-gray-900">feel like</span> in your routine.
          </p>
        </div>

        {/* REMOVED: Main Score Card - MAJOR GLOBAL RULES VIOLATIONS
            - overall_score/100 display
            - Green/yellow/red emoji (🟢🟡🔴)
            - "BUY CONFIDENCE" rating
            - "Better than X%" comparative language
            - "Proceed with caution" judgment
            - Battery/Platform/Ownership sub-scores
            Phase 0.5 modules below replace this functionality */}

        {/* 30-SECOND SUMMARY - Above the Fold */}
        <ThirtySecondSummary
          fitSignal={confidence.fit_signal}
          oneLiner={confidence.one_sentence_verdict}
          becomesAnnoyingIf={confidence.becomes_annoying_if}
          whatBreaksFirst={confidence.what_breaks_first}
          confidence={confidence.confidence}
          confidenceWhy={confidence.confidence_why}
          topDrivers={confidence.top_drivers}
          planB={confidence.plan_b}
        />

        {/* GET FULL REPORT CTA - Positioned right after Conditional Fit */}
        {!showFullReport && (
        <>
        {/* Soft divider */}
        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="bg-gradient-to-br from-blue-50/30 to-green-50/30 rounded-xl p-6 border border-gray-200">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-lg font-semibold text-gray-700 mb-3 text-center">
                If you want deeper detail (optional)
              </h3>
              <p className="text-gray-600 text-center mb-6 text-sm">
                Get the full 12-page report — <span className="font-semibold text-green-600">Free during early access</span>
              </p>

            {/* What's Included */}
            <div className="bg-white rounded-xl p-6 mb-6">
              <h4 className="font-bold text-gray-900 mb-4">What's Included:</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Complete battery health analysis</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Platform reliability scores</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Detailed cost projections</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Ownership timeline breakdown</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Regional risk factors</span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-gray-700">Resale value predictions</span>
                </div>
              </div>
            </div>

            {/* Why Upgrade */}
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600 mb-4">
                <strong>Why upgrade?</strong> Get detailed insights that help you negotiate better, plan maintenance, and avoid costly surprises.
              </p>
            </div>

            {/* CTA Button */}
            <div className="text-center">
              <button
                onClick={() => {
                  setShowFullReport(true);
                  trackButtonClick("view_full_report", "report-page");
                  // Scroll to top to see the full report
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white font-bold text-lg rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Get Full Report
              </button>
              <p className="mt-3 text-xs text-gray-500">
                Available during early access — helping us refine the analysis
              </p>
            </div>
          </div>
        </div>
        </div>
        </>
        )}

        {/* SAVE FOR LATER - Progressive Engagement */}
        {!showFullReport && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setShowSaveModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-blue-500 hover:text-blue-600 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Save for Later
          </button>
        </div>
        )}

        {/*
        ============================================================
        FULL REPORT SECTIONS
        ============================================================
        These sections are shown when user clicks "Get Full Report"
        ============================================================
        */}

        {/* Full detailed sections - shown when user requests full report */}
        {showFullReport && (
          <>
        {/* Back to Summary Button */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setShowFullReport(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Summary
          </button>
        </div>

        {/* FREE VERSION: ROUTINE FIT ASSESSMENT */}

        {/* FIT SIGNAL - Primary Assessment (For backward compatibility) */}
        <div className="mt-8">
          <FitSignalDisplay
            fitSignal={confidence.fit_signal}
            oneSentenceVerdict={confidence.one_sentence_verdict}
            confidenceNote={confidence.confidence_note}
            score={confidence.overall_score}
          />
        </div>

        {/* 1️⃣ ONE-LINE VERDICT - Top of Page */}
        <RoutineFitVerdict
          level={routineFit.verdict}
          condition={routineFit.condition}
        />

        {/* 2️⃣ WHY THIS RESULT - 3-Bullet Explanation */}
        <WhyThisResult
          reasons={routineFit.reasons}
        />

        {/* 3️⃣ MENTAL LOAD INDICATOR - Visual */}
        <MentalLoadIndicator
          level={routineFit.mental_load}
        />

        {/* 4️⃣ WHAT'S MISSING - Trust Builder */}
        <WhatsMissing
          currentConfidence={routineFit.confidence_current}
          potentialConfidence={routineFit.confidence_with_battery_data}
          missingDataPoints={routineFit.missing_data}
        />

        {/* MUST-ADD: HISTORY × ROUTINE INTERACTION - Top-Level Addition */}
        {confidence.history_routine_signals && confidence.history_routine_signals.length > 0 && (
          <HistoryRoutineInteraction signals={confidence.history_routine_signals} />
        )}

        {/* FEATURE 4: EV-Specific History Signals */}
        {confidence.ev_history_flags && confidence.ev_history_flags.length > 0 && (
          <EVHistoryFlags flags={confidence.ev_history_flags} />
        )}

        {/* FEATURE 5: Confidence Drivers Transparency Panel */}
        {confidence.confidence_drivers && confidence.confidence_drivers.length > 0 && (
          <ConfidenceDriversPanel
            drivers={confidence.confidence_drivers}
            overallConfidence={confidence.confidence}
          />
        )}

        {/* SPRINT 1: Phase 0.5 GLOBAL RULES Compliant Modules */}

        {/* Module 1A: Data Quality & Decision Confidence (ALWAYS RENDERED) */}
        <DataQualityDecisionConfidence
          confidenceInputs={confidenceInputs}
          vehicleYear={input.year}
          vehicleModel={input.model}
        />

        {/* Module 1B: What's Missing (Honest Uncertainty) */}
        <WhatsMissingModule confidenceInputs={confidenceInputs} />

        {/* Module 1C: Personalization Opportunity (2-Minute Gain) */}
        {phase05Data.shouldShowPhase05 && (
          <PersonalizationOpportunityCard
            vehicleData={{
              range: vehicleContext.range,
              age: vehicleContext.age,
              hasChargingInfo: vehicleContext.hasChargingInfo,
            }}
            onAddInfo={scrollToPersonalization}
          />
        )}


        {/* Vehicle Context Factors - Shows calculated scores in context-aware way */}
        <VehicleContextFactors
          batteryRisk={confidence.battery_risk}
          platformRisk={confidence.platform_risk}
          ownershipFit={confidence.ownership_fit}
        />

        {/* What We Know vs What We Don't - Trust Builder */}
        <WhatWeKnowSection
          hasPersonalization={false}
        />

        {/* REMOVED: Legacy scoring sections (Why This Score + Score Interpretation Guide)
            Violations: overall_score thresholds, green/yellow/red coding, "good/bad" language
            Replaced by Phase 0.5 modules above */}

        {/* Charging Fit & Mental Load - Key Differentiator */}
        <ChargingFitMentalLoad
          homeCharging={input.homeCharging}
          dailyMiles={input.dailyMiles}
          realWorldRange={250}
          chargerDensity={confidence.ownership_fit.charger_density}
          zipCode={input.zipCode}
        />

        {/* Detailed Breakdown */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Battery & Platform Considerations
          </h2>

          {/* Battery Considerations */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-600 rounded-full mr-3"></span>
              Battery Considerations
            </h3>

            {/* FEATURE 2: Battery Health Contextualization */}
            {confidence.battery_health_context && (
              <div className="mb-4">
                <BatteryHealthContext
                  currentHealth={confidence.battery_health_context.currentHealth}
                  assessment={confidence.battery_health_context.assessment}
                  comparisonText={confidence.battery_health_context.comparisonText}
                  benchmarkNote={confidence.battery_health_context.benchmarkNote}
                />
              </div>
            )}

            <p className="text-gray-700 mb-2">{confidence.battery_risk.details}</p>

            {/* HARD BLOCKER #2: Battery Uncertainty Amplification (Failure Mode) */}
            {!confidenceInputs.batteryHealth.hasSOHReport && (
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-orange-900 mb-2">
                  Battery Uncertainty Amplification
                </h4>
                <p className="text-sm text-orange-800">
                  Without a battery health report, degradation estimates are based on age and mileage patterns.
                  Actual battery condition could be significantly better or worse than typical. This uncertainty
                  compounds over time—what feels manageable now may become friction later if degradation
                  accelerates unexpectedly.
                </p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Estimated Degradation</p>
                <p className="text-2xl font-bold text-blue-600">{confidence.battery_risk.degradation_percent}%</p>
                <p className="text-xs text-gray-600 mt-1">
                  {confidenceInputs.batteryHealth.hasSOHReport
                    ? "Based on battery health report"
                    : "Based on typical age/mileage patterns"}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Replacement Cost Estimate</p>
                <p className="text-2xl font-bold text-blue-600">${confidence.battery_risk.estimated_replacement_cost.toLocaleString()}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Typical range: ${Math.round(confidence.battery_risk.estimated_replacement_cost * 0.6).toLocaleString()} - ${Math.round(confidence.battery_risk.estimated_replacement_cost * 1.25).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Platform Considerations */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-purple-600 rounded-full mr-3"></span>
              Platform Considerations
            </h3>
            <p className="text-gray-700 mb-2">{confidence.platform_risk.details}</p>

            {/* HARD BLOCKER #2: Edge-Case Dominance (Failure Mode - Critical Recalls) */}
            {confidence.platform_risk.critical_recalls > 0 && (
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-orange-900 mb-2">
                  Edge-Case Dominance
                </h4>
                <p className="text-sm text-orange-800">
                  This model has {confidence.platform_risk.critical_recalls} critical recall(s).
                  Even if rare, critical recalls can create disproportionate friction—what seems like
                  a small probability becomes your reality if it happens. Verify completion status
                  before purchase to avoid surprise service interruptions.
                </p>
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 mt-3">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Total Recalls</p>
                <p className="text-2xl font-bold text-purple-600">{confidence.platform_risk.total_recalls}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Critical Recalls</p>
                <p className="text-2xl font-bold text-purple-600">{confidence.platform_risk.critical_recalls}</p>
              </div>
              {/* REMOVED: Reliability Score /10 - scoring violation */}
            </div>
          </div>

          {/* Ownership Fit Details - ENHANCED SECTION C */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
              <span className="w-2 h-2 bg-green-600 rounded-full mr-3"></span>
              Ownership Fit for Your Usage
            </h3>
            <p className="text-gray-700 mb-2">{confidence.ownership_fit.details}</p>

            {/* Personalized Ownership Summary */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-green-500 p-5 rounded-lg mb-4">
              <h4 className="font-bold text-gray-900 mb-3">Ownership Fit Summary - Personalized for You</h4>
              <div className="space-y-2 text-sm text-gray-800">
                {(() => {
                  const estimatedRange = 250; // Default range estimation
                  const dailyUsagePercent = Math.round((input.dailyMiles / estimatedRange) * 100);
                  const degradedRange = estimatedRange * (1 - (confidence.battery_risk.degradation_percent / 100));
                  const degradedUsagePercent = Math.round((input.dailyMiles / degradedRange) * 100);

                  return (
                    <>
                      <p className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Daily Range Usage:</strong> Your {input.dailyMiles} miles/day uses approximately {dailyUsagePercent}% of current usable range (~{estimatedRange} miles)</span>
                      </p>
                      <p className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Degradation Buffer:</strong> Even with {confidence.battery_risk.degradation_percent}% estimated degradation,
                        your daily usage would be {degradedUsagePercent}% of the degraded range</span>
                      </p>
                      <p className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Charging Infrastructure:</strong> {input.homeCharging
                          ? 'Home charging access significantly reduces your dependency on public infrastructure and lowers per-mile costs by ~60%'
                          : 'Consider installing home charging to reduce costs by ~60% vs. public charging'}</span>
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-3">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Climate Impact</p>
                <p className="text-lg font-bold text-green-600">{confidence.ownership_fit.climate_impact}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Charger Density</p>
                <p className="text-lg font-bold text-green-600">{confidence.ownership_fit.charger_density}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700">Daily Range Fit</p>
                <p className="text-lg font-bold text-green-600">{confidence.ownership_fit.annual_miles_fit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Battery Replacement Context - NEW SECTION D */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Battery Replacement Context
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="bg-blue-50 p-5 rounded-lg mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Estimated Replacement Cost</p>
                <p className="text-4xl font-bold text-blue-600 mb-1">${confidence.battery_risk.estimated_replacement_cost.toLocaleString()}</p>
                <p className="text-xs text-gray-600">
                  Typical range: ${Math.round(confidence.battery_risk.estimated_replacement_cost * 0.6).toLocaleString()} - ${Math.round(confidence.battery_risk.estimated_replacement_cost * 1.25).toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-gray-700">
                    <strong>Good news:</strong> Battery replacement is rare within the manufacturer's warranty period (typically 8 years / 100,000 miles)
                  </p>
                </div>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-gray-700">
                    <strong>Timeline:</strong> Risk increases primarily after {8 - (new Date().getFullYear() - input.year)} more years or {Math.max(100000 - (input.currentMileage || 0), 0).toLocaleString()} additional miles
                  </p>
                </div>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-gray-700">
                    <strong>For your usage:</strong> At {input.dailyMiles} miles/day (~{Math.round(input.dailyMiles * 365)} miles/year),
                    replacement timing depends on actual battery health data and your specific usage patterns
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-3">What Triggers Battery Replacement?</h3>
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-semibold text-gray-800 text-sm mb-1">Capacity Below 70%</p>
                  <p className="text-xs text-gray-600">Most manufacturers warranty batteries to 70% capacity. Below this, range anxiety becomes significant.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-semibold text-gray-800 text-sm mb-1">Cell Failure / Thermal Issues</p>
                  <p className="text-xs text-gray-600">Individual cell failures or cooling system problems may require partial or full pack replacement.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-semibold text-gray-800 text-sm mb-1">Safety Recalls</p>
                  <p className="text-xs text-gray-600">Manufacturer-issued recalls for battery defects (covered under recall, not owner expense).</p>
                </div>
              </div>

              <div className="mt-4 bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="text-sm text-green-900">
                  <strong>Bottom line:</strong> Battery technology has proven more durable than early predictions.
                  Most EVs from {input.year} show <strong>5-8% degradation</strong> after 100k miles, well above replacement thresholds.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Quality Section - What We Know vs. Don't Know */}
        {reportData.dataQuality && (
          <DataQualitySection
            knownData={reportData.dataQuality.knownData}
            unknownData={reportData.dataQuality.unknownData}
            risks={reportData.dataQuality.risks}
            nextSteps={reportData.dataQuality.nextSteps}
            overallConfidence={reportData.dataQuality.overallConfidence}
            confidenceNote={reportData.dataQuality.confidenceNote}
          />
        )}

        {/* Personalization Section - Scroll Target */}
        {phase05Data.shouldShowPhase05 && (
          <div ref={personalizationRef} className="bg-blue-50 border-2 border-blue-300 rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📋 Help us personalize your assessment
            </h2>
            <p className="text-gray-700 mb-6">
              We generated this report using listing data only. Adding a few details about your situation would significantly improve accuracy.
              <span className="font-semibold"> This takes about 2 minutes.</span>
            </p>

            <div className="bg-white border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 mb-4">Quick questions to improve your report:</h3>

              <div className="space-y-4">
                {!personalizationContext.hasDrivingPattern && (
                  <div className="flex items-start p-4 bg-gray-50 rounded border border-gray-200">
                    <span className="text-2xl mr-3">🚗</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">What's your typical daily driving?</p>
                      <p className="text-sm text-gray-600">Helps us verify if this vehicle's range fits your needs</p>
                    </div>
                  </div>
                )}

                {!personalizationContext.hasChargingAccess && (
                  <div className="flex items-start p-4 bg-gray-50 rounded border border-gray-200">
                    <span className="text-2xl mr-3">⚡</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Do you have access to home charging?</p>
                      <p className="text-sm text-gray-600">Changes ownership costs by ~60% and affects vehicle practicality</p>
                    </div>
                  </div>
                )}

                {!personalizationContext.hasZipCode && (
                  <div className="flex items-start p-4 bg-gray-50 rounded border border-gray-200">
                    <span className="text-2xl mr-3">🌡️</span>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">What's your ZIP code?</p>
                      <p className="text-sm text-gray-600">Local climate affects battery degradation and charging infrastructure</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-4">
                  <span className="font-semibold">Privacy note:</span> Your data is never sold or shared. We use it only to improve your risk assessment.
                </p>
                <button
                  onClick={() => router.push('/')}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
                >
                  ← Go back and add your info (takes 2 minutes)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Paid Upsell CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl shadow-2xl p-8 mb-8 text-white">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-3">🔍 Want the Full Picture?</h2>
            <p className="text-xl text-blue-100">Get our comprehensive 12-page report for only $15</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">What's Included:</h3>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Model-specific failure rate analysis</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Price negotiation talking points</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Pre-purchase inspection checklist</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Dealer questions script</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>Battery health verification steps</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">✓</span>
                  <span>5-year total cost of ownership estimate</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">Why Upgrade?</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">💰</span>
                  <div>
                    <div className="font-semibold">Save Thousands</div>
                    <div className="text-sm text-blue-100">Armed with negotiation data points</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-3xl mr-3">🛡️</span>
                  <div>
                    <div className="font-semibold">Avoid Costly Mistakes</div>
                    <div className="text-sm text-blue-100">Know exactly what to inspect</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <span className="text-3xl mr-3">📊</span>
                  <div>
                    <div className="font-semibold">Data-Backed Confidence</div>
                    <div className="text-sm text-blue-100">Real failure rates, not guesses</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={async () => {
                try {
                  // Create free report in database
                  const createResponse = await fetch('/api/report/free', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reportData })
                  });

                  if (!createResponse.ok) {
                    throw new Error('Failed to create report');
                  }

                  const { reportId } = await createResponse.json();
                  setReportId(reportId);

                  // Trigger PDF download
                  const pdfLink = document.createElement('a');
                  pdfLink.href = `/api/report/${reportId}/pdf`;
                  pdfLink.download = `EV-Risk-${input.year}-${input.model}-Report.pdf`;
                  document.body.appendChild(pdfLink);
                  pdfLink.click();
                  document.body.removeChild(pdfLink);

                  // Show feedback modal after short delay
                  setTimeout(() => {
                    setShowFeedbackModal(true);
                  }, 1500);
                } catch (error) {
                  console.error('Free report error:', error);
                  alert('An error occurred. Please try again.');
                }
              }}
              className="bg-white text-blue-600 font-bold text-lg px-12 py-4 rounded-full hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get Full Report
            </button>
            <p className="mt-4 text-sm text-blue-100">
              <span className="line-through opacity-75">$15</span> <span className="font-bold text-white">FREE</span> - First report is on us!
            </p>
            <p className="mt-2 text-xs text-blue-100 opacity-90">
              ✓ Instant PDF download  ✓ Comprehensive analysis  ✓ No payment required
            </p>
          </div>
        </div>

        {/* HARD BLOCKER #1: Decision State Summary (Report Closure) */}
        <DecisionStateSummary
          confidenceInputs={confidenceInputs}
          vehicleAge={input.year ? new Date().getFullYear() - input.year : undefined}
          vehicleModel={input.model}
        />

        {/* Next Steps */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Due Diligence Steps
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Schedule a pre-purchase inspection with a certified EV technician</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Request battery health report showing current State of Health (SoH)</span>
            </li>
            {confidence.platform_risk.total_recalls > 0 && (
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 mt-1">✓</span>
                <span className="text-gray-700">Verify all {confidence.platform_risk.total_recalls} recall(s) have been completed by dealer</span>
              </li>
            )}
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Check for remaining manufacturer warranty coverage</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-3 mt-1">✓</span>
              <span className="text-gray-700">Consider extended warranty if available based on your tolerance for uncertainty</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          {/* Data Sources Card */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-3">Data Sources & Methodology</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
              <div>
                <div className="font-semibold text-gray-800 mb-1">Battery Degradation</div>
                <div>Geotab, Recurrent Auto, Tesla Impact Report (2023)</div>
              </div>
              <div>
                <div className="font-semibold text-gray-800 mb-1">Recalls & Reliability</div>
                <div>NHTSA database, 10,000+ owner reports, Consumer Reports</div>
              </div>
              <div>
                <div className="font-semibold text-gray-800 mb-1">Infrastructure Data</div>
                <div>US DOE Alternative Fuels Data Center, NOAA climate data</div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Last updated: January 2025 • Covers 150+ EV models (2010-2025)
            </p>
          </div>

          <p className="text-sm text-gray-500 mb-2">
            Report generated: {new Date(reportData.timestamp).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            <strong className="text-gray-800">⚡ Tool by EV analysts</strong> - This report is for informational purposes only.
            <br />
            <strong>Always obtain a pre-purchase inspection</strong> from a certified EV technician before purchasing.
          </p>
        </div>
          </>
        )}
        {/* END HIDDEN SECTIONS */}
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && !feedbackSubmitted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-fadeIn">
            <button
              onClick={() => setShowFeedbackModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Report is Ready!</h3>
              <p className="text-gray-600">The PDF should download shortly.</p>
              <p className="text-sm text-gray-500 mt-2">
                <span className="line-through">$15</span> <span className="font-bold text-green-600">FREE</span> - This first one's on us!
              </p>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="font-semibold text-gray-900 mb-4">Help us improve EV-Risk!</h4>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const rating = formData.get('rating');
                const feedbackText = formData.get('feedback');
                const wouldRecommend = formData.get('recommend') === 'yes';

                try {
                  await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      reportId,
                      rating: rating ? parseInt(rating as string) : null,
                      feedbackText,
                      wouldRecommend
                    })
                  });
                  setFeedbackSubmitted(true);

                  // Redirect to homepage after 3 seconds
                  setTimeout(() => {
                    window.location.href = '/';
                  }, 3000);
                } catch (error) {
                  console.error('Feedback error:', error);
                }
              }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How useful was this report?
                  </label>
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <label key={star} className="cursor-pointer">
                        <input type="radio" name="rating" value={star} className="sr-only peer" />
                        <svg className="w-8 h-8 text-gray-300 peer-checked:text-yellow-400 hover:text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Would you recommend EV-Risk to others?
                  </label>
                  <div className="flex gap-4 justify-center">
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="recommend" value="yes" className="mr-2" />
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input type="radio" name="recommend" value="no" className="mr-2" />
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Any suggestions or feedback? (optional)
                  </label>
                  <textarea
                    name="feedback"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your feedback helps us improve..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFeedbackModal(false);
                      // Redirect to homepage after skipping
                      setTimeout(() => {
                        window.location.href = '/';
                      }, 500);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Submit Feedback
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Thank You Message */}
      {feedbackSubmitted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
            <p className="text-gray-600">Your feedback helps us improve EV-Risk for everyone.</p>
            <p className="text-sm text-gray-500 mt-4">Redirecting to homepage in 3 seconds...</p>
          </div>
        </div>
      )}

      {/* Save for Later Modal */}
      {reportData && input && (
        <SaveForLaterModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          reportUrl={typeof window !== 'undefined' ? window.location.href : ''}
          vehicle={`${input.year} ${input.model}`}
        />
      )}

      {/* FEATURE 3: What Sellers Don't Disclose - Collapsible Checklist */}
      <WhatSellersHide />

      {/* Debug Panel (only visible with ?debug=1) */}
      {isDebugMode && reportData && input && confidence && (() => {
        const debugData = generateDebugData({
          model: input.model,
          year: input.year,
          currentMileage: (input as any).currentMileage || 0,
          zipCode: input.zipCode,
          dailyMiles: input.dailyMiles,
          homeCharging: input.homeCharging,
          riskTolerance: input.riskTolerance as "conservative" | "moderate" | "aggressive",
        }, confidence);

        return (
          <DebugPanel
            normalizedInputs={debugData.normalizedInputs}
            derivedFeatures={debugData.derivedFeatures}
            ruleTriggers={debugData.ruleTriggers}
            inputHash={debugData.inputHash}
            confidence={confidence}
          />
        );
      })()}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report...</p>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
