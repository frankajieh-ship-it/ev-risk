"use client";

import { useState } from "react";
import { Link2, Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface ListingUrlFormProps {
  onExtract: (url: string) => Promise<void>;
  extracting: boolean;
  error: string | null;
  warnings: string[];
  extractedData?: {
    model: string;
    year: number;
    currentMileage: number;
    actualMileage?: number;
    price?: number;
    vin?: string;
  } | null;
  onConfirm?: () => void;
  onReset?: () => void;
}

export default function ListingUrlForm({
  onExtract,
  extracting,
  error,
  warnings,
  extractedData,
  onConfirm,
  onReset,
}: ListingUrlFormProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || extracting) return;
    await onExtract(url.trim());
  };

  const handleReset = () => {
    setUrl("");
    onReset?.();
  };

  // Show extracted data confirmation
  if (extractedData) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl border-2 border-green-300 p-4 md:p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 md:p-3 bg-green-50 rounded-xl">
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900">
              Vehicle Found!
            </h3>
            <p className="text-xs md:text-sm text-gray-600">
              We extracted the following details
            </p>
          </div>
        </div>

        {/* Extracted Data Display */}
        <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Vehicle</div>
              <div className="font-bold text-gray-900">{extractedData.model}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Year</div>
              <div className="font-bold text-gray-900">{extractedData.year}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Mileage</div>
              <div className="font-bold text-gray-900">
                {(extractedData.actualMileage || extractedData.currentMileage).toLocaleString()} mi
              </div>
            </div>
            {extractedData.price && extractedData.price > 0 && (
              <div>
                <div className="text-xs text-gray-600 mb-1">Price</div>
                <div className="font-bold text-gray-900">
                  ${extractedData.price.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {extractedData.vin && (
            <div>
              <div className="text-xs text-gray-600 mb-1">VIN</div>
              <div className="font-mono text-sm text-gray-700">{extractedData.vin}</div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={onConfirm}
            className="w-full px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm md:text-base"
          >
            Continue to Quiz
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Try a different listing
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-3 text-center">
          Next, we'll ask a few questions about your driving needs
        </p>
      </motion.div>
    );
  }

  // Show URL input form
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 md:p-6 hover:border-blue-300 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 md:p-3 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl">
          <Link2 className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg md:text-xl font-bold text-gray-900">
            Listing URL Scanner
          </h3>
          <p className="text-xs md:text-sm text-gray-600">
            Paste AutoTrader, CarGurus, or Cars.com link
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.autotrader.com/cars-for-sale/..."
            disabled={extracting}
            className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed text-sm"
          />
          {/* Trust microcopy */}
          <p className="text-xs text-gray-500 mt-1.5">
            No signup. We don't store the listing URL.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <div className="font-medium mb-1">{error}</div>
              {warnings.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-red-700">
                  {warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={!url.trim() || extracting}
          className="w-full px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
        >
          {extracting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking the parts listings don't make obvious...
            </>
          ) : (
            <>
              Scan Listing
            </>
          )}
        </button>

        {/* Helper text under button */}
        {!extracting && !error && (
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              We'll extract vehicle details and flag what usually surprises buyers.
            </p>
            <p className="text-xs text-gray-500">
              If we can't parse it, we'll ask for 3 quick details.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
