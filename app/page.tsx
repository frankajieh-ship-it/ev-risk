"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { motion } from "framer-motion";
import { Shield, TrendingUp } from "lucide-react";
import FitQuizModal from "@/components/FitQuizModal";
import ListingUrlForm from "@/components/ListingUrlForm";
import TrustMicrocopy from "@/components/TrustMicrocopy";
import ManualEntryModal, { type ManualVehicleData } from "@/components/ManualEntryModal";
import VehicleInputTabs from "@/components/VehicleInputTabs";
import { type ManualEntryData } from "@/components/ManualEntryInlineForm";

export default function Home() {
  const router = useRouter();

  // Track visitor on homepage
  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  const { trackButtonClick, trackUrlAutofillAttempt, trackEvent } = useEventTracking();

  const [stats, setStats] = useState({
    vehiclesAnalyzed: 12547,
  });

  // Fit Quiz Modal
  const [quizOpen, setQuizOpen] = useState(false);

  // Manual Entry Modal
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualEntryMissingFields, setManualEntryMissingFields] = useState<string[]>([]);
  const [originalUrl, setOriginalUrl] = useState<string>("");

  // URL Extraction
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractedVehicleData, setExtractedVehicleData] = useState<any>(null);
  const [showExtractedData, setShowExtractedData] = useState(false);

  const handleExtractListing = async (url: string) => {
    console.log('[Frontend] Starting extraction for URL:', url);

    // Track home_scan_submit event
    trackButtonClick("home_scan_submit", "homepage");

    setExtracting(true);
    setExtractError(null);
    setExtractWarnings([]);

    try {
      const response = await fetch("/api/extract-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();
      console.log('[Frontend] Extraction result:', result);

      if (!result.success) {
        // Check if this is a parse failure that needs manual entry
        if (result.needsMoreInfo && result.missing) {
          // Open manual entry modal
          setOriginalUrl(url);
          setManualEntryMissingFields(result.missing);
          setManualEntryOpen(true);
          trackUrlAutofillAttempt(url, false, null, "Parse failure - manual entry required");
        } else {
          // Show error message
          setExtractError(result.error || "Failed to extract listing data");
          setExtractWarnings(result.warnings || []);
          trackUrlAutofillAttempt(url, false, null, result.error);
        }
        return;
      }

      // Track successful extraction
      trackUrlAutofillAttempt(url, true, result.data);

      // Map mileage to quiz range
      const mileage = result.data.mileage || 0;
      let mileageRange: number;
      if (mileage < 10000) mileageRange = 5000;
      else if (mileage < 30000) mileageRange = 20000;
      else if (mileage < 60000) mileageRange = 45000;
      else if (mileage < 90000) mileageRange = 75000;
      else mileageRange = 100000;

      // Store extracted vehicle data and show confirmation
      setExtractedVehicleData({
        model: result.data.model || "",
        year: result.data.year || new Date().getFullYear(),
        currentMileage: mileageRange, // Use mapped range for quiz
        actualMileage: mileage, // Store actual mileage for display
        price: result.data.price || 0,
        vin: result.data.vin || "",
      });

      setShowExtractedData(true);
      trackButtonClick("url_scan_success", "homepage");

    } catch (err) {
      console.error('[Frontend] Extraction error:', err);
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setExtractError(errorMsg);
      trackUrlAutofillAttempt(url, false, null, errorMsg);
    } finally {
      setExtracting(false);
    }
  };

  const handleManualEntry = async (manualData: ManualVehicleData) => {
    console.log('[Frontend] Manual entry submitted:', manualData);

    // Store manually entered vehicle data and open quiz modal
    setExtractedVehicleData({
      model: `${manualData.make} ${manualData.model}`,
      year: manualData.year,
      currentMileage: manualData.mileage || 0,
    });

    setManualEntryOpen(false);
    setQuizOpen(true);
    trackButtonClick("manual_entry_success", "homepage");
  };

  const handleManualEntryInline = async (manualData: ManualEntryData) => {
    console.log('[Frontend] Manual entry inline submitted:', manualData);

    // Track manual entry submit event
    trackEvent("manual_entry_submit", {
      context: "homepage",
      has_mileage: !!manualData.mileage,
      has_battery_info: manualData.batteryInfoAvailable,
      missing_fields_count: manualData.missingFields.length,
    });

    // Build extracted vehicle data structure
    setExtractedVehicleData({
      model: `${manualData.make} ${manualData.model}`,
      year: manualData.year,
      currentMileage: manualData.mileage || 0,
      batteryInfoAvailable: manualData.batteryInfoAvailable,
      dataSource: 'manual-entry',
      missingFields: manualData.missingFields,
    });

    // Open quiz with pre-filled data
    setQuizOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/20 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Brand */}
            <div>
              <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                EV-Risk™
              </div>
              <div className="text-xs md:text-sm text-gray-500 font-medium">by OFFO Lab</div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <a
                href="/blog"
                className="hidden sm:block text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                Insights
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Compact for mobile */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 pt-6 pb-4 md:pt-12 md:pb-8">
          <div className="text-center max-w-4xl mx-auto">
            {/* Main headline - Compact on mobile */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-6"
            >
              Is this EV a{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                good fit for me
              </span>
              ?
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-base md:text-lg text-gray-600 mb-4 md:mb-6 max-w-2xl mx-auto"
            >
              The real match is between your routine and the vehicle's real-world behavior.
            </motion.p>

            {/* Trust Microcopy - Compact on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-4 md:mb-6"
            >
              <TrustMicrocopy />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Vehicle Input Section - Above the Fold */}
      <section className="max-w-3xl mx-auto px-4 pb-6 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <VehicleInputTabs
            onExtract={handleExtractListing}
            extracting={extracting}
            error={extractError}
            warnings={extractWarnings}
            extractedData={showExtractedData ? extractedVehicleData : null}
            onConfirm={() => {
              setShowExtractedData(false);
              setQuizOpen(true);
            }}
            onReset={() => {
              setExtractedVehicleData(null);
              setShowExtractedData(false);
              setExtractError(null);
            }}
            onManualSubmit={handleManualEntryInline}
          />
        </motion.div>
      </section>

      {/* Key Insight Section */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="bg-gradient-to-br from-blue-50 to-green-50 border border-blue-100 rounded-2xl p-8 text-center"
        >
          <p className="text-xl font-semibold text-gray-900 mb-3">
            Most EV regret isn't about range.
          </p>
          <p className="text-lg text-gray-700 mb-2">
            It's about charging predictability and routine fit.
          </p>
          <p className="text-sm text-gray-600">
            (Based on real owner experiences)
          </p>
        </motion.div>
      </section>

      {/* Fit Quiz Modal */}
      <FitQuizModal
        isOpen={quizOpen}
        onClose={() => {
          setQuizOpen(false);
          setExtractedVehicleData(null);
        }}
        initialData={extractedVehicleData ? {
          model: extractedVehicleData.model,
          year: extractedVehicleData.year,
          currentMileage: extractedVehicleData.currentMileage,
        } : undefined}
      />

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={manualEntryOpen}
        onClose={() => setManualEntryOpen(false)}
        onSubmit={handleManualEntry}
        missingFields={manualEntryMissingFields}
      />
    </div>
  );
}