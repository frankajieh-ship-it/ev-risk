"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { motion } from "framer-motion";
import { Shield, TrendingUp } from "lucide-react";
import FitQuizModal from "@/components/FitQuizModal";
import FitQuizLauncher from "@/components/FitQuizLauncher";
import ListingUrlForm from "@/components/ListingUrlForm";
import TrustMicrocopy from "@/components/TrustMicrocopy";

export default function Home() {
  const router = useRouter();

  // Track visitor on homepage
  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  const { trackButtonClick, trackUrlAutofillAttempt } = useEventTracking();

  const [stats, setStats] = useState({
    vehiclesAnalyzed: 12547,
  });

  // Fit Quiz Modal
  const [quizOpen, setQuizOpen] = useState(false);

  // URL Extraction
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);

  const handleExtractListing = async (url: string) => {
    console.log('[Frontend] Starting extraction for URL:', url);

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
        setExtractError(result.error || "Failed to extract listing data");
        setExtractWarnings(result.warnings || []);
        trackUrlAutofillAttempt(url, false, null, result.error);
        return;
      }

      // Track successful extraction
      trackUrlAutofillAttempt(url, true, result.data);

      // Navigate to report with extracted data
      const queryParams = new URLSearchParams({
        data: JSON.stringify({
          model: result.data.model || "",
          year: result.data.year || new Date().getFullYear(),
          trim: result.data.trim || "",
          vin: result.data.vin || "",
          currentMileage: result.data.mileage || 0,
          price: result.data.price || 0,
          source: "url-scan",
          extractedFrom: url,
        }),
      });

      router.push(`/report?${queryParams.toString()}`);

    } catch (err) {
      console.error('[Frontend] Extraction error:', err);
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setExtractError(errorMsg);
      trackUrlAutofillAttempt(url, false, null, errorMsg);
    } finally {
      setExtracting(false);
    }
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

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 pt-12 pb-8 md:pt-16 md:pb-12">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="flex justify-center mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-full"
              >
                <Shield className="w-4 h-4 text-blue-600 mr-2" />
                <span className="text-sm font-semibold text-blue-900">
                  Trusted by {stats.vehiclesAnalyzed.toLocaleString()}+ EV buyers
                </span>
                <TrendingUp className="w-4 h-4 text-green-600 ml-2" />
              </motion.div>
            </div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
            >
              Don't guess if an EV{" "}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  fits your life
                </span>
                <motion.div
                  className="absolute -bottom-2 left-0 right-0 h-3 bg-blue-100/50 rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-600 mb-8"
            >
              Check charging fit and routine compatibility in 30 seconds.
            </motion.p>

            {/* Trust Microcopy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-8"
            >
              <TrustMicrocopy />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Two-Card Section - Above the Fold */}
      <section className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Card 1: Listing URL Scanner */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <ListingUrlForm
              onExtract={handleExtractListing}
              extracting={extracting}
              error={extractError}
              warnings={extractWarnings}
            />
          </motion.div>

          {/* Card 2: 5-Question Fit Check */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <FitQuizLauncher
              onClick={() => {
                setQuizOpen(true);
                trackButtonClick("fit-quiz-launcher", "homepage");
              }}
            />
          </motion.div>
        </div>
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
      <FitQuizModal isOpen={quizOpen} onClose={() => setQuizOpen(false)} />
    </div>
  );
}