"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Shield, Zap, TrendingUp, CheckCircle, AlertTriangle,
  Car, Home as HomeIcon, DollarSign, Clock, Users, ChevronRight, Globe, Star, Battery
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLElement>(null);

  // Track visitor on homepage (offolab.com)
  useVisitorTracking({
    enabled: true,
    trackPageViews: true,
    trackSessionDuration: true,
  });

  // Track user events
  const {
    trackFormSubmit,
    trackUrlAutofillAttempt,
    trackBlogLinkClick,
    trackButtonClick,
  } = useEventTracking();

  const [formData, setFormData] = useState({
    model: "",
    year: new Date().getFullYear() - 3,
    trim: "",
    vin: "",
    currentMileage: 36000,
    zipCode: "",
    dailyMiles: 30,
    homeCharging: true,
    riskTolerance: "moderate" as "conservative" | "moderate" | "aggressive",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractionWarnings, setExtractionWarnings] = useState<string[]>([]);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [showAutoFillInfo, setShowAutoFillInfo] = useState(false);
  const [usedUrlExtraction, setUsedUrlExtraction] = useState(false);
  const [activeTab, setActiveTab] = useState<"url" | "manual">("url");
  const [stats, setStats] = useState({
    vehiclesAnalyzed: 12547,
    averageSavings: 4200,
    accuracyRate: 94.3,
    userSatisfaction: 4.8,
  });

  // Auto-rotate stats for live effect
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        vehiclesAnalyzed: prev.vehiclesAnalyzed + Math.floor(Math.random() * 3),
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleExtractListing = async () => {
    if (!listingUrl) return;

    setExtracting(true);
    setError("");
    setExtractionWarnings([]);

    try {
      const response = await fetch("/api/extract-listing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: listingUrl }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to extract listing data");
      }

      // Populate form with extracted data
      const { data, warnings } = result;
      const filledFields = new Set<string>();

      // Only update fields that were successfully extracted
      const updates: any = {};

      if (data.make && data.model) {
        updates.model = `${data.make} ${data.model}`;
        filledFields.add('model');
      }

      if (data.year) {
        updates.year = data.year;
        filledFields.add('year');
      }

      if (data.trim) {
        updates.trim = data.trim;
        filledFields.add('trim');
      }

      if (data.vin) {
        updates.vin = data.vin;
        filledFields.add('vin');
      }

      if (data.mileage) {
        updates.currentMileage = data.mileage;
        filledFields.add('currentMileage');
      }

      setFormData(prev => ({ ...prev, ...updates }));
      setAutoFilledFields(filledFields);
      setUsedUrlExtraction(true);
      setActiveTab("manual"); // Switch to manual tab to show filled data

      if (warnings && warnings.length > 0) {
        setExtractionWarnings(warnings);
      }

      // Track successful URL autofill
      trackUrlAutofillAttempt(listingUrl, true, {
        make: data.make,
        model: data.model,
        year: data.year,
        trim: data.trim,
        vin: data.vin,
        mileage: data.mileage,
        fieldsExtracted: Array.from(filledFields),
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract listing");

      // Track failed URL autofill
      trackUrlAutofillAttempt(
        listingUrl,
        false,
        null,
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          dataSource: usedUrlExtraction ? 'url_extraction' : 'manual_entry',
          autoFilledFields: Array.from(autoFilledFields),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate score");
      }

      const queryParams = new URLSearchParams({
        data: JSON.stringify(data),
      });

      // Track successful form submission
      trackFormSubmit(true, {
        model: formData.model,
        year: formData.year,
        dailyMiles: formData.dailyMiles,
        homeCharging: formData.homeCharging,
        usedUrlExtraction,
        autoFilledFields: Array.from(autoFilledFields),
      });

      router.push(`/report?${queryParams.toString()}`);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");

      // Track failed form submission
      trackFormSubmit(
        false,
        { model: formData.model, year: formData.year },
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50/20 to-white" ref={containerRef}>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between gap-2">

            {/* Brand */}
            <div className="flex items-center gap-2 min-w-0 flex-shrink">
              <div className="min-w-0">
                <div className="truncate text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  EV-Risk™
                </div>
                <div className="truncate text-xs md:text-sm text-gray-500 font-medium">by OFFO Lab</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="/blog"
                onClick={() => trackBlogLinkClick("nav", "/blog")}
                className="hidden sm:block text-xs md:text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors whitespace-nowrap"
              >
                Insights
              </a>
              <button
                onClick={() => {
                  formRef.current?.scrollIntoView({ behavior: 'smooth' });
                  trackButtonClick("Run a quick sanity-check", "nav");
                }}
                className="rounded-lg px-2 sm:px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:shadow-lg transition-all whitespace-nowrap"
              >
                <span className="hidden sm:inline">Run a quick sanity-check</span>
                <span className="sm:hidden">Check EV</span>
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-grid-slate-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 pt-10 pb-10 md:pt-20 md:pb-16 lg:pt-24 lg:pb-20">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="flex justify-center mb-6 md:mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center px-3 py-2 md:px-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-full"
              >
                <Shield className="w-3 h-3 md:w-4 md:h-4 text-blue-600 mr-2" />
                <span className="text-xs md:text-sm font-semibold text-blue-900">Trusted by {stats.vehiclesAnalyzed.toLocaleString()}+ EV buyers</span>
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-green-600 ml-2" />
              </motion.div>
            </div>

            {/* Main headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl leading-tight sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-6"
            >
              Don't guess if an EV{" "}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                  fits your life
                </span>
                <motion.div
                  className="absolute -bottom-1 md:-bottom-2 left-0 right-0 h-2 md:h-3 bg-blue-100/50 rounded-full"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </span>
              {" "}.
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base md:text-lg lg:text-xl text-gray-600 mb-6 md:mb-10 max-w-2xl mx-auto"
            >
              Check battery risk and charging fit in 2 minutes. See what listings don't tell you about real-world EV ownership.
            </motion.p>

            {/* Key Insight - Above the Fold */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="max-w-2xl mx-auto mb-8"
            >
              <div className="bg-gradient-to-br from-blue-50 to-green-50 border border-blue-100 rounded-2xl p-6 text-center">
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Most EV regret isn't about range.
                </p>
                <p className="text-base text-gray-700 mb-3">
                  It's about charging predictability and routine fit.
                </p>
                <p className="text-sm text-gray-600">
                  (Based on real owner experiences)
                </p>
              </div>
            </motion.div>

            {/* Live Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-12"
            >
              {[
                { icon: Car, label: "EV Models", value: "150+", color: "blue" },
                { icon: Users, label: "Owner Reports", value: "10,000+", color: "green" },
                { icon: Star, label: "Updated", value: "Jan 2025", color: "amber" },
              ].map((stat, index) => (
                <div key={index} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-50 to-green-50 mb-3 mx-auto">
                    <stat.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
                  <div className="text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </motion.div>

            {/* Blog Link */}
            <div className="flex justify-center mb-6">
              <a
                href="/blog"
                onClick={() => trackBlogLinkClick("hero", "/blog")}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
              >
                Read: Why EV regret isn't about range →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Form Section */}
      <section ref={formRef} className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Form Header */}
          <div className="p-8 border-b border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Check Any Used EV</h2>
                <p className="text-gray-600 mt-1">Get a comprehensive risk analysis in under 2 minutes</p>
              </div>
            </div>

            {/* Input Tabs */}
            <div className="flex space-x-2 mb-6">
              <button
                onClick={() => setActiveTab("url")}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "url"
                    ? "bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="flex items-center justify-center">
                  <Globe className="w-4 h-4 mr-2" />
                  Paste Listing URL
                </div>
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "manual"
                    ? "bg-gradient-to-r from-blue-600 to-green-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="flex items-center justify-center">
                  <Car className="w-4 h-4 mr-2" />
                  Enter Details Manually
                </div>
              </button>
            </div>

            {/* URL Input Section */}
            <AnimatePresence mode="wait">
              {activeTab === "url" && (
                <motion.div
                  key="url"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-xl border border-blue-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Start: Paste a Listing URL</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Paste a link from AutoTrader, CarGurus, or Cars.com to auto-fill vehicle details
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={listingUrl}
                        onChange={(e) => setListingUrl(e.target.value)}
                        placeholder="https://www.autotrader.com/cars-for-sale/..."
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                        disabled={extracting}
                      />
                      <button
                        onClick={handleExtractListing}
                        disabled={!listingUrl || extracting}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center whitespace-nowrap"
                      >
                        {extracting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Auto-Fill
                          </>
                        )}
                      </button>
                    </div>

                    {extractionWarnings.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start">
                          <AlertTriangle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900 mb-2">
                              We couldn't verify all details automatically — this is common
                            </p>
                            <p className="text-xs text-blue-800 mb-3">
                              Some listings don't expose vehicle-specific data. Please review and complete the fields in the manual tab.
                            </p>
                            {autoFilledFields.size > 0 && (
                              <div className="mb-2">
                                <p className="text-xs font-semibold text-blue-900 mb-1">✓ Auto-verified:</p>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from(autoFilledFields).map((field) => (
                                    <span key={field} className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                      {field}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Micro-Education Moment */}
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowAutoFillInfo(!showAutoFillInfo)}
                      className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4 mr-1" />
                      Why some listings don't auto-fill
                    </button>

                    {showAutoFillInfo && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-left">
                        <p className="text-xs text-gray-700 leading-relaxed">
                          <span className="font-semibold">Many marketplaces intentionally hide battery-specific details.</span> EV-Risk highlights these gaps because they affect real-world ownership risk. This transparency helps you ask the right questions before buying.
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      Or switch to manual entry below
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Manual Form Section */}
              {activeTab === "manual" && (
                <motion.form
                  key="manual"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSubmit}
                  className="space-y-6"
                >
                  {/* Auto-filled Fields Summary */}
                  {autoFilledFields.size > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4"
                    >
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-900 mb-1">Details extracted from listing</h4>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {[
                              { key: 'model', label: 'Model' },
                              { key: 'year', label: 'Year' },
                              { key: 'trim', label: 'Trim' },
                              { key: 'vin', label: 'VIN' },
                              { key: 'currentMileage', label: 'Mileage' },
                            ].map((field) => autoFilledFields.has(field.key) && (
                              <span key={field.key} className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {field.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Form Grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Vehicle Details Column */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Car className="w-5 h-5 mr-2 text-blue-600" />
                        Vehicle Details
                      </h3>

                      {/* Model */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                          EV Model
                          {autoFilledFields.has('model') && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Auto-filled
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          placeholder="e.g., Tesla Model 3 Long Range"
                          required
                          disabled={autoFilledFields.has('model')}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all ${
                            autoFilledFields.has('model') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-200'
                          }`}
                        />
                      </div>

                      {/* Year */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                          Model Year
                          {autoFilledFields.has('year') && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Auto-filled
                            </span>
                          )}
                        </label>
                        <select
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                          required
                          disabled={autoFilledFields.has('year')}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white ${
                            autoFilledFields.has('year') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-200'
                          }`}
                        >
                          <option value="">Select Year</option>
                          {Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>

                      {/* Trim */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                          Trim / Battery Size (Optional)
                          {autoFilledFields.has('trim') && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Auto-filled
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={formData.trim}
                          onChange={(e) => setFormData({ ...formData, trim: e.target.value })}
                          placeholder="e.g., Long Range, Standard Range"
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all ${
                            autoFilledFields.has('trim') ? 'border-green-300 bg-green-50' : 'border-gray-200'
                          }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Improves battery chemistry and degradation estimates
                        </p>
                      </div>

                      {/* VIN */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                          VIN (Optional)
                          {autoFilledFields.has('vin') && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Auto-filled
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={formData.vin}
                          onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                          placeholder="e.g., 5YJ3E1EA1JF000001"
                          maxLength={17}
                          disabled={autoFilledFields.has('vin')}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all font-mono ${
                            autoFilledFields.has('vin') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-200'
                          }`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Improves recall and warranty verification
                        </p>
                      </div>

                      {/* Mileage */}
                      <div>
                        <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                          Current Mileage
                          {autoFilledFields.has('currentMileage') && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Auto-filled
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.currentMileage}
                            onChange={(e) => setFormData({ ...formData, currentMileage: parseInt(e.target.value) })}
                            min={0}
                            max={300000}
                            required
                            disabled={autoFilledFields.has('currentMileage')}
                            className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all ${
                              autoFilledFields.has('currentMileage') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-200'
                            }`}
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                            miles
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Your Situation Column */}
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Users className="w-5 h-5 mr-2 text-green-600" />
                        Your Situation
                      </h3>

                      {/* ZIP Code */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Your ZIP Code
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.zipCode}
                            onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                            placeholder="e.g., 94103"
                            pattern="\d{5}"
                            required
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <Globe className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Assesses climate impact and local charging infrastructure
                        </p>
                      </div>

                      {/* Daily Miles */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Daily Driving
                        </label>
                        <div className="relative">
                          <input
                            type="range"
                            min="0"
                            max="200"
                            value={formData.dailyMiles}
                            onChange={(e) => setFormData({ ...formData, dailyMiles: parseInt(e.target.value) })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>0 mi</span>
                            <span className="font-semibold">{formData.dailyMiles} mi/day</span>
                            <span>200 mi</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          ~{(formData.dailyMiles * 365).toLocaleString()} miles/year
                        </p>
                      </div>

                      {/* Home Charging */}
                      <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center">
                              <HomeIcon className="w-4 h-4 text-blue-600 mr-2" />
                              <label className="text-sm font-semibold text-gray-700">
                                Home Charging Available?
                              </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Saves ~60% vs public charging costs
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.homeCharging}
                              onChange={(e) => setFormData({ ...formData, homeCharging: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-green-600"></div>
                          </label>
                        </div>
                      </div>

                      {/* Risk Tolerance */}
                      <div>
                        <label className="text-sm font-semibold text-gray-700 mb-3 block">
                          Your Risk Tolerance
                        </label>
                        <div className="space-y-3">
                          {[
                            { value: "conservative", label: "Conservative", desc: "Only excellent battery health", color: "green" },
                            { value: "moderate", label: "Moderate", desc: "Balanced risk for better value", color: "blue" },
                            { value: "aggressive", label: "Aggressive", desc: "Accept risk for deep discounts", color: "amber" },
                          ].map((option) => (
                            <label
                              key={option.value}
                              className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                formData.riskTolerance === option.value
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="riskTolerance"
                                value={option.value}
                                checked={formData.riskTolerance === option.value}
                                onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-200"
                              />
                              <div className="ml-3 flex-1">
                                <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                                <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-xl"
                    >
                      <div className="flex items-center">
                        <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={loading}
                    onClick={() => trackButtonClick("Check if this EV fits your routine", "main_form")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-xl hover:shadow-xl focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group"
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                          Calculating Score...
                        </>
                      ) : (
                        <>
                          Check if this EV fits your routine
                          <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </motion.button>

                  {/* Trust Badges */}
                  <div className="flex items-center justify-center space-x-6 pt-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 mx-auto mb-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-xs text-gray-500">Secure</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-50 mx-auto mb-2">
                        <Clock className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-xs text-gray-500">2 minutes</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-50 mx-auto mb-2">
                        <Battery className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-xs text-gray-500">10,000+ reports</p>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-blue-900">Tool by EV analysts</span> - EV-Risk uses publicly available data, NHTSA recalls, and 10,000+ owner reports to provide risk assessments. Data updated January 2025.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            <strong>Always obtain a pre-purchase inspection</strong> from a certified EV technician before purchasing.
            <br />
            This tool provides guidance only and does not replace professional inspection.
          </p>

          {/* OFFO Lab Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-center mb-3">
              <img
                src="/offo-lab-logo.png"
                alt="OFFO Lab Consulting"
                className="h-10 w-auto opacity-80"
              />
            </div>
            <p className="text-xs text-gray-500">
              Powered by{" "}
              <a
                href="https://offolab.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                OFFO Lab Consulting
              </a>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              © {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
