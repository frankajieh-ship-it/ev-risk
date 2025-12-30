"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useVisitorTracking } from "@/hooks/useVisitorTracking";
import { useEventTracking } from "@/hooks/useEventTracking";

export default function Home() {
  const router = useRouter();

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
      setUsedUrlExtraction(true); // Track that URL extraction was used

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img
              src="/offo-lab-logo.png"
              alt="OFFO Lab Consulting"
              className="h-24 w-auto"
            />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            EV-Risk™
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            EV Reliability Copilot
          </p>
          <p className="text-xl font-semibold text-gray-800 mb-3">
            Don't guess the battery. Check any used EV's risk in 2 minutes.
          </p>
          <div className="flex justify-center items-center gap-6 text-sm text-gray-500 mb-4">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>150+ EV models</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>10,000+ owner reports</span>
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Updated Jan 2025</span>
            </div>
          </div>

          {/* Blog Link */}
          <div className="flex justify-center">
            <a
              href="/blog"
              onClick={() => trackBlogLinkClick("homepage", "/blog")}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm underline"
            >
              Read: Why EV regret isn't about range →
            </a>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* URL Input Section - NEW */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Quick Start: Paste a Listing URL
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Paste a link from AutoTrader, CarGurus, or Cars.com to auto-fill vehicle details
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={listingUrl}
                      onChange={(e) => setListingUrl(e.target.value)}
                      placeholder="https://www.autotrader.com/cars-for-sale/..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={extracting}
                    />
                    <button
                      type="button"
                      onClick={handleExtractListing}
                      disabled={!listingUrl || extracting}
                      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      {extracting ? "Extracting..." : "Auto-Fill"}
                    </button>
                  </div>

                  {extractionWarnings.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-blue-900 mb-2">
                            We couldn't verify all details automatically — this is common
                          </p>
                          <p className="text-xs text-blue-800 mb-3">
                            Some listings don't expose vehicle-specific data (like trim or battery size). Adding a few details manually improves accuracy and confidence.
                          </p>
                          {autoFilledFields.size > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-blue-900 mb-1">✓ Auto-verified:</p>
                              <div className="flex flex-wrap gap-2">
                                {autoFilledFields.has('model') && (
                                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                    Model
                                  </span>
                                )}
                                {autoFilledFields.has('year') && (
                                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                    Year
                                  </span>
                                )}
                                {autoFilledFields.has('currentMileage') && (
                                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                    Mileage
                                  </span>
                                )}
                                {autoFilledFields.has('trim') && (
                                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                    Trim
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-blue-800 mb-3">
                            <span className="font-semibold">⚠ Needs confirmation:</span> Please review and complete the fields below.
                          </p>

                          {/* Screenshot Upload Fallback */}
                          <div className="pt-3 border-t border-blue-200">
                            <p className="text-xs text-blue-800 mb-2">
                              <span className="font-semibold">Prefer not to type?</span>
                            </p>
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center px-3 py-1.5 bg-gray-100 border border-gray-300 text-gray-500 text-xs font-medium rounded cursor-not-allowed opacity-60"
                            >
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Screenshot upload (beta – coming next)
                            </button>
                            <p className="text-xs text-gray-500 mt-1">
                              Screenshot extraction will be available soon
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Micro-Education Moment */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowAutoFillInfo(!showAutoFillInfo)}
                className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
                Or fill out the form manually below
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rest of the form - same as original */}
            {/* Model Input */}
            <div>
              <label htmlFor="model" className={`block text-sm font-semibold mb-2 flex items-center ${
                autoFilledFields.has('model') ? 'text-gray-500' : 'text-gray-700'
              }`}>
                EV Model
                {autoFilledFields.has('model') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Auto-verified
                  </span>
                )}
              </label>
              <input
                type="text"
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Tesla Model 3 Long Range"
                required
                disabled={autoFilledFields.has('model')}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  autoFilledFields.has('model') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                {autoFilledFields.has('model')
                  ? 'Automatically extracted from listing'
                  : 'Enter the full model name (e.g., "Tesla Model 3 Long Range", "Chevy Bolt EV")'
                }
              </p>
            </div>

            {/* Year Input */}
            <div>
              <label htmlFor="year" className={`block text-sm font-semibold mb-2 flex items-center ${
                autoFilledFields.has('year') ? 'text-gray-500' : 'text-gray-700'
              }`}>
                Model Year
                {autoFilledFields.has('year') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Auto-verified
                  </span>
                )}
              </label>
              <select
                id="year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                required
                disabled={autoFilledFields.has('year')}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${
                  autoFilledFields.has('year') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-300'
                }`}
              >
                <option value="">Select Year</option>
                {Array.from({ length: new Date().getFullYear() - 2009 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {autoFilledFields.has('year') && 'Automatically extracted from listing'}
              </p>
            </div>

            {/* Trim/Battery Size Input */}
            <div>
              <label htmlFor="trim" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                Trim / Battery Size
                {autoFilledFields.has('trim') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Auto-verified
                  </span>
                )}
                {!autoFilledFields.has('trim') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-200">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Improves confidence
                  </span>
                )}
              </label>
              <input
                type="text"
                id="trim"
                value={formData.trim}
                onChange={(e) => setFormData({ ...formData, trim: e.target.value })}
                placeholder="e.g., Long Range, Standard Range, Performance"
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  autoFilledFields.has('trim') ? 'border-green-300 bg-green-50' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-semibold">Optional</span> — <span className="font-semibold">Why provide?</span> Improves battery chemistry and degradation estimates for more accurate risk scoring
              </p>
            </div>

            {/* VIN Input - OPTIONAL */}
            <div>
              <label htmlFor="vin" className={`block text-sm font-semibold mb-2 flex items-center ${
                autoFilledFields.has('vin') ? 'text-gray-500' : 'text-gray-700'
              }`}>
                VIN (Optional)
                {autoFilledFields.has('vin') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Auto-verified
                  </span>
                )}
                {!autoFilledFields.has('vin') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-200">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Improves confidence
                  </span>
                )}
              </label>
              <input
                type="text"
                id="vin"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                placeholder="e.g., 5YJ3E1EA1JF000001"
                maxLength={17}
                disabled={autoFilledFields.has('vin')}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                  autoFilledFields.has('vin') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                {autoFilledFields.has('vin')
                  ? 'Automatically extracted from listing'
                  : 'Improves recall and warranty verification'
                }
              </p>
            </div>

            {/* Current Mileage Input */}
            <div>
              <label htmlFor="currentMileage" className={`block text-sm font-semibold mb-2 flex items-center ${
                autoFilledFields.has('currentMileage') ? 'text-gray-500' : 'text-gray-700'
              }`}>
                Current Odometer (miles)
                {autoFilledFields.has('currentMileage') && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Auto-verified
                  </span>
                )}
              </label>
              <input
                type="number"
                id="currentMileage"
                value={formData.currentMileage}
                onChange={(e) => setFormData({ ...formData, currentMileage: parseInt(e.target.value) })}
                min={0}
                max={300000}
                step={1}
                required
                disabled={autoFilledFields.has('currentMileage')}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  autoFilledFields.has('currentMileage') ? 'border-green-300 bg-green-50 cursor-not-allowed' : 'border-gray-300'
                }`}
              />
              <p className="text-xs text-gray-500 mt-1">
                {autoFilledFields.has('currentMileage')
                  ? 'Automatically extracted from listing'
                  : 'Current mileage on the vehicle - affects battery degradation estimate'
                }
              </p>
            </div>

            {/* ZIP Code Input */}
            <div>
              <label htmlFor="zipCode" className="block text-sm font-semibold text-gray-700 mb-2">
                Your ZIP Code
              </label>
              <input
                type="text"
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                placeholder="e.g., 94103"
                pattern="\d{5}"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-semibold">Why?</span> Helps us assess climate impact and local charging infrastructure availability
              </p>
            </div>

            {/* Daily Miles Input */}
            <div>
              <label htmlFor="dailyMiles" className="block text-sm font-semibold text-gray-700 mb-2">
                Daily Driving (miles)
              </label>
              <input
                type="number"
                id="dailyMiles"
                value={formData.dailyMiles}
                onChange={(e) => setFormData({ ...formData, dailyMiles: parseInt(e.target.value) })}
                min={0}
                max={500}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-semibold">Why?</span> So we can check if the EV's range works for your typical day — Currently: {formData.dailyMiles} miles/day (~{(formData.dailyMiles * 365).toLocaleString()} miles/year)
              </p>
            </div>

            {/* Home Charging Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label htmlFor="homeCharging" className="block text-sm font-semibold text-gray-700">
                  Home Charging Available?
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="font-semibold">Why?</span> Affects which EVs are practical for your situation and ownership costs (~60% savings vs. public charging)
                </p>
              </div>
              <input
                type="checkbox"
                id="homeCharging"
                checked={formData.homeCharging}
                onChange={(e) => setFormData({ ...formData, homeCharging: e.target.checked })}
                className="w-6 h-6 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Risk Tolerance Radio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Your Risk Tolerance
              </label>
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-semibold">Why?</span> Calibrates recommendations to match your comfort level with battery degradation and ownership costs
              </p>
              <div className="space-y-3">
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value="conservative"
                    checked={formData.riskTolerance === "conservative"}
                    onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                    className="w-4 h-4 mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-semibold text-gray-900">Conservative</span>
                    <p className="text-xs text-gray-600 mt-1">Only show Green if battery health is excellent and no major recalls. Recommended for most buyers.</p>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value="moderate"
                    checked={formData.riskTolerance === "moderate"}
                    onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                    className="w-4 h-4 mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-semibold text-gray-900">Moderate</span>
                    <p className="text-xs text-gray-600 mt-1">Balanced scoring - accept some degradation if price is right. Good for cost-conscious buyers.</p>
                  </div>
                </label>
                <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="riskTolerance"
                    value="aggressive"
                    checked={formData.riskTolerance === "aggressive"}
                    onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                    className="w-4 h-4 mt-1 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-semibold text-gray-900">Aggressive</span>
                    <p className="text-xs text-gray-600 mt-1">Willing to accept higher risk for deep discounts. Assumes you can budget for repairs/replacement.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              onClick={() => trackButtonClick("Get My Risk Score", "main_form")}
              className="w-full bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-green-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Calculating Score..." : "Get My Risk Score →"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700">
              <span className="font-semibold text-blue-900">⚡ Tool by EV analysts</span> - EV-Risk™ uses publicly available data, NHTSA recalls, and 10,000+ owner reports to provide risk assessments. Data updated January 2025.
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
      </div>
    </div>
  );
}
