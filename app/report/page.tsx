"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import DataQualitySection from "@/components/DataQualitySection";
import PersonalizationOpportunityCard from "@/components/PersonalizationOpportunityCard";
import DataQualityDecisionConfidence from "@/components/DataQualityDecisionConfidence";
import WhatsMissingModule from "@/components/WhatsMissingModule";
import { VehicleContextFactors } from "@/components/VehicleContextFactors";
import { WhatWeKnowSection } from "@/components/WhatWeKnowSection";
import { RoutineFitVerdict } from "@/components/RoutineFitVerdict";
import { WhyThisResult } from "@/components/WhyThisResult";
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
import WhyCheckpointCard from "@/components/WhyCheckpointCard";
import DecisionResolution from "@/components/DecisionResolution";
import { ResultPageLite } from "@/components/ResultPageLite";
import { ResultPageV2 } from "@/components/ResultPageV2";
import { ResultPageV2Split } from "@/components/ResultPageV2Split";
import RoutineResultsPaywallCard from "@/components/routine/RoutineResultsPaywallCard";
import { generateConfidenceData, type ConfidenceInputs } from "@/lib/confidence-calculator";
import { transformToPresentation } from "@/lib/presentation-transformer";
import { generateDebugData } from "@/lib/debug-helpers";
import { generateMissingDataExplanations, getPrimaryMissingExplanation, generatePersonalizationOpportunities } from "@/lib/missing-data-generator";
import { calculateRoutineFitClient } from "@/lib/routine-fit-client";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useSessionTracking } from "@/hooks/useSessionTracking";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { assignPriceVariant, getDisplayPrice } from "@/lib/price-assignment";
import { getOrCreateReceiptToken } from "@/lib/session-utils";
import type { Region } from "@/lib/regionCopy";
import type { KnownDataPoint, UnknownDataPoint, RiskFactor } from "@/types/report";
import type { EvRiskReportV2 } from "@/types/v2";
import type { EvRiskReportV2Contract } from "@/types/v2-contract";

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

interface AreaChargingContext {
  contentionLevel: "minimal" | "low" | "moderate" | "high";
  summary: string;
  confidenceImpact: "reduces" | "neutral";
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
  area_charging_context?: AreaChargingContext;
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

// Use shared receipt token utility
const getOrCreateAnonId = getOrCreateReceiptToken;

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportV2Data, setReportV2Data] = useState<EvRiskReportV2 | null>(null);
  const [reportV2ContractData, setReportV2ContractData] = useState<EvRiskReportV2Contract | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showFullReport, setShowFullReport] = useState(false);
  const [region, setRegion] = useState<Region>("US");
  const [anonId, setAnonId] = useState("");

  // Payment polling state
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const isUnlockedRef = useRef(false);
  const checkoutReturnRef = useRef(false);

  // Event tracking
  const { trackButtonClick, trackEvent, trackReportGenerateClick } = useEventTracking();
  const { trackResultsViewed, completeSession } = useSessionTracking();
  const hasTrackedResultsViewed = useRef(false);

  // Initialize anonId from localStorage
  useEffect(() => {
    setAnonId(getOrCreateAnonId());
  }, []);

  // Payment status for gating PDF download
  const {
    isUnlocked,
    paymentsEnabled,
    refetch: refetchPayment,
  } = usePaymentStatus("evroutine", reportId, anonId);

  // Keep isUnlockedRef in sync
  useEffect(() => { isUnlockedRef.current = isUnlocked; }, [isUnlocked]);

  // Track if we've already tracked vehicle checkout for this session
  const hasTrackedCheckout = useRef(false);

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

    // Set paid status, reportId, and sessionId
    setIsPaid(paidParam === "true");
    setReportId(reportIdParam);

    // Get session_id from URL params or sessionStorage
    const sessionIdParam = searchParams.get("session_id");
    const storedSessionId = typeof window !== "undefined" ? sessionStorage.getItem("offo_session_id") : null;
    setSessionId(sessionIdParam || storedSessionId);

    if (dataParam) {
      const loadData = async () => {
        try {
          const parsed = JSON.parse(dataParam);
          console.log("[Report Page] Successfully parsed data:", parsed);

          // V2 dispatch: if schema_version is "v2"
          if (parsed.schema_version === "v2") {
            // Extract reportId from persisted data or contract fields
            const rId = parsed._persisted_report_id || parsed.report_id || null;
            if (rId) setReportId(rId);

            if (parsed.default_view) {
              // New contract shape (Default View + Appendix)
              console.log("[Report Page] V2 contract report detected");
              const contract = parsed as EvRiskReportV2Contract;
              setReportV2ContractData(contract);
              trackReportGenerateClick({
                report_id: contract.report_id,
                scenario_id: contract.scenario_id,
                scenario_slug: contract.scenario_slug,
              });
            } else {
              // Legacy V2 shape (backward compat)
              console.log("[Report Page] V2 legacy report detected");
              setReportV2Data(parsed as EvRiskReportV2);
            }
            trackButtonClick("report_view", "report-page-v2");
            return;
          }

          // Extract region from parsed data if available
          if (parsed.region) {
            setRegion(parsed.region as Region);
          }

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
                zipCode: parsed.zipCode || "00000",
                dailyMiles: parsed.dailyMiles || 40,
                homeCharging: parsed.homeCharging ?? false,
                riskTolerance: parsed.riskTolerance || "moderate",
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
          // Extract reportId for V1 data
          if (!reportIdParam) {
            const rId = parsed._persisted_report_id || parsed.report_id || null;
            if (rId) setReportId(rId);
          }

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
      // Check if returning from checkout — restore from sessionStorage
      const checkoutParam = searchParams.get("checkout");
      if (checkoutParam && typeof window !== "undefined") {
        const stored = sessionStorage.getItem("evreport_checkout_data");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            sessionStorage.removeItem("evreport_checkout_data");
            if (parsed.schema_version === "v2" && parsed.default_view) {
              setReportV2ContractData(parsed as EvRiskReportV2Contract);
            } else if (parsed.schema_version === "v2") {
              setReportV2Data(parsed as EvRiskReportV2);
            } else {
              setReportData(parsed as ReportData);
            }
            // Set reportId from stored data or URL
            const scenarioId = searchParams.get("scenario_id");
            setReportId(scenarioId || parsed._persisted_report_id || parsed.report_id || null);
            console.log("[Report Page] Restored report data from sessionStorage after checkout");
          } catch (e) {
            console.error("[Report Page] Failed to restore checkout data:", e);
            router.push("/");
          }
        } else {
          // sessionStorage empty — try to load from DB using scenario_id
          const scenarioId = searchParams.get("scenario_id");
          if (scenarioId) {
            (async () => {
              try {
                const res = await fetch(`/api/report/free?reportId=${scenarioId}`);
                if (res.ok) {
                  const dbData = await res.json();
                  if (dbData.payload_json) {
                    const parsed = dbData.payload_json;
                    if (parsed.schema_version === "v2" && parsed.default_view) {
                      setReportV2ContractData(parsed as EvRiskReportV2Contract);
                    } else if (parsed.schema_version === "v2") {
                      setReportV2Data(parsed as EvRiskReportV2);
                    } else {
                      setReportData(parsed as ReportData);
                    }
                    setReportId(scenarioId);
                    console.log("[Report Page] Restored report from DB after checkout");
                    return;
                  }
                }
              } catch (e) {
                console.error("[Report Page] Failed to fetch report from DB:", e);
              }
              console.log("[Report Page] No stored data for checkout return, redirecting to home");
              router.push("/");
            })();
          } else {
            console.log("[Report Page] No stored data for checkout return, redirecting to home");
            router.push("/");
          }
        }
      } else {
        console.log("[Report Page] No data or payload found, redirecting to home");
        router.push("/");
      }
    }
  }, [searchParams, router]);

  // Checkout return: detect ?checkout=success and poll for paid status
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    // Flag that we're returning from checkout (for auto-download)
    checkoutReturnRef.current = true;

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    url.searchParams.delete("scenario_type");
    url.searchParams.delete("scenario_id");
    window.history.replaceState({}, "", url.pathname + url.search);

    // Poll payment status until unlocked (max 30s)
    setIsPollingPayment(true);
    let attempts = 0;
    const maxAttempts = 15;
    const poll = setInterval(async () => {
      attempts++;
      await refetchPayment();
      if (isUnlockedRef.current || attempts >= maxAttempts) {
        clearInterval(poll);
        setIsPollingPayment(false);
      }
    }, 2000);

    return () => clearInterval(poll);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-download PDF when payment unlocks after checkout return
  useEffect(() => {
    if (isUnlocked && checkoutReturnRef.current && reportId) {
      checkoutReturnRef.current = false; // Only trigger once
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = `/api/report/${reportId}/pdf`;
        link.download = "EV-Risk-Report.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 500);
    }
  }, [isUnlocked, reportId]);

  // Track vehicle checkout when report data loads
  useEffect(() => {
    if (reportData && !hasTrackedCheckout.current) {
      hasTrackedCheckout.current = true;

      trackEvent("vehicle_checkout", {
        vehicle_year: reportData.input?.year || null,
        vehicle_model: reportData.input?.model || null,
        vehicle_mileage: reportData.input?.currentMileage || null,
        report_id: reportId || null,
        data_source: reportData.dataQuality?.dataSource || "unknown",
        risk_score: reportData.confidence?.overall_score || null,
        fit_signal: reportData.confidence?.fit_signal || null,
      });
    }
  }, [reportData, reportId, trackEvent]);

  // Track results viewed + write back fit_signal to evroutine_sessions
  useEffect(() => {
    if (hasTrackedResultsViewed.current) return;

    // Determine fit_signal from whichever report format loaded
    const fitSignal =
      reportV2ContractData?.default_view?.fit_verdict?.label ||
      reportV2Data?.primary?.routine_fit?.label ||
      reportData?.confidence?.fit_signal ||
      null;

    // Only fire once we have some report data
    if (!reportData && !reportV2Data && !reportV2ContractData) return;
    hasTrackedResultsViewed.current = true;

    // Mark session results as viewed (fire-and-forget)
    trackResultsViewed().catch(() => {});

    // Write back fit_signal to evroutine_sessions if available
    if (fitSignal) {
      completeSession({}, { fit_signal: fitSignal as any }).catch(() => {});
    }

    trackEvent("routine_score_viewed", {
      fit_signal: fitSignal,
      report_id: reportId || null,
    });
  }, [reportData, reportV2Data, reportV2ContractData, reportId, trackResultsViewed, completeSession, trackEvent]);

  // V2 Contract Rendering Path (new Default View + Appendix)
  if (reportV2ContractData) {
    // Gate full result behind payment
    if (paymentsEnabled && !isUnlocked) {
      return (
        <RoutineResultsPaywallCard
          runId={reportId || ""}
          receiptToken={anonId}
          scenarioType="evroutine"
        />
      );
    }
    return (
      <ResultPageV2Split
        contract={reportV2ContractData}
        trackEvent={trackEvent}
        sessionId={sessionId}
        onBack={() => router.push("/")}
        isUnlocked={isUnlocked}
        paymentsEnabled={paymentsEnabled}
        anonId={anonId}
        reportId={reportId}
        isPollingPayment={isPollingPayment}
      />
    );
  }

  // V2 Legacy Rendering Path
  if (reportV2Data) {
    let routineFit = reportV2Data.primary.routine_fit;

    // Backwards compat: convert old WhatBreaksFirst to breakpoints_ranked
    if ((routineFit as any).what_breaks_first && !routineFit.breakpoints_ranked) {
      const old = (routineFit as any).what_breaks_first;
      routineFit = {
        ...routineFit,
        breakpoints_ranked: [
          {
            id: "legacy_primary",
            title: old.primary,
            break_point: old.primary,
            trigger: old.primary_citation,
            evidence: [{ label: "Source", value: "Legacy report" }],
            impact: "High" as const,
            fallback_plan_b: { anchor: "Review your charging routine", backup: "Identify backup charging options", buffer_rule: "Maintain buffer above 30%" },
          },
          {
            id: "legacy_secondary",
            title: old.secondary,
            break_point: old.secondary,
            trigger: old.secondary_citation,
            evidence: [{ label: "Source", value: "Legacy report" }],
            impact: "Medium" as const,
            fallback_plan_b: { anchor: "Monitor this factor", backup: "Plan alternatives in advance", buffer_rule: "Stay flexible with your schedule" },
          },
        ],
      };
    }
    // Backwards compat: old "Conditional Fit" label
    if ((routineFit as any).label === "Conditional Fit") {
      (routineFit as any).label = "Mixed Fit";
    }

    return (
      <ResultPageV2
        routineFit={routineFit}
        ownershipRisk={reportV2Data.secondary.ownership_risk}
        vehicle={reportV2Data.vehicle}
        mvr={reportV2Data.routine}
        dealerQuestions={reportV2Data.dealer_questions}
        confidencePlan={reportV2Data.confidence_plan}
        trackEvent={trackEvent}
        reportData={reportV2Data as unknown as Record<string, unknown>}
        onBack={() => router.push("/")}
        isUnlocked={isUnlocked}
        paymentsEnabled={paymentsEnabled}
        anonId={anonId}
        reportId={reportId}
      />
    );
  }

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

  // Transform to presentation tiers (web vs PDF)
  const presentation = transformToPresentation(
    confidence,
    sessionId,
    routineFit
  );

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

  // LITE VIEW: Compressed 6-block view (default)
  if (!showFullReport) {
    const handleViewFullReport = () => {
      setShowFullReport(true);
      trackButtonClick("view_full_report", "report-page-lite");
    };

    return (
      <div className={`min-h-screen bg-gradient-to-br ${bgColorClass}`}>
        {/* Minimal Back Button */}
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push("/")}
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              New Analysis
            </button>
            <button
              onClick={handleViewFullReport}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              View Full Report
            </button>
          </div>
        </div>

        {/* ResultPageLite - 6 Blocks */}
        <ResultPageLite
          presentation={presentation.web}
          vehicleInfo={{ year: input.year, model: input.model }}
          onViewFullReport={handleViewFullReport}
          scoringInputs={{
            model: input.model,
            year: input.year,
            zipCode: input.zipCode,
            dailyMiles: input.dailyMiles,
            homeCharging: input.homeCharging,
            riskTolerance: input.riskTolerance,
          }}
        />
      </div>
    );
  }

  // FULL VIEW: Legacy detailed view (when user clicks "View Full Report")
  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgColorClass}`}>
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Back Button and Actions */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => {
              setShowFullReport(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Summary
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
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">
            EV-Risk™ Full Report
          </h1>
          <p className="text-sm text-gray-500 mb-2 italic">
            Complete analysis — explains fit and uncertainty
          </p>
          <p className="text-gray-600 text-lg font-medium mb-3">
            {input.year} {input.model}
          </p>
        </div>

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

        {/* Area Charging Context - Minimal Display */}
        {confidence.area_charging_context &&
         confidence.area_charging_context.contentionLevel !== "minimal" && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Area context:</span> {confidence.area_charging_context.summary}
            </p>
          </div>
        )}

        {/* WHY CHECKPOINT - Optional intent signal capture */}
        <WhyCheckpointCard reportId={reportId || undefined} />

        {/* DECISION RESOLUTION - Post-results decision tracking */}
        <DecisionResolution sessionId={sessionId} />

        {/* FULL REPORT DETAILED SECTIONS */}

        {/* FIT SIGNAL - Primary Assessment */}
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

        {/* REMOVED: Mental Load Indicator
            Content is now covered by the mentalLoad field in FitVerdictBlock */}

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

        {/* REMOVED: Charging Fit & Mental Load section
            This content is now covered by:
            - ResultPageLite stability/friction bullets (P0)
            - MentalLoadIndicator component
            - Routine fit assessment in presentation layer */}

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

          {/* REMOVED: Ownership Fit Details section
              This content duplicates routine fit assessment in ResultPageLite */}
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
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
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

        {/* PDF Download CTA — payment-gated when payments enabled */}
        <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl shadow-2xl p-8 mb-8 text-white">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-3">Want the Full Picture?</h2>
            <p className="text-xl text-blue-100">
              {paymentsEnabled && !isUnlocked
                ? <>Unlock the full PDF report — <span className="font-bold">{reportId && anonId ? getDisplayPrice(assignPriceVariant(anonId, reportId)) : "$9.99"}</span></>
                : <>Get the full report — {paymentsEnabled ? <span className="font-bold">Unlocked</span> : <><span className="line-through opacity-70">$15</span> <span className="font-bold">Free during early access</span></>}</>
              }
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">What's Included:</h3>
              <ul className="space-y-2">
                {["Model-specific failure rate analysis", "Price negotiation talking points", "Pre-purchase inspection checklist", "Dealer questions script", "Battery health verification steps", "5-year total cost of ownership estimate"].map((item, i) => (
                  <li key={i} className="flex items-start"><span className="mr-2">✓</span><span>{item}</span></li>
                ))}
              </ul>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-bold text-lg mb-3">Why Upgrade?</h3>
              <div className="space-y-4">
                {[
                  { emoji: "💰", title: "Save Thousands", desc: "Armed with negotiation data points" },
                  { emoji: "🛡️", title: "Avoid Costly Mistakes", desc: "Know exactly what to inspect" },
                  { emoji: "📊", title: "Data-Backed Confidence", desc: "Real failure rates, not guesses" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start">
                    <span className="text-3xl mr-3">{item.emoji}</span>
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      <div className="text-sm text-blue-100">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center">
            {paymentsEnabled && !isUnlocked ? (
              <>
                <button
                  onClick={async () => {
                    try {
                      // Ensure report is persisted before checkout
                      let rId = reportId || (reportData as any)?._persisted_report_id;
                      if (!rId) {
                        const createResponse = await fetch('/api/report/free', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reportData })
                        });
                        if (!createResponse.ok) throw new Error('Failed to create report');
                        const data = await createResponse.json();
                        rId = data.reportId;
                        setReportId(rId);
                      }

                      // Save report data to sessionStorage for checkout return
                      sessionStorage.setItem("evreport_checkout_data", JSON.stringify(reportData));

                      trackEvent("checkout_started", {
                        report_id: rId,
                        scenario_type: "evroutine",
                      });

                      const variant = assignPriceVariant(anonId, rId);
                      const res = await fetch("/api/payments/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          scenario_type: "evroutine",
                          scenario_id: rId,
                          anon_id: anonId,
                          price_variant: variant,
                          page_source: "report_page",
                        }),
                      });
                      const result = await res.json();
                      if (result.url) {
                        window.location.href = result.url;
                      } else if (result.status === "paid") {
                        window.location.reload();
                      } else {
                        alert(result.error || "Checkout failed. Please try again.");
                      }
                    } catch (error) {
                      console.error('Checkout error:', error);
                      alert('An error occurred. Please try again.');
                    }
                  }}
                  className="bg-white text-blue-600 font-bold text-lg px-12 py-4 rounded-full hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Unlock Full Report — {reportId && anonId ? getDisplayPrice(assignPriceVariant(anonId, reportId)) : "$9.99"}
                </button>
                <p className="mt-4 text-sm text-blue-100">
                  One-time payment — includes PDF + listing receipt unlock
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={async () => {
                    try {
                      let rId = reportId || (reportData as any)?._persisted_report_id;
                      if (!rId) {
                        const createResponse = await fetch('/api/report/free', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reportData })
                        });
                        if (!createResponse.ok) throw new Error('Failed to create report');
                        const data = await createResponse.json();
                        rId = data.reportId;
                      }
                      setReportId(rId);

                      const pdfLink = document.createElement('a');
                      pdfLink.href = `/api/report/${rId}/pdf`;
                      pdfLink.download = `EV-Risk-${input.year}-${input.model}-Report.pdf`;
                      document.body.appendChild(pdfLink);
                      pdfLink.click();
                      document.body.removeChild(pdfLink);

                      setTimeout(() => { setShowFeedbackModal(true); }, 1500);
                    } catch (error) {
                      console.error('Report download error:', error);
                      alert('An error occurred. Please try again.');
                    }
                  }}
                  className="bg-white text-blue-600 font-bold text-lg px-12 py-4 rounded-full hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isUnlocked ? "Download Full Report" : "Get Full Report"}
                </button>
                <p className="mt-4 text-sm text-blue-100">
                  {paymentsEnabled
                    ? "Your purchase includes this PDF"
                    : <><span className="line-through opacity-75">$15</span> <span className="font-bold text-white">FREE</span> - First report is on us!</>
                  }
                </p>
                {!paymentsEnabled && (
                  <p className="mt-2 text-xs text-blue-100 opacity-90">
                    ✓ Instant PDF download  ✓ Comprehensive analysis  ✓ No payment required
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* REMOVED: Decision State Summary (Where This Leaves You)
            Content duplicates confidence breakdown and adds verbosity */}

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
                  await fetch('/api/report-feedback', {
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
